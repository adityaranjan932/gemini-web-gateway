import express, { type Express } from "express";

import { env } from "./config/env.js";
import { authenticate } from "./middleware/auth.js";
import chatRouter from "./routes/chat.js";

const app: Express = express();

app.use(express.json({ limit: env.requestBodyLimit }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/v1", authenticate);
app.use("/v1", chatRouter);

export default app;
