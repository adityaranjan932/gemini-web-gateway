import { randomUUID } from "node:crypto";

import { Router } from "express";

const router: Router = Router();

router.post("/chat/completions", (req, res) => {
  const { model, messages } = req.body ?? {};

  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({
      error: {
        message: "messages must be a non-empty array",
        type: "invalid_request_error",
      },
    });
    return;
  }

  res.json({
    id: `chatcmpl-${randomUUID()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: typeof model === "string" ? model : "mock",
    choices: [
      {
        index: 0,
        message: { role: "assistant", content: "hello from gateway" },
        finish_reason: "stop",
      },
    ],
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
  });
});

export default router;
