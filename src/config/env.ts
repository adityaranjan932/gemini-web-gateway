import "dotenv/config";

const requireEnv = (name: string): string => {
  const value = process.env[name];

  if (!value || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
};

const optionalEnv = (name: string, fallback: string): string => {
  const value = process.env[name]?.trim();

  return value ? value : fallback;
};

const positiveIntEnv = (name: string, fallback: number): number => {
  const raw = process.env[name]?.trim();

  if (!raw) {
    return fallback;
  }

  const value = Number(raw);

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Environment variable ${name} must be a positive integer, got "${raw}"`);
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
  port: positiveIntEnv("PORT", 8080),
  requestBodyLimit: optionalEnv("REQUEST_BODY_LIMIT", "1mb"),
  apiKeys: parseApiKeys(requireEnv("GATEWAY_API_KEYS")),
  rateLimit: {
    perClient: positiveIntEnv("RATE_LIMIT_PER_CLIENT", 10),
    global: positiveIntEnv("RATE_LIMIT_GLOBAL", 30),
  },
  gemini: {
    psid: requireEnv("GEMINI_PSID"),
    psidts: requireEnv("GEMINI_PSIDTS"),
    refreshMinutes: positiveIntEnv("GEMINI_REFRESH_MINUTES", 10),
    timeoutMs: positiveIntEnv("GEMINI_TIMEOUT_SECONDS", 90) * 1000,
    sessionFile: optionalEnv("GEMINI_SESSION_FILE", "data/session.json"),
  },
} as const;
