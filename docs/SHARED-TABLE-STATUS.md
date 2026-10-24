# Shared Table playable slice — status

Дата проверки: 2026-10-24. Локальная реализация в `E:/projects/eclipse-dnd-forge`,
Git root подтверждён, ветка `main`. Commit, push и deploy
не выполнялись. Существующее грязное дерево других задач сохранено.

## Что теперь можно пройти

Из реального launcher доступна кнопка **«Открыть общий стол для ведущего и игрока»**.
Ведущий открывает приключение и получает player-only invite; игрок входит по ссылке
в независимой browser session, видит текущую сцену, задаёт имя персонажа, описывает
действие и получает обычный server-authoritative бросок; ведущий отдельно запускает
server-owned d20 проверку с DC, модификатором и режимом. Игрок также сохраняет лист
персонажа (описание, HP и инициативу), а ведущий ведёт список инициативы и ход.
Ведущий видит результат в общем журнале и может опубликовать короткий ответ на каждый
ход; игрок получает этот ответ в своей ленте. Ведущий также может изменить
название/описание сцены. Scene, action log, ответы ведущего, лист и инициатива
восстанавливаются после reload и после перезапуска локального server.

Это часть основного Vite-приложения: route `#/party` подключён в `src/App.tsx`, вход
находится в `src/view/Launcher.tsx`, dice использует существующий `src/model/dice.ts`.
Это не отдельный preview из `experiments/`.

## Transport boundary

Основной путь при `VITE_DND_MANAGED_AI_ENABLED=true` использует authenticated BFF
Campaign API: `campaignId`, membership roles, player-safe projection, revisions,
`Idempotency-Key` и `afterRevision` polling. Browser helpers находятся в
`src/model/dnd/remoteCampaign.ts`.

`scripts/shared-table-server.mjs` сохранён только как loopback adapter для local
development и synthetic QA: same-origin static server, bounded room API и disk
persistence. Он не является production multiplayer backend и не должен публиковаться.

## Запуск

```powershell
Set-Location E:\projects\eclipse-dnd-forge
npm.cmd run build
npm.cmd run party:start
```

Открыть `http://127.0.0.1:5210/`, затем нажать **«Открыть общий стол…»**.
Это только local adapter. Managed campaign invite требует BFF auth/session и отдельного
провайдера identity; удалённый multi-device playtest пока не заявляется.
Остановка — `Ctrl+C` в терминале server.

Room state по умолчанию: `%USERPROFILE%/.eclivarium/shared-table-rooms.json`.
Повреждённый файл блокирует старт и не перезаписывается.

## Права и security boundary

- Room ID не является доступом. API требует случайный 256-bit bearer key; на диске
  хранятся только SHA-256 hashes. Raw key находится в URL fragment/browser history,
  а player invite дополнительно держится в master `sessionStorage` для reload; он не
  попадает в HTTP request/referrer, server log или room file.
- Master key может менять scene; player key не может. Только player key отправляет turn.
- Request body bounded до 16 KiB; exact-field validation блокирует mass assignment,
  control/bidi text и неподдерживаемые dice expressions. Turn ID делает retry idempotent.
- Server bind только loopback, CSP/self-only static delivery, no external runtime requests,
  no credential logging. Room create/action polling имеет локальный rate limit.
- Локальный room file не шифруется и содержит игровой текст. Player key пока один на room,
  а не отдельный identity на каждого участника.

Proportional `conducting-api-security-testing` pass: ACL/BFLA, object access, mass
assignment, input bounds, malformed persistence, URL/secret leakage и error responses.
Новых Critical/High findings в этом slice нет. Medium, accepted for local-only scope:
shared player key и незашифрованный local room file. Это не production security clearance.

## Фон сцены и provenance

Встроен оригинальный фон `public/assets/scenes/dnd-gateway.png`; он используется как
вступительная scene, не как клеточная battle map. SHA256:
`5F7C8CFC873583F4E4EDAD821CB01D025CF86B9FF38461F0C8801F3596A3CE5C`.

Оригиналы без изменений сохранены в `docs/assets/scenes/dnd-gateway/`:
`dnd-gateway.png`, `prompt.txt`, `generation.json`. Источник — собственная image_gen
генерация по OnePromptDesign prompt structure, без чужих reference images.

## Проверки

- `npm.cmd run typecheck` — PASS.
- `npm.cmd run lint` — PASS.
- `npm.cmd test` — **154/154 PASS**.
- `npm.cmd run build` — PASS.
- `npm.cmd run bundle:check` — PASS: initial graph 587.0 KiB, largest deferred chunk
  295.0 KiB; Shared Table остаётся deferred chunk ~23.62 KiB JS / 9.71 KiB CSS.
- `node --check scripts/shared-table-server.mjs` и `scripts/qa-shared-table.mjs` — PASS.
- `node scripts/qa-shared-table.mjs` содержит двухпрофильный desktop/mobile сценарий.
  В текущем изолированном запуске Codex CDP/loopback не поднялись, поэтому новый
  browser acceptance в этом прогоне не заявляется; API-сценарий выше прошёл с loopback
  разрешением.
- `node --test bff/tests/campaign.test.mjs bff/tests/config.test.mjs bff/tests/server.test.mjs`
  с loopback-разрешением: **8/8 PASS** для ACL, player-safe projection, revisions,
  idempotency, delta/reconnect, backup/restore и fail-closed persistence.

Исторический browser acceptance от 2026-10-20 покрывал launcher → create room → player
invite, role-specific UI, scene visibility, player action + server roll, master receipt,
master scene update, player reload, API failure/reconnect, desktop 1440×1000, narrow
390×844, horizontal overflow, uncaught exceptions и отсутствие external runtime
requests. Текущий harness расширен листом, инициативой, server-owned d20 и ходом, но
в этом окружении CDP не поднялся (`ECONNREFUSED 127.0.0.1:9240`), поэтому browser
acceptance новых контролов не заявляется.

Первый focused API test в sandbox получил `connect EACCES`; тот же test вне sandbox
прошёл. Ранние reconnect QA попытки были нестабильны из-за CDP network emulation;
финальный harness использует детерминированный failed API request и явный retry.
Windows UI helper не смог безопасно отличить отдельное QA Edge окно от уже открытого
пользовательского Edge, поэтому input не отправлялся; visual review выполнен по screenshots
из двух проверенных disposable profiles.

## Что остаётся до игры с друзьями

Исторический локальный harness доказывает игру в двух независимых browser sessions
**на одном ПК** для сцены, действий и броска. Текущий backend-тест добавляет лист и
инициативу. Новые `action.check`, `initiative.start`, `initiative.advance` и
`initiative.end` проверены API-тестами: бросок и переход хода выполняет сервер,
игроку доступна только player-safe projection, повтор операции безопасен, stale
revision отклоняется. `action.resolve` также проверен API-тестами: ответ публикует
только ведущий и он виден игроку после reconnect. Authenticated Campaign API проверен,
но не на реальном remote двухпользовательском провайдере/двух устройствах.

Следующий production gate: managed transactional storage вместо file-backed single-process,
отдельные identities/revocation, TLS/origin policy, realtime transport, remote two-user
E2E и backup retention/encryption. Отдельно остаётся content-boundary/legal cleanup:
текущий gate находит защищённые setting/story names в существующем коде и README.
До закрытия этих пунктов нельзя называть режим готовым для удалённой партии или
открывать public beta.
