<div align="center">

# ⚔️ Eclipse DnD Forge

### AI Campaign Manager — настолка с ИИ-агентами и картой мира

**🌐 Live demo: <https://dnd.eclipse-forge.ru/>**

[![React](https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vite.dev)
[![Tailwind](https://img.shields.io/badge/Tailwind-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![MIT](https://img.shields.io/badge/License-MIT-22c55e?style=for-the-badge)](LICENSE)

> **Статус:** ✅ v0.3 — 32 продуктовых слайса поверх форка [VisualStoryWriting](https://github.com/m-damien/VisualStoryWriting). Agent runtime, 3 провайдера, persistent living-world loop, Azgaar workflow, Eclipse identity canary и responsive workspace. Интерфейс полностью на русском.

</div>

---

## Что это

Eclipse DnD Forge — **операционная система мастера D&D на ИИ-агентах**. Не просто генератор контента и не просто чат с AI — каждая сущность на визуальном графе является **обращаемым агентом**: NPC, монстр, фракция или сам DM. Мир продолжает жить между сессиями, события подхватываются нарратором, реплики переносятся в канонический текст сессии одним кликом.

Форк [VisualStoryWriting](https://github.com/m-damien/VisualStoryWriting) (MIT). Визуальный граф `@xyflow/react` сохранён, всё остальное переработано под D&D + agent-first архитектуру.

### Стратегический вектор

> **Настолка с ИИ-агентами**, а не «набор помощников для мастера».
>
> Генератор энкаунтеров, кубики и трекер инициативы — второстепенные инструменты, висящие на agent-слое. Сначала строится `AiProvider`-абстракция + agent runtime, всё остальное — частные случаи поверх.

---

## 🎮 Demo + быстрый старт

### Попробовать online

**<https://dnd.eclipse-forge.ru/>**

Если у пользователя уже открыт Eclipse Chat, самый короткий путь — меню профиля
**DnD Forge** или **Настройки → Данные и связи → Подключить DnD Forge**. DnD автоматически
откроет безопасный PKCE S256 вход, а после подтверждения получит только публичное имя и
внутренний ID. Email, пароль, Chat-токены и история сообщений не передаются.

При открытии нужно выбрать AI-провайдера. OpenAI/Anthropic key хранится только в `sessionStorage` текущей вкладки, не добавляется в URL и удаляется при закрытии вкладки. Он всё равно передаётся выбранному cloud provider, поэтому для demo нужен отдельный ограниченный key, а не основной production credential. Поддерживаются:

- **Eclipse AI** (managed, инфраструктура активна, UI скрыт) — вход через Eclipse Chat, server-side secrets и per-user budgets; отдельный `#/auth/canary` проверяет identity без включения моделей, а сам provider появится после authenticated canary, rollback и 24h SLO
- **OpenAI** (cloud) — `gpt-4o` по умолчанию, нужен ключ с <https://platform.openai.com>
- **Anthropic Claude** (cloud) — `claude-opus-4-7` по умолчанию, нужен ключ с <https://console.anthropic.com>
- **Ollama** (self-hosted) — локальный daemon, ключ не нужен. Запускать с `OLLAMA_ORIGINS="*"` чтобы браузер мог достучаться

Опционально: **fallback chain** — активный провайдер первым, остальные с валидным конфигом по очереди при ошибках.

### Локально

```bash
git clone https://github.com/PavelHopson/eclipse-dnd-forge.git
cd eclipse-dnd-forge
npm ci --ignore-scripts --no-audit
npm run dev
```

Откроется на `http://localhost:5173`. Несекретные provider settings переживают reload через `localStorage`; cloud keys переживают только reload текущей вкладки через `sessionStorage`.

---

## 🎲 Что внутри (v0.2)

### Agent layer — 4 типа агентов на единой архитектуре

| Агент | Что делает | Файл |
|---|---|---|
| **`NpcAgent`** | Диалог с любой entity на графе. Помнит контекст, имеет `goal`, `secret`, `knowledge[]`. Не выдаёт secret без давления, говорит на языке игрока. | [`src/model/agents/NpcAgent.ts`](src/model/agents/NpcAgent.ts) |
| **`DmAgent`** | Глобальный нарратор/арбитр. Получает полный сцен-текст + все сущности + локации + recap'ы прошлых сессий + pending world-tick events. | [`src/model/agents/DmAgent.ts`](src/model/agents/DmAgent.ts) |
| **`CombatAgent`** | Тактический советник для монстров. Предлагает одно действие хода с мотивацией, без mention'а механики. | [`src/model/agents/CombatAgent.ts`](src/model/agents/CombatAgent.ts) |
| **`WorldTickAgent`** | Off-screen симуляция. Каждая NPC/monster/faction с `goal` совершает одно действие между сессиями. | [`src/model/agents/WorldTickAgent.ts`](src/model/agents/WorldTickAgent.ts) |
| `SessionRecapAgent` | Авто-генерация recap'а на End-session. 2-4 предложения, упоминает NPC по именам. | [`src/model/agents/SessionRecapAgent.ts`](src/model/agents/SessionRecapAgent.ts) |

### Provider layer — 3 backend + fallback

```
                ┌─────────────────────────────┐
NpcAgent ────→  │  currentProvider()          │
DmAgent  ────→  │   из useAiConfigStore       │
Combat   ────→  │                             │
WorldTick────→  │  streamChat()               │
JSONPrompt────→ │  generateStructured()       │
                └──────────────┬──────────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        ▼                      ▼                      ▼
 OpenAIProvider        OllamaProvider          AnthropicProvider
 response_format       format: "json"            tool-use
 (streaming)           NDJSON                   SSE + tool block
                               │
                               ▼
                      FallbackProvider
                      (опционально оборачивает chain)
```

Структурированный вывод (`generateStructured<T>`) работает на всех трёх — entity extractors, NPC Generator, Encounter Generator больше не привязаны к OpenAI.

### Living world

- **Off-screen World Tick** — все сущности с `goal` действуют off-screen параллельно (concurrency cap 3)
- **Auto-scheduling** — off / 5min / 15min / 1h / 4h, persisted timer переживает reload
- **DM ↔ Tick awareness** — pending events автоматически складываются в DM system prompt с инструкцией "weave at least one in naturally"
- **DM ↔ NPC cross-reference** — когда DM воспроизводит `**Toblen:** "..."`, реплика мирится в chat-историю Toblen для будущих диалогов
- **Persistent event log** — 200 событий cap, localStorage
- **Sessions** — главы с AI-recap'ом. Последние 3 recap'а уходят в "PREVIOUSLY ON THIS CAMPAIGN" блок DM-промпта

### Классические DM-инструменты

- **NPC Generator** — полный 5e statblock + hook + goal + secret + knowledge
- **Encounter Generator** — CR-balanced монстры с combat-role, environmental twist, XP-estimate. Спавнятся Combat-AI-aware
- **Initiative tracker** — auto-roll d20+DEX из entity, inline HP edit, round counter
- **Dice roller** — quick d4-d100 + custom expressions + scan-and-roll `/roll ...` в session text
- **HP slider** на entity → AI rewrite сцены (severity ladder)
- **Danger slider** на location → AI rewrite атмосферы (1-3/4-6/7-9/10 тиры)
- **Ability sliders** STR/DEX/CON/INT/WIS/CHA → AI rewrite поведения персонажа при tier-change (skipped когда cosmetic)
- **Insert-at-cursor** на каждом AI-output → реплика/нарратив/тактика/event/roll прыгает в Slate в позицию курсора
- **Карта мира через Azgaar** — DnD Forge собирает бриф из кампании, открывает официальный редактор и безопасно импортирует значимые города из `Export → JSON → Minimal`. До подтверждения показываются preview, дубли и точное число новых локаций

### Стартовые кампании

3 hand-authored seed campaigns с полностью прописанными NPC backstories (goal/secret/knowledge):

- **Phandalin — Lost Mine Opener** (Toblen Stonehill / Linan Swift / Sildar / Cragmaw Goblins)
- **Barovia — Mists of Strahd** (Strahd / Father Donavich / Mad Mary / Doru)
- **Cinder Hollow — Falling Star** (Old Mab / Sheriff Vance / Deputy Wren / Clerics of Pelor / Zhentarim Broker / Hooded Stranger)
- **Blank Campaign** (пустое поле)

---

## 🎬 Полный gameplay loop

1. Открыть [демо](https://dnd.eclipse-forge.ru/) → выбрать провайдера → ввести ключ → запустить **Фандалин**
2. 👑 **DM** → «Опиши открывающую сцену» → стримит описание таверны → `**Toblen:** «...»` авто-зеркалится в чат-историю Toblen
3. 📜 **Вставить в сессию** → нарратив встаёт в нужное место текста сессии
4. 💬 Кликнуть Toblen → **Поговорить** → диалог с памятью DM-сцены
5. ⏳ Поставить **Авто-тик: Каждые 15 минут** → каждые 15 мин тики → «🌍 N событий ждёт» в DM
6. На вкладке «Мир и локации» выбрать **логово Cragmaw** → 🪓 **Сгенерировать энкаунтер** → 4 группы монстров с тактикой
7. 🌍 **Карта мира** → Скопировать бриф → Открыть Azgaar → `Export → JSON → Minimal` → проверить preview → добавить города без дублей
8. На вкладке «Герои и NPC» выбрать монстра → ⚔️ **Предложить тактику** → «Кларг бросается на жреца...» → Вставить
9. 🗡️ **Трекер инициативы** → добавить партию + Кларга → Начать бой → Следующий ход
10. 🎲 **Кубики** → `2d6+3` → 11 → Вставить как бросок
11. Тянуть HP Кларга 30→8 → AI переписывает сцену: «Кларг качается, плюётся кровью...»
12. Тянуть опасность Фандалина 3→7 → AI переписывает: «Улицы непривычно пусты, тревога в воздухе...»
13. 📖 **Завершить сессию** → AI генерирует recap → следующий ход DM знает «Ранее в этой кампании...»

---

## Стек

| Слой | Технология |
|---|---|
| UI | React 18 + TypeScript + Tailwind CSS |
| Bundler | Vite 5 |
| Граф | `@xyflow/react` + `d3-force` |
| Текст | Slate (rich text), `react-markdown` |
| State | Zustand (6 store: model, agent, world-events, sessions, initiative, ai-config) |
| AI | OpenAI / Anthropic / Ollama под единым `AiProvider` |
| Validation | Zod 3.x + in-house `zodToJsonSchema` для cross-provider structured outputs |
| Storage | `localStorage` для несекретного config/sessions/events/initiative; `sessionStorage` только для cloud API keys |

---

## Структура

```
src/
├── model/
│   ├── Model.tsx              — useModelStore (entities, locations, action edges, session text)
│   ├── dice.ts                — parser + roller для dice expressions
│   ├── ai/
│   │   ├── types.ts           — AiProvider interface (streamChat + generateStructured)
│   │   ├── credentialStorage.ts — session-only cloud keys + fail-closed legacy migration
│   │   ├── OpenAIProvider.ts  — response_format + zodResponseFormat
│   │   ├── AnthropicProvider.ts — tool-use via input_schema
│   │   ├── OllamaProvider.ts  — format: "json" + NDJSON streaming
│   │   ├── FallbackProvider.ts — chain wrapper
│   │   └── zodToJsonSchema.ts — minimal в-house converter
│   ├── agents/
│   │   ├── NpcAgent.ts        — система NPC-диалога
│   │   ├── DmAgent.ts         — DM нарратор + cross-reference + tick awareness
│   │   ├── CombatAgent.ts     — тактический советник
│   │   ├── WorldTickAgent.ts  — off-screen симуляция
│   │   ├── SessionRecapAgent.ts — recap generator
│   │   ├── dmCrossReference.ts — парсер **Name:** "..." quotes
│   │   └── sessionInjector.ts — insert-at-cursor + append helpers
│   ├── prompts/
│   │   ├── generators/        — NPC + Encounter генераторы
│   │   ├── textExtractors/    — entity/location refresh-from-text
│   │   ├── textEditors/       — ChangeHp / ChangeDanger / ChangeAbilityScore
│   │   └── utils/             — JSONPrompt (cross-provider) + TextPrompt
│   └── dnd/
│       ├── campaignTemplates.ts — 4 seed кампании
│       └── azgaarImport.ts      — bounded parser, preview plan, duplicate guard
├── store/
│   ├── useAgentStore.ts       — per-entity chat histories
│   ├── useAiConfigStore.ts    — provider config + fallback flag
│   ├── useWorldEventStore.ts  — tick events + auto-interval + DM watermark
│   ├── useInitiativeStore.ts  — combat tracker
│   └── useSessionStore.ts     — archived sessions with recaps
└── view/
    ├── Launcher.tsx           — campaign picker + provider settings
    ├── VisualWritingInterface.tsx — main canvas + 7-button toolbar
    ├── dnd/
    │   ├── NpcDialoguePanel.tsx
    │   ├── NpcGeneratorPanel.tsx
    │   ├── DmAgentPanel.tsx
    │   ├── EncounterGeneratorPanel.tsx
    │   ├── WorldTickPanel.tsx
    │   ├── InitiativePanel.tsx
    │   ├── DiceRollerPanel.tsx
    │   ├── MapWorkflowPanel.tsx
    │   └── SessionsPanel.tsx
    ├── entityActionView/      — entity node + sliders (HP, abilities, properties)
    └── locationView/          — location node + danger ring + slider
```

---

## Roadmap

Полная дорожная карта — **[`ROADMAP.md`](ROADMAP.md)**. Список 27 шипнутых слайсов хранится там с техническими нотами и результатами проверок. Открытые follow-ups:

- ActionEdge → SceneBeat (связать timeline с Session model)
- Auto-suggest end-session по word-count эвристике
- 🏰 **Backlog** (R&D, не запланировано): процедурный dungeon-gen, hex world-map, fog of war, temporal world states, character sheets, PDF export, multiplayer, autonomous AI DM mode, cinematic NPC briefings, voice profiles, ambient audio per scene
- 🗺️ **Следующий map-этап:** Campaign Map Asset v1 — хранить metadata Azgaar, выбранные burg ids и безопасный re-import diff; roads/states и fog-of-war не входят в первый срез

---

## Безопасность ключей

API-ключи OpenAI/Anthropic хранятся только в `sessionStorage`: они не попадают в campaign URL, очищаются по кнопке или при закрытии вкладки. Старый Anthropic key автоматически удаляется из persistent config и однократно переносится в текущую session; старая ссылка с `?k=` очищается и возвращает пользователя в launcher для безопасного повторного ввода. `VITE_OPENAI_API_KEY` намеренно не поддерживается, потому что Vite встраивает такие значения в публичный bundle.

Это уменьшает время и поверхность утечки, но не делает browser-direct cloud calls production-safe: XSS в том же origin всё ещё может прочитать session key. Перед paid SaaS или общедоступным production OpenAI/Anthropic нужно маршрутизировать через backend gateway с user auth, server-side secrets, rate limits, budgets и audit metadata без prompt/response logging. OpenAI client пока использует `dangerouslyAllowBrowser: true`, Anthropic — `anthropic-dangerous-direct-browser-access`; UI честно помечает этот режим как demo-only.

Production foundation активирован dark-by-default: `api.dnd.eclipse-forge.ru` работает через TLS 1.2/1.3 и loopback BFF, Chat публикует отдельный Ed25519 JWKS, а scoped service token остаётся только на сервере. Служебный `#/auth/canary` может проверить PKCE и защищённую DnD session независимо от AI. Сам AI и managed provider UI всё ещё выключены до authenticated canary, rollback drill и 24h SLO. Trust boundaries и budget policy описаны в [`docs/PRODUCTION-AI-GATEWAY.md`](docs/PRODUCTION-AI-GATEWAY.md), deployment gates — в [`bff/README.md`](bff/README.md).

Azgaar открывается как фиксированная внешняя HTTPS-ссылка, без iframe и передачи ключей. Импорт выполняется локально только из JSON до 8 МБ: проверяется официальный `pack.burgs`, названия очищаются от управляющих символов, а кампания меняется только после preview и явного подтверждения. `.map` остаётся резервным файлом пользователя и не исполняется DnD Forge.

GitHub Pages публикуется только после locked install без lifecycle scripts, typecheck, tests, lint и production build. Сборка выполняется с read-only token без сохранённых Git credentials; отдельный publisher получает проверенный immutable artifact и минимальный `contents: write`. Все используемые GitHub Actions зафиксированы полными commit SHA.

---

## Вдохновение

- [VisualStoryWriting](https://github.com/m-damien/VisualStoryWriting) — ядро проекта (MIT)
- [D&D 5.1 SRD](https://www.dndbeyond.com/sources/srd) — Open Gaming License
- [donjon](https://donjon.bin.sh/) — генераторы для D&D
- [Dungeon Scrawl](https://dungeonscrawl.com/) — редактор карт подземелий
- [Azgaar’s Fantasy Map Generator](https://azgaar.github.io/Fantasy-Map-Generator/) — карта мира и официальный Minimal JSON handoff (MIT)

---

## Лицензия

[MIT](LICENSE) — форк [VisualStoryWriting](https://github.com/m-damien/VisualStoryWriting) (MIT)

---

<div align="center">
<sub>Eclipse Forge · Сделано для мастеров подземелий</sub>
</div>
## Eclipse Forge visual contract

DnD Forge uses the local `eclipse-forge.visual-system.v1` `product` profile for the launcher and app shell. The shared signal-blue/warm-gold stage, Outfit/Inter typography and reduced-motion behavior frame the product while the parchment editor remains optimized for long-form campaign reading.
