import { randomUUID } from "node:crypto";

import { Router, type Response } from "express";

import type { ChatMessage } from "../core/provider.js";
import { chat } from "../providers/gemini-web.js";

const DEFAULT_MODEL = "gemini-web";
const ROLES = new Set(["system", "user", "assistant"]);

const router: Router = Router();

const isChatMessage = (value: unknown): value is ChatMessage =>
  typeof value === "object" &&
  value !== null &&
  ROLES.has((value as ChatMessage).role) &&
  typeof (value as ChatMessage).content === "string";

const sendError = (res: Response, status: number, message: string, type: string): void => {
  res.status(status).json({ error: { message, type } });
};

router.post("/chat/completions", async (req, res) => {
  const { model, messages } = req.body ?? {};

  if (!Array.isArray(messages) || messages.length === 0 || !messages.every(isChatMessage)) {
    sendError(
      res,
      400,
      "messages must be a non-empty array of { role, content } objects",
      "invalid_request_error"
    );
    return;
  }

  try {
    const result = await chat({
      model: typeof model === "string" ? model : DEFAULT_MODEL,
      messages,
    });

    res.json({
      id: `chatcmpl-${randomUUID()}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: result.model,
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: result.content },
          finish_reason: result.finishReason,
        },
      ],
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    });
  } catch (error) {
    console.error(`[${req.clientId}] provider error:`, error);
    sendError(res, 502, "Upstream provider request failed", "upstream_error");
  }
});

export default router;
