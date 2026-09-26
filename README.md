# gemini-web-gateway

An Express server that exposes a Gemini web session as an OpenAI-compatible API.

Google's Gemini web app has no public API. This project calls the same endpoints the browser calls, using your session cookies, and returns the answer in the OpenAI Chat Completions format. Any OpenAI client (Python, Node, LangChain, curl) can use it by pointing the base URL and API key at this server.

## How it works

1. The server reads your Gemini session cookies (`__Secure-1PSID`, `__Secure-1PSIDTS`) from the environment.
2. It fetches an access token from the Gemini web app once and reuses it.
3. Each request to `/v1/chat/completions` is sent to Gemini's generate endpoint, and the reply is mapped to the OpenAI response shape.
4. Google rotates one of the cookies every few minutes, so the server calls the rotation endpoint on a timer and stores the latest values in `data/session.json`. Those values are reused after a restart, so the cookies do not have to be copied again.

## Features

- `POST /v1/chat/completions` in OpenAI format
- API key auth for callers, with support for multiple clients
- Two rate limits: per client and global (both 60 second windows)
- Session cookie auto-refresh, persisted to disk
- Retry with a fresh session when Gemini rejects the current one
- TypeScript with strict settings
- Optional Docker setup (Dockerfile plus compose file) for anyone who prefers running it in a container

## Requirements

- Node.js 22 or newer
- A Google account with Gemini web access
- Docker, only if you want to run it in a container instead of directly on the machine

## Getting your cookies

1. Sign in at https://gemini.google.com in your browser.
2. Open DevTools (F12), go to Application -> Cookies -> `https://gemini.google.com`.
3. Copy the values of `__Secure-1PSID` and `__Secure-1PSIDTS`.

These two cookies authenticate the session. Anyone who holds them can use the account, so they must never be committed to git or shared with anyone. If they leak, sign out and sign in again to rotate them.

## Environment variables

Create a `.env` file in the project root:

```env
PORT=8080
GATEWAY_API_KEYS=local:dev-key-1
GEMINI_PSID=your-psid-value
GEMINI_PSIDTS=your-psidts-value
```

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `GATEWAY_API_KEYS` | yes | - | Client keys in `client:key` format, comma separated. Example: `client-a:sk-abc123,client-b:sk-xyz789`. The part before `:` is only a name used in logs and for per-client rate limits. |
| `GEMINI_PSID` | yes | - | Value of the `__Secure-1PSID` cookie |
| `GEMINI_PSIDTS` | yes | - | Value of the `__Secure-1PSIDTS` cookie |
| `PORT` | no | `8080` | Port the server listens on |
| `REQUEST_BODY_LIMIT` | no | `1mb` | Max request body size |
| `RATE_LIMIT_PER_CLIENT` | no | `10` | Requests per minute per API key |
| `RATE_LIMIT_GLOBAL` | no | `30` | Requests per minute for all clients together |
| `GEMINI_REFRESH_MINUTES` | no | `10` | How often the cookies are refreshed |
| `GEMINI_TIMEOUT_SECONDS` | no | `90` | Timeout for one Gemini request |
| `GEMINI_SESSION_FILE` | no | `data/session.json` | Where the latest cookies are cached |

## Running it

### With Node

```bash
npm install
npm run dev
```

### With Docker

```bash
docker compose up -d
```

Compose builds the image from the Dockerfile, reads `.env`, publishes port 8080, and mounts `./data` so the session file survives a container restart.

```bash
docker compose logs -f   # follow logs
docker compose down      # stop and remove the container
```

The server listens on the port set in `.env` (8080 by default). Session values are written to `data/session.json`, and that file is created automatically on the first refresh. Both methods read the same `.env`, so a fresh clone only needs that file and one command.

## Usage

With curl:

```bash
curl http://localhost:8080/v1/chat/completions \
  -H "Authorization: Bearer dev-key-1" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"hello"}]}'
```

With the OpenAI Python SDK:

```python
from openai import OpenAI

client = OpenAI(base_url="http://localhost:8080/v1", api_key="dev-key-1")

reply = client.chat.completions.create(
    model="gateway",
    messages=[{"role": "user", "content": "hello"}],
)

print(reply.choices[0].message.content)
```

## API

### `POST /v1/chat/completions`

Request body:

```json
{
  "messages": [
    { "role": "system", "content": "answer in one line" },
    { "role": "user", "content": "what is an api gateway" }
  ]
}
```

`messages` is the only field that is read. `model` is ignored. The response always reports `"gateway"`, so a client that sends some other model name still gets a working reply instead of a wrong label. Multi-turn conversations work: the roles are flattened into one prompt for Gemini.

Response:

```json
{
  "id": "chatcmpl-6ee8983c-4ee1-4be8-b9c8-667d8e5844da",
  "object": "chat.completion",
  "created": 1790250151,
  "model": "gateway",
  "choices": [
    {
      "index": 0,
      "message": { "role": "assistant", "content": "An API gateway sits in front of a service and forwards requests to it." },
      "finish_reason": "stop"
    }
  ],
  "usage": { "prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0 }
}
```

`usage` is always zero, because the web endpoint does not return token counts.

### `GET /health`

Returns `{"status":"ok"}`. No API key needed. Useful for uptime checks.

## Errors

Every error uses `{"error": {"message": "...", "type": "..."}}`.

| Status | type | When it happens |
| --- | --- | --- |
| 400 | `invalid_request_error` | `messages` is missing, empty, or not an array of `{ role, content }` objects |
| 401 | `authentication_error` | The `Authorization` header is missing, not a `Bearer` token, or the key is not in `GATEWAY_API_KEYS` |
| 404 | `not_found_error` | Unknown route |
| 429 | `rate_limit_error` | Per-client or global limit hit; wait and retry |
| 502 | `upstream_error` | Gemini request failed, or the cookies are expired |

A 502 almost always means the cookies in `.env` are stale. Copy fresh `__Secure-1PSID` / `__Secure-1PSIDTS` values and restart. `data/session.json` can be deleted as well; a new one is created on the next refresh.

## Notes and limits

- Text only. Image generation, image input, PDF and file uploads are not implemented.
- No streaming. `stream: true` is ignored and a normal JSON reply is returned.
- Google's own limits still apply. Free accounts have daily caps, and heavy automated use can get an account throttled or restricted.
- Rate limit counters live in memory, so run one instance. Two instances behind a load balancer would each keep their own counts.
- `data/session.json` holds live cookies. It is in `.gitignore`, and the server writes it with owner-only file permissions on Linux.
- The server sets a larger HTTP header limit (`--max-http-header-size=65536` in the npm scripts) because Gemini's responses ship large headers.
- Not affiliated with Google. Automated use of the Gemini web endpoints may be against Google's terms; keep the gateway private and behind an API key.

## Project layout

```
src/
  server.ts                    entry point, starts the session refresh timer
  app.ts                       express app, middleware order
  config/env.ts                env parsing and validation
  middleware/auth.ts           API key check
  middleware/rate-limit.ts     per-client and global limits
  middleware/error-handler.ts  404 and error responses
  providers/gemini-web.ts      calls Gemini, parses the reply
  providers/gemini-session.ts  cookie rotation and session file
  routes/chat.ts               POST /v1/chat/completions
  types/                       shared types
```

