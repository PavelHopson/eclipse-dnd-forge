# Eclipse DnD Forge BFF

Server-side boundary between the public DnD browser, Eclipse Chat identity and
the private Eclipse AI Hub `ai.v1` gateway.

The public BFF foundation is active at `https://api.dnd.eclipse-forge.ru`, but AI is
dark by default with `DND_BFF_AI_ENABLED=false`. The GitHub Pages build does not show
the managed provider until `VITE_DND_MANAGED_AI_ENABLED=true` is supplied after the
authenticated PKCE canary, rollback drill and 24-hour SLO gate.

## What it owns

- Authorization Code + PKCE exchange with Eclipse Chat;
- independent Ed25519/JWKS validation with fixed issuer and audience;
- opaque `HttpOnly; Secure; SameSite=Lax` DnD sessions;
- exact browser Origin and CSRF validation;
- strict request bounds and sanitized errors;
- atomic per-user and product token reservations;
- scoped server-to-server calls to AI Hub (`models:read`, `chat:write`).

It never returns or logs the Chat identity token, AI Hub service token, prompt,
completion, cookie or authorization header.

## Required environment

```dotenv
NODE_ENV=production
DND_BFF_HOST=127.0.0.1
DND_BFF_PORT=8820
DND_PUBLIC_ORIGIN=https://dnd.eclipse-forge.ru
DND_BFF_SECURE_COOKIE=true
DND_BFF_SESSION_TTL_SECONDS=3600

DND_CHAT_TOKEN_URL=https://app.star-crm.ru/eclipse-chat/api/ecosystem/token
DND_CHAT_JWKS_URL=https://app.star-crm.ru/eclipse-chat/api/ecosystem/.well-known/jwks.json
DND_CHAT_ISSUER=https://app.star-crm.ru/eclipse-chat
DND_CHAT_REDIRECT_URI=https://dnd.eclipse-forge.ru/

DND_AI_GATEWAY_BASE_URL=https://<private-ai-gateway-host>
DND_AI_GATEWAY_SERVICE_TOKEN=<dedicated-32+-character-secret>
DND_BFF_BUDGET_FILE=/var/lib/eclipse-dnd-forge/budgets.json

DND_BFF_USER_REQUESTS_PER_15_MINUTES=60
DND_BFF_USER_DAILY_TOKENS=250000
DND_BFF_PRODUCT_DAILY_TOKENS=5000000
DND_BFF_MAX_OUTPUT_TOKENS=2048
DND_BFF_AI_ENABLED=false
```

The environment file must be `root:eclipse-dnd-bff`, mode `0640`. The dedicated
service account can read it but cannot change it. The budget path must be outside
the repository and writable only by that account.

Run locally with:

```bash
npm run bff:start
```

Health is the only origin-free endpoint:

```http
GET /health
```

## AI Hub client

Create a dedicated `eclipse-dnd-forge` entry in AI Hub
`AI_GATEWAY_SERVICE_CLIENTS`. It receives only:

```json
{
  "id": "eclipse-dnd-forge",
  "tokens": ["<dedicated-secret>"],
  "scopes": ["models:read", "chat:write"],
  "requestsPerMinute": 120
}
```

Do not grant `telemetry:read`. Rotate with a bounded two-token window, deploy
the BFF with the new token, verify traffic and then remove the old token.

## Browser activation

Only after the authenticated PKCE, AI rollback and SLO gates pass, build the static
application with public, non-secret variables:

```dotenv
VITE_DND_MANAGED_AI_ENABLED=true
VITE_DND_BFF_URL=https://api.dnd.eclipse-forge.ru
VITE_ECLIPSE_CHAT_AUTHORIZE_URL=https://app.star-crm.ru/eclipse-chat/
```

No secret is allowed in any `VITE_*` variable.

## Rollout and rollback

1. Keep the UI flag off and deploy BFF with `DND_BFF_AI_ENABLED=false`.
2. Verify health, TLS, exact CORS rejection, Chat PKCE and AI Hub service scope.
3. Enable synthetic traffic, then canary `0% → 10% → 0% → 10%`.
4. Enable the frontend flag only after rollback succeeds.
5. Observe the aggregate AI Hub SLO for 24 hours before calling the slice live.

Emergency rollback is either `DND_BFF_AI_ENABLED=false` or removing
`VITE_DND_MANAGED_AI_ENABLED` in the next Pages build. Direct BYOK and local
Ollama remain explicit separate modes; the managed provider never silently
falls back to them.

The first server rollout uses `deploy/scripts/bootstrap-dark.sh`. It installs one
loopback-only Supervisor process, upserts only the scoped DnD gateway client,
checks that DnD receives `403` from telemetry, confirms Chat still receives `200`,
and restores both environment files if any smoke fails. The later public foundation
uses `audit-public-prereqs.sh`, `activate-public.sh` and `harden-chat-env.sh`: it adds
TLS/Nginx and a VPS-generated Chat Ed25519 key with rollback, then makes the Chat env
`root:www-data 0640`. It intentionally does not enable AI or the frontend flag.

## Current constraints

- Run exactly one BFF process. Sessions are in memory and the atomic budget file
  is designed for one writer; horizontal scale needs Redis/Postgres transactions.
- Chat authorization codes are also single-process memory state. Chat must use
  sticky/single-instance routing until the code store moves to shared storage.
- A banned Chat account may retain an already-created DnD session for at most one
  hour. Immediate cross-service revocation needs a separate signed revocation or
  introspection contract.
- Campaigns are currently browser-local, so the BFF authenticates the DnD user
  but cannot yet enforce per-campaign ACLs. Server-owned campaigns are a separate
  data migration.
- Structured JSON uses schema instructions plus local validation because `ai.v1`
  does not expose a provider-neutral JSON-schema response contract yet.
