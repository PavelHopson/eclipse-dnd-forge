# A09 — восстановление DM после AI/network/module errors

Дата: 2026-10-09. Checkout: `E:/projects/eclipse-dnd-forge`, `main`, HEAD `82b81fe` с сохранёнными принятыми и чужими dirty changes. Только локальный срез; commit/push/deploy не разрешены. Единственный runtime writer — текущая DnD-задача; новые задачи ниже не запущены и требуют приёмки A-00.

## Граница и воспроизведение

Источник: [A09 исходного аудита](FUNCTIONAL-AUDIT-2026-09-05.md). Проверен отдельный `DmAgentPanel`, а не все AI-поверхности и не полноценная AI-игра. В production build на синтетической кампании перехваченный `fetch` выбрасывал `TypeError('Failed to fetch')`. До исправления поле запроса стало пустым, история содержала ошибку как реплику рассказчика и одну кнопку «Вставить в сессию». `qa-ai-recovery.mjs --before` упал на `Failure must not be insertable as successful narrative` (1 вместо 0).

## Локальная реализация

- Неудачный запрос и незавершённый поток не добавляются в историю. Успех добавляет ровно одну пару user/assistant; канонический текст сессии изменяется только явной вставкой успешной реплики. Черновик остаётся доступным после ошибки, отмены и закрытия/повторного открытия панели.
- Ошибки представлены отдельно: понятные сообщения о соединении, доступе, лимите, недоступности сервиса, повреждённом ответе, отмене и загрузке модуля; сырые provider bodies, chunk URLs и технические подробности не показываются в DM error UI. Повтор ручной, без автоматического replay запроса.
- Весь `runDmTurn`, включая dynamic import и stalled stream, ограничен 45 секундами. AbortSignal доходит до провайдера. Отмена/таймаут не запускают следующий fallback; поздние callbacks игнорируются. Fallback больше не пишет сырые ошибки провайдера в console.
- Ollama/Anthropic streaming отвергает malformed JSON, пустой или оборванный поток без завершающего маркера. Проверяется завершённость, а не правдивость/игровая корректность ответа модели.
- После ошибки cached dynamic import есть «Сохранить и перезагрузить». Сначала сохраняется мир через существующий campaign flush, затем проверенный снимок DM draft/history в campaign-scoped sessionStorage, и только затем reload. Ошибка записи отменяет reload. Снимок ограничен 1 MiB, валидируется, после восстановления удаляется; он не содержит ключей и не переносится между кампаниями.
- Browser-проверка выявила неработавший Enter на NextUI retry с `onClick`; действия DM-панели переведены на `onPress`. Поле и ошибка больше не вытесняются длинной историей на mobile. Общий layout приложения не перерабатывался.
- Это recovery snapshot для той же вкладки, не новая durable chat/session service. Обычный ручной reload, закрытие браузера или переход в другую кампанию не обещает сохранность несохранённого DM-черновика/полной AI-истории. Сохранённый канонический текст продолжает использовать существующую campaign persistence.

## Write-set

Только эти файлы относятся к данному срезу:

1. `src/model/ai/requestRecovery.ts`
2. `src/model/agents/dmRecoverySnapshot.ts`
3. `src/model/agents/DmAgent.ts`
4. `src/model/ai/OllamaProvider.ts`
5. `src/model/ai/AnthropicProvider.ts`
6. `src/model/ai/FallbackProvider.ts`
7. `src/store/useAiConfigStore.ts`
8. `src/store/useAgentStore.ts`
9. `src/view/dnd/DmAgentPanel.tsx`
10. `tests/ai-recovery.test.mjs`
11. `scripts/qa-ai-recovery.mjs`
12. `docs/AI-RECOVERY-STATUS.md`

## Проверка и ограничения

- Focused contract tests: `node --experimental-strip-types --test tests/ai-recovery.test.mjs` — 8/8. Используются реальные helpers/providers с локальной подменой транспорта; TypeScript provider-классы транспилируются в памяти существующей зависимостью, без установки пакетов.
- `npm.cmd test` — 122/122; `npm.cmd run typecheck`, `npm.cmd run lint` — PASS. Сборка и bundle budget проходят: initial graph 582.5 KiB, largest deferred chunk 294.5 KiB.
- `node scripts/qa-campaign-reliability.mjs 9232 http://127.0.0.1:5198/` — **14/14 PASS** на той же финальной сборке, но в отдельном свежем профиле; включая Project Bible desktop/mobile failure → retry → reload, изоляцию кампаний, архив, backup, lock и corrupt-storage fail-closed.
- `node scripts/qa-ai-recovery.mjs 9232 http://127.0.0.1:5198/` — **10/10 PASS**, финальный production build на loopback Vite preview, новый одноразовый headless Edge profile. Реальные mouse hit targets и keyboard Enter; controlled fetch failures, без AI сервера: offline, 401/429/503, malformed/partial stream, Stop, настоящий 45-секундный deadline, повтор без дублей, закрытие/открытие панели, mobile 390×844, blocked providerFactory chunk → отказ записи recovery snapshot → безопасный reload → восстановление → успешный повтор. Явная вставка только успешного ответа сохраняется после reload; до вставки canonical session text неизменен.
- Для проверки module recovery seeded snapshot содержит четыре синтетические реплики из предыдущих успешных UI-ходов; snapshot не является доказательством обычного durable chat persistence. Отказ module download проверялся через `Network.setBlockedURLs`, recovery storage — через отказ `sessionStorage.setItem`. Внешние fetch заблокированы harness; ответ «СИНТЕТИЧЕСКИЙ ОТВЕТ» не выдаётся за настоящий AI.
- Визуально проверены `dm-offline-desktop.png`, `dm-offline-mobile.png`, `dm-module-recovery.png` в `C:/Users/garaa/Documents/Codex/2026-08-23/dnd/a09-ai-recovery-2026-10-09/`. На mobile доступны ошибка/retry/draft; общий world canvas остаётся тесным, журнал прокручивается. Это не полный accessibility или physical-mobile audit.
- `git diff --check`, `node --check scripts/qa-ai-recovery.mjs`, scoped secret-pattern scan — PASS. SHA-256 всех 13 файлов, уже изменённых до среза, совпали с before-снимком: Project Bible, map-delete, README и прочая принятая работа не изменены. Новых зависимостей нет; свежий dependency advisory audit в этом срезе не запускался.
- Security review (`conducting-api-security-testing`) ограничен error exposure, cancellation/fallback и целостностью recovery storage. Платные AI, реальные ключи, пользовательские кампании и production не использовались. Mock-ответ не является real-provider/playtest acceptance.
- **Medium, unresolved — остаток A09:** `DmOrchestrator.runGameTurn` ещё превращает DM/NPC errors в художественные реплики; `PlayModePanel` очищает ввод до результата. Этот отдельный orchestration flow не изменён и не принят. **Low, fixed in DM error surface:** отображение сырых provider errors/chunk URLs и logging сырых fallback errors заменены безопасными сообщениями; это не доказательство фактической утечки конкретного ключа. Остальные NPC/generator/structured-output UI не получили полного browser-аудита. OpenAI SDK и managed gateway transports не упражнялись этим browser harness; не заявляется real-provider acceptance. A09 целиком не закрыт.

### Независимый повтор

Windows PowerShell, из checkout: собрать `npm.cmd run build`, запустить `npm.cmd run preview -- --host 127.0.0.1 --port 5198 --strictPort`; при занятом порте остановиться и выбрать свободный loopback порт, не останавливая чужой процесс. В отдельном disposable headless Edge задать `--enable-automation`, `--no-first-run`, `--no-default-browser-check`, `--disable-background-networking`, `--remote-debugging-port=9232`, уникальный `--user-data-dir` с префиксом `eclivarium-reliability-a09-` и открыть preview URL. Дождаться готовности CDP. Скрипт отказывается работать с обычным профилем и существующими кампаниями. Каждый полный запуск требует свежего профиля.

Команда acceptance: `node scripts/qa-ai-recovery.mjs 9232 http://127.0.0.1:5198/`. Для скриншотов перед запуском задать `$env:QA_SCREENSHOT_DIR` в отдельную локальную QA-папку. `--before` предназначен только для воспроизведения дефекта старого build и должен падать на старом поведении, а не подменяет acceptance.

## Следующая очередь для агентов — максимум 8 задач

Это предложения владельцев, не назначения/запуск агентов. Порядок задаёт зависимости; три режима равноправны. Общий acceptance каждого режима: создать/подключить → персонаж → старт → значимое действие → изменение мира → сохранение → reconnect → безопасный выход. Ни одну модель нельзя заменить локальным mock-чатом.

| ID / связь | Факт и статус | Результат для игрока | Зависимости | Предлагаемый владелец | Acceptance |
|---|---|---|---|---|---|
| Q1 · foundation, A03/A11 | В просмотренном `bff/src/server.mjs` есть auth/AI routes и in-memory auth sessions; server-owned campaign membership/roles/group-state routes не найдены. Полная инфраструктура: **unknown**. | GM управляет своей группой; игрок видит и меняет только разрешённые данные. | Решение о серверном campaign/session contract, отдельный auth review. | Backend/ACL agent | Два пользователя + посторонний: server-denied чужая кампания/GM mutation; синхронизация разрешённого действия; секретные GM данные не приходят игроку; negative API tests. |
| Q2 · durability, A01/A03/A11 | Локальная campaign persistence есть; `useAgentStore`/`useGameLoopStore` не являются серверным журналом. Durable multi-user reconnect: **unknown**. | Переподключение не теряет ход и не выполняет действие дважды. | Q1, event/revision/idempotency contract. | Session/realtime agent | Disconnect до/после commit, повтор delivery, reload и рестарт сервиса: один применённый ход, согласованное состояние/история, корректное завершение сессии. Не повторять принятые local storage fixes. |
| Q3 · живой GM + группа, A10/A11 | Сквозной create/join → персонаж → общий стол в этом срезе не исследован: **unknown**. | Группа действительно играет с живым ведущим. | Q1–Q2; персонаж/действие/правила contract. | Live-table gameplay agent | Независимые GM + 2 player clients проходят весь общий acceptance, включая скрытые данные GM, выход и reconnect; без AI как обязательной зависимости. |
| Q4 · AI GM + группа, A09/A10/A11 | Локальный `DmOrchestrator` не доказательство групповой очереди и серверного AI authority. Групповой режим: **unknown**. | AI ведёт группу, одновременные действия не конфликтуют и не удваивают вызовы. | Q1–Q2, исправленная orchestration recovery Q5, отдельное разрешение на real-provider test. | Group AI orchestration agent | 2 игрока + AI: порядок/отмена/ошибка/повтор, один committed результат на action ID, reconnect и общий мир; synthetic suite отдельно от разрешённого реального playtest. |
| Q5 · solo AI GM, остаток A09 | **Confirmed code gap**: `DmOrchestrator` пишет ошибки как fiction; `PlayModePanel` теряет исходный ввод. Полный solo lifecycle: **unknown**. | Один игрок может завершить ход, восстановиться после AI/NPC ошибки и продолжить без дублей. | Приёмка текущего DM recovery; общий сценарий персонажа/правил; Q2 для durable lifecycle. | Solo/orchestration agent | Реальный local browser path DM + NPC fan-out с failure/partial/timeout/cancel/retry; никакой ошибочной/частичной fiction в canon, неизменный draft/history на отказе; полный solo acceptance отдельно. |
| Q6 · UX/mobile, A10 | В runtime сохраняются смешанная локализация и мобильные особенности общей шапки; полный accessibility audit: **unknown**. | Во всех 3 режимах понятно следующее действие, ошибка и путь восстановления. | Q3–Q5 сценарии; существующие tokens/components. | UX/accessibility agent | Desktop + 390×844: видимые основные действия/ошибки, клавиатура/focus, reduced-motion, empty/loading/disabled/retry; screenshot + hit-target evidence. Не переделывать принятые A05/A06 editor slices. |
| Q7 · IP/provenance gate, A07/A08 | **Open**: текущий starter и DM examples всё ещё содержат excluded setting names; предварительный trademark screen не clearance. Imported-map status уже фиксирует provenance improvements; все export paths здесь не переаудированы. | Пользователь понимает источник/права контента; продукт не обещает несуществующую коммерческую готовность. | Отдельный clean-room slice; review current notices/IP guard; решение владельца и профильного юриста по названию. | Legal/content owner | Shipping scan + оригинальная замена narrative, точная SRD 5.1 CC-BY attribution и сохранение MIT notices, export provenance review; billing/marketing не открываются только по denylist или предварительному screen. |
| Q8 · release/playtest, A11 + readiness | Локальные suites не доказывают три игровые модели; CI/live auth/rollback/SLO состояние: **unknown** в этом срезе. | Предсказуемый запуск и восстанавливаемая игра, а не только green build. | Q1–Q7 и явное разрешение release/real-provider testing. | QA/release agent, A-00 принимает | Три независимых playtest receipts общего acceptance; CI browser checks с controlled failures, dependency/security gates, проверенные auth/rollback/SLO, согласованный release diff. Commit/push/deploy только отдельной командой. |

Принятое не дублируется: [campaign reliability / A01–A04 и Project Bible](CAMPAIGN-RELIABILITY-STATUS.md), [Map Workspace / A05–A06 и atomic deletion](MAP-WORKSPACE-STATUS.md), [Atlas editing](ATLAS-EDITING-STATUS.md). Их принятие не закрывает серверные/group/reconnect требования.
