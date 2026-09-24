import type { Request, Response } from "express";
import { rateLimit } from "express-rate-limit";

import { env } from "../config/env.js";

const WINDOW_MS = 60_000;

const rejectRequest = (_req: Request, res: Response): void => {
  res.status(429).json({
    error: {
      message: "Rate limit exceeded, retry later",
      type: "rate_limit_error",
    },
  });
};

export const clientRateLimit = rateLimit({
  windowMs: WINDOW_MS,
  limit: env.rateLimit.perClient,
  keyGenerator: (req) => req.clientId ?? "anonymous",
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: rejectRequest,
});

export const globalRateLimit = rateLimit({
  windowMs: WINDOW_MS,
  limit: env.rateLimit.global,
  keyGenerator: () => "global",
  identifier: "global",
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: rejectRequest,
});
