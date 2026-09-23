import "dotenv/config";

const requireEnv = (name: string): string => {
  const value = process.env[name];

  if (!value || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
};

const parseApiKeys = (raw: string): ReadonlyMap<string, string> => {
  const entries = raw
    .split(",")
    .map((pair) => pair.trim())
    .filter((pair) => pair.length > 0)
    .map((pair): readonly [string, string] => {
      const separator = pair.indexOf(":");

      if (separator <= 0 || separator === pair.length - 1) {
        throw new Error(
          `Invalid GATEWAY_API_KEYS entry "${pair}", expected format "client:key"`
        );
      }

      return [pair.slice(separator + 1).trim(), pair.slice(0, separator).trim()];
    });

  if (entries.length === 0) {
    throw new Error("GATEWAY_API_KEYS must contain at least one client:key pair");
  }

  return new Map(entries);
};

export const env = {
  port: Number(process.env["PORT"]) || 8080,
  nodeEnv: process.env["NODE_ENV"] ?? "development",
  requestBodyLimit: process.env["REQUEST_BODY_LIMIT"] ?? "1mb",
  apiKeys: parseApiKeys(requireEnv("GATEWAY_API_KEYS")),
  rateLimit: {
    perClient: Number(process.env["RATE_LIMIT_PER_CLIENT"]) || 10,
    global: Number(process.env["RATE_LIMIT_GLOBAL"]) || 30,
  },
  gemini: {
    psid: requireEnv("GEMINI_PSID"),
    psidts: requireEnv("GEMINI_PSIDTS"),
    refreshMinutes: Number(process.env["GEMINI_REFRESH_MINUTES"]) || 10,
    sessionFile: process.env["GEMINI_SESSION_FILE"] ?? "data/session.json",
  },
} as const;
