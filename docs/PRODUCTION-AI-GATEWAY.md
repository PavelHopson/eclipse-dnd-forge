# Production AI gateway

## Что уже существует

Eclipse AI Hub уже владеет production `ai.v1`: server-side provider credentials,
model allowlist, service scopes, minute budgets, sanitized errors и aggregate-only
telemetry. DnD Forge не должен создавать второй router.

DnD BFF и browser consumer теперь реализованы в [`bff/`](../bff/README.md) и
`src/model/auth/dndSession.ts`. Слой остаётся dark-by-default до настройки runtime,
DNS/TLS, отдельных secrets и canary: production Pages не показывает managed provider
без `VITE_DND_MANAGED_AI_ENABLED=true`.

Канонический межпроектный contract:
[`eclipse-ai-hub/docs/dnd-forge-gateway-contract.md`](https://github.com/PavelHopson/eclipse-ai-hub/blob/master/docs/dnd-forge-gateway-contract.md).

## Почему frontend не может подключиться напрямую

`dnd.eclipse-forge.ru` сейчас является статическим GitHub Pages приложением. Token
`ai.v1` идентифицирует доверенный server-side продукт, поэтому его нельзя положить в
`VITE_*`, JavaScript bundle, `localStorage`, URL или выдать browser session. CORS не
превращает secret в безопасный: пользователь и XSS всё равно смогут его прочитать.

## Целевая схема

```text
DnD browser
  -> same-site DnD BFF (Chat-issued identity, campaign access, per-user budget)
       -> private AI Hub ai.v1 (service client eclipse-dnd-forge)
            -> configured provider
```

- Eclipse Chat остаётся владельцем identity.
- DnD BFF хранит DnD session и per-user request/token/cost counters.
- AI Hub хранит provider/service credentials и применяет отдельный product budget.
- DnD campaign content не переносится в Chat или AI Hub storage.

## Обязательные gates

1. Chat выпускает короткоживущую audience-bound identity для DnD без передачи своего
   основного JWT secret другому сервису.
2. DnD BFF проверяет identity, exact origin/CSRF, body schema и campaign access.
3. Budget reservation атомарна: параллельные вкладки не обходят дневной лимит.
4. Audit содержит только request id, subject, model alias, status, latency, tokens,
   cost и normalized error — без prompt/response, cookie и Authorization.
5. AI Hub client имеет только `models:read` и `chat:write`; token находится в
   root-owned environment и никогда не возвращается браузеру.
6. Canary проходит `0% -> 10% -> 0% -> 10%`, rollback и 24-часовое SLO-наблюдение.

До выполнения этих gates OpenAI/Anthropic BYOK остаётся явно помеченным demo-mode.
Ollama остаётся отдельным локальным режимом. Нельзя маскировать browser-direct вызов
как production gateway.

## Текущий blocker

Chat issuer, PKCE consumer, BFF sessions, JWKS validation, CSRF/origin boundary и
атомарные single-process budgets реализованы и покрыты regression tests. До production
остаются infrastructure gates: выделить `api.dnd.eclipse-forge.ru`, установить TLS,
создать scoped AI Hub client, положить secrets в root-owned environment, выполнить
rollback canary и 24-часовое SLO-наблюдение.

Известные ограничения до следующего security slice: single-process code/session/budget
stores, отсутствие мгновенной cross-service revocation и server-owned campaign ACL.
