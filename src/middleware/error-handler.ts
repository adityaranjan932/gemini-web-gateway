import type { NextFunction, Request, Response } from "express";

interface HttpError extends Error {
  status?: number;
  expose?: boolean;
}

export const errorHandler = (
  error: HttpError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const status = error.status ?? 500;

  if (status >= 500) {
    console.error("Unhandled error:", error);
  }

  res.status(status).json({
    error: {
      message: error.expose ? error.message : "Internal server error",
      type: status >= 500 ? "server_error" : "invalid_request_error",
    },
  });
};
