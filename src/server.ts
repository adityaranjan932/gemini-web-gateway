import app from "./app.js";
import { env } from "./config/env.js";
import { startSessionRefresh } from "./providers/gemini-session.js";

await startSessionRefresh();

app.listen(env.port, () => {
  console.log(`Server running on http://localhost:${env.port}`);
});
