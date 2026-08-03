# Eclipse DnD Forge — Дорожная карта

> Единый источник правды. README ссылается сюда. Обновляется на каждом отгруженном слайсе.

Последнее обновление: **2026-08-03** (slice 25 — доступная панель инструментов карты). Ветка: `main`.

> 🎯 **Стратегический вектор (зафиксирован 2026-05-12):** Eclipse DnD Forge — это не «набор помощников для мастера», а **настолка с ИИ-агентами**. Каждая сущность на визуальном графе — обращаемый агент (NPC / монстр / фракция / герой / DM). Agent-слой — это ядро архитектуры; генераторы энкаунтеров, кубики, трекеры инициативы — второстепенные инструменты, висящие на нём. Старые пункты «DM-tools» остаются в **Бэклоге**, но больше не определяют направление.

---

## 📥 Research intake — 2026-07-01

Источник: [Eclipse Library · July 2026 project integration](https://library.eclipse-forge.ru/#guide/july-2026-project-integration).

### TREK → маршруты, журнал партии и планирование

- [ ] **Party travel log** — журнал путешествия партии: точки маршрута, события по пути, заметки DM, последствия.
- [ ] **Route board** — визуальная доска маршрута между локациями: расстояние, опасность, ресурсы, случайные встречи.
- [ ] **Quest itinerary** — план квестовой ветки: куда идти, кого встретить, какие условия/таймеры активны.
- [ ] **Party polls** — быстрые голосования игроков: идти налево/направо, ночевать/рисковать, брать контракт/отказаться.
- [ ] **Shared checklist** — подготовка к сессии: инвентарь, заклинания, NPC, unresolved hooks.

Смысл: брать не туристическую механику как таковую, а паттерн **workspace вокруг путешествия**. Для DnD это превращается в campaign movement system.

---

## 📥 Research intake — 2026-07-13

Источник: [Eclipse Library · Applied project plan](https://library.eclipse-forge.ru/#guide/applied-project-plan-2026-07-13).

### Voice / session memory

- [ ] **Live session transcript** — запись голосовой партии → текст → recap → unresolved hooks → Session model.
- [ ] **Multilingual table mode** — Sokuji-style subtitles/translation для партий на разных языках. Сначала subtitles, потом translated mic output.
- [ ] **Consent-safe voices** — Fish Audio-style NPC/DM voices только для fictional/generated voices или с явным согласием игрока.

### Route / space references

- [ ] **Location board prompts** — AI interior design toolkit как источник prompt-паков для таверн, подземелий, домов NPC и городских сцен.
- [ ] **Travel workspace MVP** — объединить TREK-пункты в первый слайс: route board + party log + party polls.

### Guardrails

- Автономный DM остаётся player-gated: никакого runaway-loop без действия игрока.
- Голос/клон/перевод должны иметь явное состояние в UI: кто говорит, что переводится, есть ли consent.

---

## ✅ Сделано

### v0.3 slice 25 — доступная панель инструментов карты
*Отгружено 2026-08-03 после production QA сценария Azgaar.*

- [x] Вкладки «Герои и NPC» / «Мир и локации» больше не перекрываются быстрыми действиями при промежуточной ширине viewport: toolbar вынесен на отдельный ряд и безопасно переносится.
- [x] Группа действий получила семантику `toolbar` и понятное accessible name «Инструменты кампании».
- [x] Возвращён заметный `:focus-visible` для keyboard-навигации без постоянной рамки при клике мышью.
- [x] Добавлен UI regression contract; общий importer/security/UI suite содержит 6 тестов.

**Quality gate:** каждый push в `main` обязан пройти locked install без lifecycle scripts, typecheck, 6 tests, lint и production build до публикации GitHub Pages.

### v0.3 slice 24 — CI type-safety baseline и безопасные study messages
*Отгружено 2026-08-03 после первого полного lockfile/typecheck gate.*

- [x] Удалены накопленные `noUnusedLocals`/`noUnusedParameters` ошибки без ослабления strict TypeScript.
- [x] Hardcoded study entities/locations теперь проходят через те же node factories без требования выдуманных обязательных полей.
- [x] `clearEvents` сохраняет полный persisted auto-tick contract, а location node changes остаются типизированы как location nodes.
- [x] Study messages больше не используют `dangerouslySetInnerHTML`: текст React-escaped, а ссылка появляется только для валидного `https:` URL с `noopener noreferrer`.
- [x] Добавлен security regression contract; общий importer/security suite содержит 5 тестов.
- [x] Добавлен отсутствовавший ESLint config на уже зафиксированных TypeScript и React Hooks plugins; lint больше не является пустой package script. Legacy `any` и старые `@ts-ignore` вынесены из initial gate, но hooks order/dependencies, unused code и recommended correctness rules остаются blocking.

**CI:** run `30795363770` остановил deploy на inherited TypeScript baseline; run `30795999089` подтвердил typecheck и tests, затем обнаружил отсутствовавший ESLint config; run `30796727420` оставил только три несовместимости ESLint 8/9. После исправлений run `30796829029` успешно прошёл locked install, typecheck, 5 tests, lint, production build и публикацию GitHub Pages.

### v0.3 slice 23 — Azgaar world-map workflow 🗺️
*Отгружено 2026-08-03. Карта создаётся во внешнем специализированном редакторе, а кампания получает только проверенные location nodes.*

- [x] **`src/model/dnd/azgaarImport.ts`** — чистый bounded adapter официального Full/Minimal JSON: лимит 8 МБ, проверка `pack.burgs`, finite coordinates/population, удаление control/bidi characters, collapse повторов внутри файла и детерминированный приоритет столиц/укреплений/портов/населения.
- [x] **`src/view/dnd/MapWorkflowPanel.tsx`** — понятный трёхшаговый flow: скопировать campaign brief → открыть фиксированный официальный Azgaar URL → выбрать Minimal JSON и проверить preview до изменения кампании.
- [x] **Безопасные дефолты** — 24 значимых места по умолчанию, расширенный предел 60, существующие location names не дублируются, `.map` не разбирается и upstream runtime/iframe/dependencies не добавляются.
- [x] **Понятный результат** — preview показывает карту, версию, найденные места, дубли, пропуски и точное число новых узлов; повторный импорт того же файла добавляет 0 локаций.
- [x] Исправлен соседний runtime-дефект `VisualWritingInterface`: `selectedNodes` теперь объявляется до вычисления `selectedLocationId`, поэтому locations view не попадает в temporal dead zone.
- [x] Добавлен `.gitignore` для `node_modules`, build output, tsbuildinfo и локальных env-файлов.
- [x] Deploy gate переведён с mutable `npm i`/action tags на lockfile-only `npm ci`, immutable action SHA и обязательные typecheck + importer tests + lint + production build до публикации.

**Проверено локально:** synthetic importer suite (valid, duplicate, repeated, bounded modes, bidi-control, malformed, oversized и missing-schema JSON) зелёный на Node 24. Полный `npm ci` блокируется registry и не завершился за 300 секунд; typecheck/lint/build должны быть подтверждены CI до release.

### v0.1 slice 1 — D&D-ребрендинг точки входа
*Коммиты: `856a022`, `5977879`, `5a2902c`, `7bee46d`.*

- [x] Ребрендинг проекта (README, CLAUDE.md, имя пакета, лицензионная заметка)
- [x] Roadmap расширен R&D-направлениями (GPT-5.5, compression profiles, asset pipeline и т.д.)
- [x] **Launcher** переписан как Campaign Launcher с четырьмя D&D-стартерами: Фандалин (Lost Mine opener) · Баровия (Mists of Strahd) · Синдер-Холлоу (sandbox starter) · Пустая кампания
- [x] **Бренд-поверхность**: title в `index.html`, favicon, шапка Launcher, фэнтези-палитра
- [x] **Доменная модель** расширена (аддитивно, без поломок):
      - `Entity.kind` (`hero | npc | monster | faction | unknown`), `role`, `abilities` (STR/DEX/CON/INT/WIS/CHA), `hp`, `ac`, `cr`
      - `Location.kind` (`dungeon | town | wild | plane | stronghold`), `biome`, `danger` (1-10)
- [x] **Визуальное представление** новых полей:
      - Entity-ноды показывают цветной kind-бейдж + ярлык роли
      - Location-ноды показывают biome + danger-кольцо (зелёное / янтарное / красное по тиру) + бейдж ОПАСНОСТЬ N/10
- [x] **Extractor-промпты переписаны** в D&D-словарь:
      - `EntitiesExtractor` классифицирует на hero/npc/monster/faction через structured-output enum
      - `LocationExtractor` классифицирует на dungeon/town/wild/plane/stronghold с biome + danger
      - `JSONPrompt.getDefaultValue` научился `ZodEnum`, чтобы partial-стриминг рендерился на лету
- [x] **Вкладки** переименованы: «Герои и NPC» / «Мир и локации» с фэнтези-иконками
- [x] **HCI study-роуты** (`/study`, `/baseline`) убраны из Launcher (остаются в `App.tsx` для исследовательских реплеев; не вынесены как продуктовая фича)

**Проверено:** ручной TypeScript-ревью (npm install падал с `ECONNRESET` к npm registry в той сессии).

### v0.2 slice 1 — Генератор NPC ✨
*Отгружено 2026-05-11.*

- [x] Промпт `NpcGenerator` — структурированный JSON полного 5e NPC (имя, эмодзи, kind, role, 6 характеристик, hp, ac, cr, DM-зацепка). Привязан к уровню партии + локации + враждебности + заметкам DM.
- [x] `generateNpcIntoScene` — генерирует, гидрирует `Entity` всеми D&D-полями, добавляет в граф, перезапускает layout.
- [x] UI: кнопка «Сгенерировать NPC» в тулбаре вкладки «Герои и NPC».
- [x] Inline-форма — раса / занятие / уровень партии / локация / враждебность / заметки DM.
- [x] Карточка результата: HP/AC/CR + 6 характеристик как чипы, блок DM-зацепки, «Создать ещё» + «Готово».
- [x] Кнопка «Очистить холст» (корзина) переехала в ту же группу тулбара со своим тултипом.

### v0.2 slice 2 — Living NPCs (фундамент Agent-слоя) 🧠
*Отгружено 2026-05-12. Стратегический разворот: каждая сущность становится обращаемым ИИ-агентом.*

- [x] **Расширение модели** — `Entity.goal` (DM-видимая мотивация), `Entity.secret` (скрытое), `Entity.knowledge[]` (конкретные факты). Всё опционально, аддитивно.
- [x] **Апгрейд схемы `NpcGenerator`** — теперь также возвращает goal + secret + 3-5 пунктов knowledge. Старый путь генератора совместим.
- [x] **Seed-кампании заполнены** — NPC Фандалина / Баровии / Синдер-Холлоу (10+ персонажей) получили рукописные goal / secret / knowledge, чтобы демо с первого клика срабатывало.
- [x] **Agent-слой (`src/model/agents/NpcAgent.ts`)** — `buildNpcSystemPrompt` собирает полный in-character system prompt (карточка персонажа, knowledge, goal, secret, текст сцены, другие присутствующие сущности, RP-правила). `runNpcDialogue` стримит ответ через chat-completions.
- [x] **Состояние агента (`src/store/useAgentStore.ts`)** — Zustand-стор с per-entity чат-историей (`Record<entityId, AgentMessage[]>`), флаг стриминга, append / clear API. История переживает закрытие/открытие панели в рамках сессии.
- [x] **UI диалога (`src/view/dnd/NpcDialoguePanel.tsx`)** — чат-панель по id сущности: аватар + имя + роль + kind-бейдж, сворачиваемый DM-only контекст (goal/secret), скроллящийся лог разговора со стриминг-рендерингом, отправка + очистка, in-character error fallback.
- [x] **Подключение (`VisualWritingInterface.tsx`)** — когда выбрана ровно одна entity-нода на вкладке «Герои и NPC», рядом с «Сгенерировать NPC» появляется кнопка «Поговорить». Клик → открывает панель диалога; смена выбора при открытой панели перетаргетит её; открытие генератора NPC закрывает диалог и наоборот.

### v0.2 slice 3 — DM-агент 👑
*Отгружено 2026-05-12 (та же сессия). Второй тип агента на той же архитектуре.*

- [x] **`src/model/agents/DmAgent.ts`** — `buildDmSystemPrompt` собирает system prompt нарратора/арбитра: полный текст сцены + все сущности (kind + role) + все локации (kind + biome + danger) + история разговора. Строгие правила запрещают упоминание игровой механики и требуют отвечать на языке игрока.
- [x] **Константа `DM_AGENT_ID`** — спец-ключ переиспользует `useAgentStore`, чтобы история DM лежала в том же сторе, что и истории NPC (без дублирования state-машинерии).
- [x] **`src/view/dnd/DmAgentPanel.tsx`** — широкая чат-панель (440px) с короной в шапке, multi-paragraph рендеринг. Пустое состояние показывает примеры промптов на трёх языках.
- [x] **Подключение в тулбар** — глобальная кнопка «Запустить сцену с AI DM» (корона), видна на обеих вкладках. DM-панель взаимоисключающа с панелями диалога NPC и генератора NPC.

### v0.2 slice 4 — Hook → инъекция в редактор 📜
*Отгружено 2026-05-12 (та же сессия). Связывает Agent-слой обратно с каноническим текстом сессии.*

- [x] **`src/model/agents/sessionInjector.ts`** — `appendParagraphToSession(text)` и `appendNpcQuoteToSession(speakerName, text)` добавляют новый Slate-параграф в текст сессии через существующий путь `setTextState` (undo/redo + visual-refresh staleness работают автоматически). Реплики NPC получают `**Имя:**` bold-префикс для естественного чтения.
- [x] Кнопки **«Вставить в сессию»** добавлены на трёх поверхностях:
      - Реплики в диалоге NPC — кнопка под каждым ответом, в формате цитируемой речи
      - Нарратив DM — кнопка под каждым битом DM, вставляется как обычный параграф
      - Блок зацепки в генераторе NPC — кнопка на карточке результата
- [x] Все три кнопки используют одну иконку scroll-quill + пергаментный стиль — жест «промоутировать в канон» единообразен по всему продукту.

### v0.2 slice 5 — Multi-provider AI 🔀
*Отгружено 2026-05-12. Cost-control и privacy-история для разговорных путей.*

- [x] **`src/model/ai/types.ts`** — провайдер-нейтральный интерфейс `AiProvider` с `streamChat(messages, options) → AiStreamResult`. Опции несут модель, температуру, abort-signal и `onPartial` чанк-callback. Провайдер-нейтральная форма `AiMessage`.
- [x] **`src/model/ai/OpenAIProvider.ts`** — обёртка над существующим стриминг-путём `openai.chat.completions.create`. Модель по умолчанию: `gpt-4o-2024-08-06`.
- [x] **`src/model/ai/OllamaProvider.ts`** — self-hosted HTTP-клиент Ollama. Зовёт `POST /api/chat` с `stream: true`, парсит NDJSON-чанки, отдаёт ошибки чисто. Base URL по умолчанию: `http://localhost:11434`, модель: `llama3.2`. Включает заметки для пользователя (pull модели + `OLLAMA_ORIGINS="*"` для CORS).
- [x] **`src/store/useAiConfigStore.ts`** — Zustand-стор с localStorage-персистентностью. Держит id провайдера + per-provider конфиг. Экспортирует `currentProvider()` и `currentModel()` для не-React вызывающих.
- [x] **`NpcAgent` и `DmAgent`** — оба переведены через `currentProvider().streamChat(...)`. Прямых ссылок на `openai` в разговорном пути больше нет.
- [x] **Launcher UI** — вкладка провайдера (OpenAI / Ollama) на стартовом экране. Provider-aware гейтинг старта кампании: Ollama не требует ключа.

### v0.2 slice 6 — Anthropic-провайдер + Fallback chain 🔀⛓️
*Отгружено 2026-05-12. Провайдерная история завершена — три реальных провайдера + путь мягкой деградации.*

- [x] **`src/model/ai/AnthropicProvider.ts`** — Claude через `POST /v1/messages` со `stream: true`. Выносит system prompt отдельно (форма Anthropic API). Парсит SSE `data: {...}` строки, потребляет `content_block_delta` текст-дельты, отдаёт inline `error`-события. Прямые из браузера вызовы используют opt-in заголовок `anthropic-dangerous-direct-browser-access` (только локальный прототип).
- [x] **`src/model/ai/FallbackProvider.ts`** — оборачивает упорядоченный список провайдеров. Пробует каждый по очереди; при ошибке логирует и идёт к следующему. Сбрасывает видимый partial в `""` между провайдерами, чтобы чат-пузырь не показывал сломанный фрагмент. Агрегирует ошибки и бросает, если все упали.
- [x] **`useAiConfigStore` v2** — добавляет `anthropicApiKey`, `anthropicModel`, `useFallback`. Storage-ключ поднят до `eclipse_dnd_ai_config_v2`. `getProvider()` возвращает `FallbackProvider`, когда `useFallback` включён, с порядком цепочки `[primary, ...eligible others]`.
- [x] **Launcher обновлён** — третья вкладка «Anthropic Claude (облако)» с полями ключа + модели. Под вкладками — чекбокс «Включить fallback chain» с объяснением.
- [x] **`AiProviderId` расширен** до `"openai" | "ollama" | "anthropic"`, `AiProvider.id` принимает `AiProviderId | "fallback"`.

### v0.2 slice 7 — DM ↔ NPC cross-reference 🪶
*Отгружено 2026-05-12. Непрерывность между нарративом DM и per-NPC чатом.*

- [x] **`src/model/agents/dmCrossReference.ts`** — `extractNpcQuotes(dmText, entityNodes)` парсит строки `**Имя:** ...` из вывода DM. Фильтрует на сущности, существующие в текущем графе мира (точное совпадение имени без учёта регистра).
- [x] **`mirrorDmQuotesToNpcHistories(quotes)`** — добавляет каждую цитату как `assistant`-сообщение в чат-историю этого NPC. Перед первым зеркалированием добавляет одноразовую `user`-рамку для когерентности контекста.
- [x] **DmAgentPanel подключён** — после завершения хода DM extract + mirror запускаются автоматически. Зелёный индикатор «Реплики DM зеркалятся в чат-историю: …» подтверждает, кто получил строки.

### v0.2 slice 8 — Insert-at-cursor ✒️
*Отгружено 2026-05-12. Промоутирует вывод агента туда, где сейчас редактирует автор.*

- [x] **`insertTextAtCursor(text)` и `insertNpcQuoteAtCursor(speaker, text)`** добавлены в `sessionInjector.ts`. Используют `Transforms.insertText(globalEditor, ..., { at: editor.selection })`. Откатываются на `appendParagraphToSession`, когда нет выделения.
- [x] **Все три кнопки Insert** (реплики NPC, нарратив DM, зацепка генератора NPC) переключены с append-в-конец на cursor-aware. Тултипы обновлены.
- [x] **Учтена нормализация Slate** — редактор в этой кодовой базе склеивает несколько параграфов в один со встроенными `\n`, так что вставка `\n` + текст — правильная форма.

### v0.2 slice 9 — Combat AI ⚔️
*Отгружено 2026-05-12. Третий тип агента на той же архитектуре — монстры как тактические советники.*

- [x] **`src/model/agents/CombatAgent.ts`** — `buildCombatSystemPrompt(ctx)` собирает промпт *DM-side боевого советника*: полная карточка существа (вкл. goal), герои / NPC / другие присутствующие существа, нарратив поля боя. Строгие правила вывода: одно предложение, настоящее время, без упоминания механики, без запросов бросков, на языке игрока.
- [x] **`suggestCombatTactic(monsterEntityId, onPartial)`** — single-shot стриминг-вызов через тот же `currentProvider()` пайплайн — прозрачно поддерживает OpenAI / Ollama / Anthropic / Fallback chain.
- [x] **NpcDialoguePanel — блок «Боевой AI»** — виден только когда выбранная сущность `kind === "monster"`. Показывает предложенную тактику курсивом + кнопка «Вставить тактику».
- [x] Одно-предложенные предложения намеренно decision-only: DM всё ещё нарративизирует фактический исход, агент остаётся в роли советника.

### v0.2 slice 10 — Off-screen World Tick 🌍⏳
*Отгружено 2026-05-13. Петля «живого мира» — сущности действуют между сессиями, даже когда DM не за столом.*

- [x] **`src/model/agents/WorldTickAgent.ts`** — `buildWorldTickSystemPrompt(ctx)` собирает промпт world-симуляции для ОДНОЙ сущности за раз. Вывод — JSON-объект (`{action, consequence?}`), парсится вручную, так что тот же код работает на Ollama и Anthropic. Прощающий парсер; некорректные ответы всплывают как `raw`-only события вместо краша всего батча.
- [x] **`runWorldTick({onEventCommitted, tickId?})`** — оркестратор, который итерирует каждую сущность с `goal` (только NPC / монстры / фракции — герои исключены), запускает тики параллельно с concurrency cap 3.
- [x] **`src/store/useWorldEventStore.ts`** — Zustand-журнал событий с `localStorage`-персистентностью. Хард-кап 200 событий. Трекает `insertedIds` и `currentTickId`-фильтр.
- [x] **`src/view/dnd/WorldTickPanel.tsx`** — широкая чат-подобная панель: баннер eligibility, кнопка «Продвинуть мир» (стримит события по мере поступления), карточка на каждое событие + кнопка «Вставить». «Вставить все в сессию» консолидирует весь тик в один блок.
- [x] **Cross-reference в чат-историю** — каждое off-screen действие также зеркалится в чат-историю сущности.
- [x] **Подключение в тулбар** — глобальная кнопка «⏳ Продвинуть мир» рядом с DM.

### v0.2 slice 11 — DM ↔ World Tick awareness 🔗
*Отгружено 2026-05-13. Замыкает петлю: тики происходят → нарратив DM естественно их упоминает.*

- [x] **Watermark в `useWorldEventStore`** — поле `lastDmAcknowledgedAt` (персистится в localStorage). Действие `markDmAcknowledged()` поднимает его; селектор `getEventsForDm()` возвращает только события с `action` и `createdAt > lastDmAcknowledgedAt`.
- [x] **`buildDmSystemPrompt` расширен** — добавляет секцию «OFF-SCREEN EVENTS SINCE YOUR LAST NARRATION», когда есть pending-события. Строгая инструкция: вплести хотя бы одно естественно, не перечислять игрокам списком.
- [x] **`runDmTurn`** — тянет до 20 свежих pending-событий в контекст, зовёт `markDmAcknowledged()` только при успешном стриме.
- [x] **Индикатор в DmAgentPanel** — живой чип «🌍 N событий за кулисами ждёт», реактивно подписан на стор.

### v0.2 slice 12 — World Tick auto-scheduling ⏱️
*Отгружено 2026-05-13. Мир может продвигаться сам, пока приложение открыто.*

- [x] **Enum `WorldTickInterval` + lookup-таблицы** в `useWorldEventStore`: `off | 5min | 15min | 1h | 4h`, с label- и millisecond-картами. По умолчанию `off`.
- [x] **Два новых персистируемых поля**: `autoTickInterval` и `lastAutoTickAt`.
- [x] **Действия стора `setAutoTickInterval()` + `markAutoTicked()`**. Ручные тики тоже зовут `markAutoTicked()`, чтобы авто-планировщик не сработал сразу после клика.
- [x] **Settings-строка в `WorldTickPanel`** — Select со всеми пятью каденциями + подпись «Последний тик: ЧЧ:ММ:СС».
- [x] **Эффект авто-планировщика в `VisualWritingInterface`** — поллит каждые 30с, срабатывает когда `Date.now() - lastAutoTickAt >= intervalMs`. Только in-tab — закрытие вкладки ставит планировщик на паузу.

### v0.2 slice 13 — Cross-provider structured outputs 🔌
*Отгружено 2026-05-13. Освобождает entity/location-экстракторы и генератор NPC от жёсткой зависимости от OpenAI.*

- [x] **`AiProvider.generateStructured<T>(messages, spec, options)`** — новый метод интерфейса провайдера. Возвращает типизированное значение, провалидированное против zod-схемы. Бросает при провале валидации, чтобы FallbackProvider мог перейти к следующему провайдеру.
- [x] **`src/model/ai/zodToJsonSchema.ts`** — минимальный in-house конвертер для zod-форм, которые реально использует Eclipse DnD Forge (object / array / string / number / boolean / enum / optional). ~40 строк.
- [x] **`OpenAIProvider.generateStructured`** — использует `zodResponseFormat`.
- [x] **`AnthropicProvider.generateStructured`** — использует tool-use. Объявляет один tool с `input_schema` из zod-схемы, форсит `tool_choice`, извлекает payload из `tool_use` блока.
- [x] **`OllamaProvider.generateStructured`** — использует `format: "json"` + инжектит JSON Schema в system prompt. Парсит + валидирует zod'ом.
- [x] **`FallbackProvider.generateStructured`** — та же chain-семантика, что и `streamChat`.
- [x] **Рефактор `JSONPrompt`** — ветвится по активному конфигу: OpenAI без fallback → существующий стриминг-путь; всё остальное → `currentProvider().generateStructured`.
- [x] **Текст Launcher обновлён** — убран дисклеймер «structured outputs только для OpenAI».

### v0.2 slice 14 — Генератор энкаунтеров ⚔️🎲
*Отгружено 2026-05-13. Классический DM-инструмент, теперь усиленный Agent-стеком под ним.*

- [x] **`src/model/prompts/generators/EncounterGenerator.ts`** — `EncounterGenerator` возвращает структурированный payload: группы монстров (каждая с боевой ролью, количеством, полным statblock, goal, knowledge) + environmental twist + XP-budget estimate. Использует cross-provider structured-output путь.
- [x] **`calcXpBudget(level, size, difficulty)`** — таблица XP-бюджета из DMG 2014 встроена. Показывается в UI для sanity-check.
- [x] **`generateEncounterIntoScene`** — спавнит каждую группу монстров как новые `EntityNode` (`kind: monster`, полные статы, goal, knowledge), multi-count группы получают суффиксы `#N`.
- [x] **`src/view/dnd/EncounterGeneratorPanel.tsx`** — панель по выбранной локации: форма уровень/размер/сложность/заметки, живой XP-budget readout, блок результата + кнопка «Вставить в сессию».
- [x] **Подключение** — на вкладке «Мир и локации», когда выбрана ровно одна location-нода, в тулбаре появляется кнопка-секира.
- [x] **Combat AI заранее подключён** — сгенерированные монстры несут goal + knowledge, так что кнопка «Предложить тактику» работает на них из коробки.

### v0.2 slice 15 — Трекер инициативы 🗡️
*Отгружено 2026-05-13. Чистое состояние, без AI — но тянет живые данные из графа мира.*

- [x] **`src/store/useInitiativeStore.ts`** — Zustand-стор с localStorage-персистентностью: упорядоченный `InitiativeEntry[]`, `activeIndex`, `round`, флаг `active`. Действия: `addEntry`, `removeEntry`, `updateEntry`, `startCombat`, `nextTurn`, `endCombat`, `clearAll`.
- [x] **`src/view/dnd/InitiativePanel.tsx`** — панель тулбара: чип-ряд сущностей, ещё не в трекере (один клик → авто-бросок d20 + мод. ЛОВ); форма ручного добавления; упорядоченный список с подсветкой активного хода, inline-редактор HP; нижние кнопки — Начать бой / Следующий ход / Завершить бой / Очистить.
- [x] **Подключение в тулбар** — глобальная кнопка `🗡️` рядом с World Tick.

### v0.2 slice 16 — Кубики 🎲
*Отгружено 2026-05-13. Чистая утилита — без AI-вызовов.*

- [x] **`src/model/dice.ts`** — `parseDiceExpression(raw)` + `rollDice(expr)` + `formatRoll(result)`. Поддерживает `dX`, `NdX`, `NdX±M` с sanity-границами.
- [x] **`src/view/dnd/DiceRollerPanel.tsx`** — кнопки быстрых бросков d4/d6/d8/d10/d12/d20/d100, ввод произвольного выражения, история на 30 записей с вставкой в один клик.
- [x] **Кнопка «Найти и бросить все `/roll …` в сессии»** — regex находит каждый токен `/roll <выражение>` в тексте сессии, бросает и заменяет результатом.
- [x] **Подключение в тулбар** — глобальная кнопка `🎲` рядом с Initiative.

### v0.2 slice 17 — D&D-aware текстовые редакторы ⚙️
*Отгружено 2026-05-13. Слайдер на стате переписывает текст сессии механически-осознанно.*

- [x] **`ChangeHpPrompt`** — новый подкласс TextEditPrompt. Маппит дельту HP на лестницу тяжести (царапина → ранен → без сознания; подлечен → полностью исцелён). Просит модель переписать текст сессии, отражая состояние, без упоминания цифр / AC / кубиков / механики.
- [x] **`ChangeDangerPrompt`** — тот же паттерн для `Location.danger`. 1-3 = мирно, 4-6 = тревожно, 7-9 = активно опасно, 10 = смертельно. Переписывает только атмосферное / сенсорное описание локации.
- [x] **HP-слайдер на `EntityNodeComponent`** — появляется под слайдерами свойств, когда у сущности `hp > 0` и она выбрана. Drag-end обновляет стат + запускает `ChangeHpPrompt`.
- [x] **Danger-слайдер на `LocationNodeComponent`** — поп-ап под location-нодой при выборе. Drag-end обновляет стат + запускает `ChangeDangerPrompt`.
- [x] **Без новой TextEditPrompt-машинерии** — оба класса вставляются в существующий пайплайн `execute() → TextPrompt → finalize`.

### v0.2 slice 18 — Сессии как first-class слой 📖
*Отгружено 2026-05-13. Главы кампании с AI-recap'ами, которые возвращаются в DM-контекст.*

- [x] **Модель `CampaignSession` + `useSessionStore`** — `{id, name, startedAt, endedAt, text, recap?}`, персистится в `eclipse_dnd_sessions_v1`. Хард-кап 100 сессий.
- [x] **`SessionRecapAgent.generateSessionRecap()`** — plain-text стриминг-вызов через `currentProvider()`. 2-4 предложения в прошедшем времени, упоминает NPC по именам, без упоминания механики, на языке кампании.
- [x] **`SessionsPanel`** — форма завершения текущей сессии (авто-имя, опция skip-recap), error fallback, который архивирует сессию даже при провале recap'а, список архивных сессий с regenerate-recap и удалением.
- [x] **Расширение контекста DM-агента** — `DmAgentContext.recentSessions`. До 3 свежих архивных сессий складываются в system prompt как блок «PREVIOUSLY ON THIS CAMPAIGN».
- [x] **Сущности / локации / world events переживают сессии** — сессии это главы одного мира кампании, а не отдельные миры.
- [x] **Подключение в тулбар** — кнопка `📖` рядом с Кубиками.

### v0.2 slice 19 — Переписывание по характеристикам 🎯
*Отгружено 2026-05-13. Закрывает трио v0.2 «D&D-aware редакторов» (HP / danger / ability).*

- [x] **`ChangeAbilityScorePrompt`** — сестра ChangeHpPrompt / ChangeDangerPrompt. У каждой из 6 характеристик (STR/DEX/CON/INT/WIS/CHA) есть narrative-маппинг high/mid/low, сфокусированный на том, что заметил бы СТОРОННИЙ наблюдатель.
- [x] **Tier-aware skip** — промпт пропускает себя (`canBeExecuted = false`), когда старое и новое значение в одном тире (low ≤8, mid 9-15, high ≥16). Косметичные перетаскивания 14 → 15 не жгут API-вызов.
- [x] **Шесть слайдеров в сворачиваемом `<details>`** на выбранных entity-нодах — рендерятся только при наличии блока `abilities`.

### v0.2 slice 20 — Полная RU-локализация 🇷🇺
*Отгружено 2026-05-14. Весь интерфейс, README и ROADMAP на русском.*

- [x] **UI** — Launcher (вкладки провайдеров, поля, гейтинг), обе вкладки + все тултипы тулбара, campaign templates (заголовки + подзаголовки), все 8 панелей (NpcDialogue, NpcGenerator, DmAgent, EncounterGenerator, WorldTick, Initiative, Dice, Sessions), kind-бейджи и слайдеры на EntityNode/LocationNode, плейсхолдеры в редакторах сущностей/локаций.
- [x] **Сообщения об ошибках** — user-facing fallback'и в агентах и провайдерах (`(тик не удался: …)`, «Все AI-провайдеры недоступны», «Anthropic: API-ключ пуст»).
- [x] **`WORLD_TICK_INTERVAL_LABELS`** в сторе переведены.
- [x] **`README.md`** — полный перевод (статус, стратегический вектор, demo + быстрый старт, «Что внутри», gameplay loop, стек, структура, безопасность ключей).
- [x] **`ROADMAP.md`** — целевой перевод всего файла; код-идентификаторы, пути файлов и SHA коммитов оставлены как есть.
- Намеренно оставлено на английском: содержимое system-промптов (модели лучше работают с EN-инструкциями; агенты получают инструкцию «отвечай на языке игрока»), seed-кампании текст + backstory NPC (reference-данные, AI адаптирует под язык чата), CLAUDE.md (для AI-агентов-разработчиков).

### v0.3 slice 21 — Автономный режим игры: оркестратор хода 🎲
*Отгружено 2026-05-14. Первый слайс мини-арки «автономный AI DM» — стол начинает играть сам.*

- [x] **`src/store/useGameLoopStore.ts`** — Zustand-стор play-сессии (не персистится — эфемерное рабочее состояние, канон это текст сессии). `phase` (`idle | awaiting-player | dm-narrating | npc-reacting`), упорядоченный `turnLog` из beat'ов (player / dm / npc), счётчик `turn`, `activeStreamId` для стриминга в нужную запись. Действия `start / stop / reset / appendEntry / updateStreamingEntry`.
- [x] **`src/model/agents/DmOrchestrator.ts`** — `runGameTurn(playerInput)` проводит один ход end-to-end: (1) записывает действие игрока → (2) `DmAgent` стримит нарратив последствия → (3) `**Имя:**`-цитаты DM зеркалятся в чат-историю NPC (переиспользует `dmCrossReference`) → (4) **роутинг**: NPC, названные игроком по имени и НЕ озвученные уже самим DM, отвечают своими голосами через `runNpcDialogue` → (5) возврат к `awaiting-player`. Цикл всегда player-gated → нет runaway-риска; единственный кап — `MAX_REACTING_NPCS = 3`.
- [x] **Роутинг по имени** — `selectReactingNpcs` матчит имя NPC (полное или первый токен) в действии игрока через whole-word-проверку, устойчивую к кириллице (`\b` ненадёжен). Реагируют только `npc` / `monster`. NPC получают cue из действия игрока + сжатый бит сцены DM, чтобы реакция была grounded до промоушена beat'ов в канон.
- [x] **`src/view/dnd/PlayModePanel.tsx`** — панель play-режима (480px): стартовый экран → транскрипт с раздельной стилизацией player / DM / NPC beat'ов → статус-чип фазы + счётчик хода → инпут (активен только в `awaiting-player`). На каждом beat'е кнопка «Вставить в сессию» (DM/NPC через существующие `insert*AtCursor`). «Завершить игру» = `reset()`.
- [x] **Подключение в тулбар** — глобальная кнопка 🎲 (`GiMeeple`) первой в группе. Взаимоисключающа со всеми остальными панелями (проводка close в обе стороны). Закрытие панели ≠ конец игры — `turnLog` переживает re-open в рамках сессии.

**Проверено:** ручной TypeScript-аудит всех файлов (strict). `npm run build` локально не прогонялся (ECONNRESET) — деплойный CI билдит через `vite build` (без `tsc`-gate).

---

## 🚧 Активный слайс

### v0.3 slice 22 — Автономный AI DM: авто-роутинг боя ⚔️🤖
Продолжение мини-арки. Когда `runGameTurn` детектит, что действие игрока инициирует бой (или активен трекер инициативы), оркестратор должен подключать `CombatAgent` для монстров вместо / вместе с `NpcAgent` — тактическое предложение становится частью хода, а не ручной кнопкой. Плюс: интеграция world-tick в play-loop (pending-события вплетаются в DM-бит прямо в режиме игры).

---

## 🎯 Следующее (мелкое, ограниченное)

### Открытые follow-ups

- [ ] **ActionEdge → SceneBeat** — исторический Action-таймлайн всё ещё чисто нарративный; Session-aware тип scene-beat связал бы рёбра таймлайна с новой моделью Session, чтобы таймлайн мог показывать разделители глав.
- [ ] **Авто-завершение сессии по эвристике** — ненавязчивая подсказка «вы написали 2000+ слов с последней архивированной сессии, заархивировать сейчас?»

---

## 🏰 Бэклог (крупное / R&D)

Из изначального roadmap v0.3-v1.0, сохранено:

- Процедурный генератор подземелий + hex-карта мира
- Campaign Map Asset v1: versioned Azgaar metadata, selected burg ids, roads/states mapping и re-import diff
- Fog of War для вида игрока
- Temporal world states (древняя / разрушенная / текущая версия локации)
- Upscale-пайплайн для портретов и карт
- VIGA — генерация 3D-сцен из скетчей
- Листы персонажей, трекер инвентаря и лута
- Экспорт кампании в PDF / Markdown
- Мультиплеер (виды игроков против вида DM)
- Полностью автономный режим AI DM
- Импорт/экспорт D&D Beyond / Roll20
- Ambient-аудио для сцен
- Cinematic NPC-брифинги (портретные аватары, голосовые профили)

---

## 🧱 Известный легаси / долг

- `src/study/*` — HCI study-каркас из VisualStoryWriting, нетронут. Не часть продуктовой поверхности, но всё ещё в бандле.
- Тип `Action` всё ещё представляет generic narrative actions — нужен рефрейминг в «scene beats» внутри Session-контейнера.
- `dangerouslyAllowBrowser: true` на OpenAI-клиенте — норм для локального прототипа, перед любым хостед-релизом нужно маршрутизировать через бэкенд.
- Build-статус: `npm run build` не запускался локально с момента отгрузки v0.1-слайса из-за повторяющихся `ECONNRESET` к npm registry в dev-окружении. Деплой на GitHub Pages при этом работает (workflow билдит на своём CI). Прогнать локально и зафиксировать здесь, когда сеть позволит.

---

## Как обновлять этот файл

Когда отгружаешь слайс:
1. Поставь галочку на пункте под **Активный слайс** или **Следующее**, перенеси его под **Сделано** с SHA коммита.
2. Подними один пункт из **Следующее** в **Активный слайс**, если слот свободен.
3. Обнови дату «Последнее обновление» сверху.
4. Держи файл осмысленным — пункты бэклога это указатели, не спеки.
