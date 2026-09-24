import type { NextFunction, Request, Response } from "express";

import { env } from "../config/env.js";

const BEARER_PREFIX = "Bearer ";

export const authenticate = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const header = req.header("authorization");

  if (!header?.startsWith(BEARER_PREFIX)) {
    res.status(401).json({
      error: {
        message: "Missing or malformed Authorization header",
        type: "authentication_error",
      },
    });
    return;
  }

  const clientId = env.apiKeys.get(header.slice(BEARER_PREFIX.length).trim());

  if (clientId === undefined) {
    res.status(401).json({
      error: {
        message: "Invalid API key",
        type: "authentication_error",
      },
    });
    return;
  }

  req.clientId = clientId;
  next();
};
