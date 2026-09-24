import express, { type Express } from "express";

import { env } from "./config/env.js";
import { authenticate } from "./middleware/auth.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { clientRateLimit, globalRateLimit } from "./middleware/rate-limit.js";
import chatRouter from "./routes/chat.js";

const app: Express = express();

app.disable("x-powered-by");

app.use(express.json({ limit: env.requestBodyLimit }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/v1", authenticate);
app.use("/v1", clientRateLimit, globalRateLimit);
app.use("/v1", chatRouter);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
