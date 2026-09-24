import { env } from "../config/env.js";
import type { ChatMessage, ChatRequest, ChatResult } from "../core/provider.js";
import { cookieHeader, refreshSession } from "./gemini-session.js";

const BASE_URL = "https://gemini.google.com";
const GENERATE_URL = `${BASE_URL}/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate`;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";
const INTERNAL_CODE_BLOCK = /```[\w-]*\?code_[^\n]*\n[\s\S]*?```/g;

let accessToken: string | undefined;

const tryParse = (value: string): any => {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
};

const fetchAccessToken = async (): Promise<string> => {
  const response = await fetch(`${BASE_URL}/app`, {
    headers: { Cookie: cookieHeader(), "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(env.gemini.timeoutMs),
  });

  const token = /"SNlM0e":"(.*?)"/.exec(await response.text())?.[1];

  if (!token) {
    throw new Error("Gemini session is invalid or expired");
  }

  return token;
};

const toPrompt = (messages: ChatMessage[]): string => {
  const [first] = messages;

  if (messages.length === 1 && first?.role === "user") {
    return first.content;
  }

  return messages.map(({ role, content }) => `${role}: ${content}`).join("\n\n");
};

const extractText = (raw: string): string | undefined => {
  let text: string | undefined;

  for (const line of raw.split("\n")) {
    const frames = tryParse(line);

    if (!Array.isArray(frames)) {
      continue;
    }

    for (const frame of frames) {
      if (!Array.isArray(frame) || typeof frame[2] !== "string") {
        continue;
      }

      const candidate = tryParse(frame[2])?.[4]?.[0]?.[1]?.[0];

      if (typeof candidate === "string") {
        text = candidate;
      }
    }
  }

  return text;
};

const generate = async (prompt: string): Promise<string> => {
  accessToken ??= await fetchAccessToken();

  const body = new URLSearchParams({
    at: accessToken,
    "f.req": JSON.stringify([null, JSON.stringify([[prompt], null, null])]),
  });

  const response = await fetch(GENERATE_URL, {
    method: "POST",
    headers: {
      Cookie: cookieHeader(),
      "User-Agent": USER_AGENT,
      "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
      Origin: BASE_URL,
      Referer: `${BASE_URL}/`,
      "X-Same-Domain": "1",
    },
    body,
    signal: AbortSignal.timeout(env.gemini.timeoutMs),
  });

  if (!response.ok) {
    accessToken = undefined;
    throw new Error(`Gemini request failed with status ${response.status}`);
  }

  const content = extractText(await response.text());

  if (content === undefined) {
    accessToken = undefined;
    throw new Error("Gemini returned an unrecognized response");
  }

  return content.replace(INTERNAL_CODE_BLOCK, "").trim();
};

export const chat = async (request: ChatRequest): Promise<ChatResult> => {
  const prompt = toPrompt(request.messages);
  let content: string;

  try {
    content = await generate(prompt);
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw error;
    }

    await refreshSession();
    content = await generate(prompt);
  }

  return { content, model: request.model, finishReason: "stop" };
};
