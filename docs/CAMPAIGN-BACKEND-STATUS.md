# Server-owned Campaign slice

Статус: локально проверенный vertical slice. Это не production clearance.

## Что добавлено

- `campaignId`, owner и membership с ролями `owner`, `co_dm`, `player`, `viewer`.
- Authenticated BFF routes:
  - `GET/POST /api/v1/campaigns`
  - `GET /api/v1/campaigns/:campaignId`
  - `POST /api/v1/campaigns/:campaignId/invites`
  - `POST /api/v1/campaigns/join`
  - `GET/POST /api/v1/campaigns/:campaignId/events`
  - `GET /api/v1/campaigns/:campaignId/backup`
  - `POST /api/v1/campaigns/restore`
- Player-safe projection: игрок не получает `privateNotes`, membership details и private event payload.
- Monotonic `revision`, `expectedRevision`, `Idempotency-Key`, replay на повторном запросе и `409` при stale/conflicting request.
- Event types для scene, action/dice, action.check (server-owned d20), action.resolve
  (ответ ведущего), initiative.start/advance/end и initiative,
  character projection и GM notes.
- Atomic JSON persistence с `0600`, fail-closed при повреждении и restore в новую кампанию.
- Nested-state validation при загрузке: scene background, actions/dice,
  initiative, characters, events, invites и idempotency records проверяются
  до публикации snapshot.
- Shared Table умеет использовать этот authenticated campaign API при включённом managed mode. Loopback adapter сохранён только для local development и synthetic QA.
- Player View теперь показывает remote initiative и позволяет ведущему менять
  шкалу боя, а игроку сохранять собственный character sheet через
  `initiative.set` и `character.upsert`.
- Ведущий может завершить ход через `action.resolve`: ответ публикуется игроку,
  проходит ACL/revision/idempotency и входит в player-safe projection.
- Проверка `action.check` принимает только DC/modifier/mode от owner/co_dm; бросок,
  natural 1/20 и outcome рассчитываются на сервере. `initiative.start`,
  `initiative.advance` и `initiative.end` меняют server-owned `turn` с раундом и
  active participant.

## Ограничения

- Хранилище пока file-backed и single-process.
- Session store BFF остаётся in-memory.
- Reconnect реализован через authenticated polling + `afterRevision` delta cursor
  и revision; SSE/WebSocket ещё не подключены.
- Реального remote multi-device playtest и production backup storage ещё нет.
- Billing, public invites, moderation и production AI остаются закрытыми до отдельных gates.

## Проверки

`node --test bff/tests/campaign.test.mjs bff/tests/server.test.mjs` — pass.
Полный проектный прогон после UI slice: `154/154` тестов pass, typecheck,
lint, build и bundle budget pass.

Следующий backend gate: вынести CampaignStore в managed transactional storage, добавить concurrent multi-instance tests, invite revocation UI, delta cursor/`410`, authenticated browser E2E с двумя пользователями и backup retention/encryption.
