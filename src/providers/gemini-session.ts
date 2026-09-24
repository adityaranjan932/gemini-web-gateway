import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { env } from "../config/env.js";

const ROTATE_URL = "https://accounts.google.com/RotateCookies";
const PSIDTS_COOKIE = /^__Secure-1PSIDTS=([^;]+)/;

interface Session {
  psid: string;
  psidts: string;
}

let session: Session = { psid: env.gemini.psid, psidts: env.gemini.psidts };
let pendingRefresh: Promise<void> | undefined;

export const cookieHeader = (): string =>
  `__Secure-1PSID=${session.psid}; __Secure-1PSIDTS=${session.psidts}`;

const loadSession = async (): Promise<void> => {
  try {
    const saved = JSON.parse(await readFile(env.gemini.sessionFile, "utf8")) as Session;

    if (saved.psid === env.gemini.psid && typeof saved.psidts === "string") {
      session = saved;
    }
  } catch {
    return;
  }
};

const saveSession = async (): Promise<void> => {
  await mkdir(dirname(env.gemini.sessionFile), { recursive: true });
  await writeFile(env.gemini.sessionFile, JSON.stringify(session), { mode: 0o600 });
  await chmod(env.gemini.sessionFile, 0o600);
};

const rotateCookies = async (): Promise<void> => {
  const response = await fetch(ROTATE_URL, {
    method: "POST",
    headers: { Cookie: cookieHeader(), "Content-Type": "application/json" },
    body: '[000,"-0000000000000000000"]',
    signal: AbortSignal.timeout(env.gemini.timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`Gemini cookie rotation failed with status ${response.status}`);
  }

  const psidts = response.headers
    .getSetCookie()
    .map((cookie) => PSIDTS_COOKIE.exec(cookie)?.[1])
    .find((value) => value !== undefined);

  if (psidts !== undefined) {
    session = { ...session, psidts };
    await saveSession();
  }
};

export const refreshSession = (): Promise<void> => {
  pendingRefresh ??= rotateCookies().finally(() => {
    pendingRefresh = undefined;
  });

  return pendingRefresh;
};

const refreshInBackground = (): void => {
  refreshSession().catch((error) => {
    console.error("Gemini session refresh failed:", error);
  });
};

export const startSessionRefresh = async (): Promise<void> => {
  await loadSession();
  refreshInBackground();
  setInterval(refreshInBackground, env.gemini.refreshMinutes * 60_000).unref();
};
