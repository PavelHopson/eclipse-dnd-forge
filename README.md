<div align="center">

# ⚔️ Eclipse DnD Forge

### AI Campaign Manager — настолка с ИИ-агентами

**🌐 Live demo: <https://pavelhopson.github.io/eclipse-dnd-forge/>**

[![React](https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vite.dev)
[![Tailwind](https://img.shields.io/badge/Tailwind-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![MIT](https://img.shields.io/badge/License-MIT-22c55e?style=for-the-badge)](LICENSE)

> **Status:** ✅ v0.2 shipped — 19 продуктовых слайсов поверх форка [VisualStoryWriting](https://github.com/m-damien/VisualStoryWriting). 4 типа AI-агентов, 3 провайдера, persistent living-world loop, полный набор DM-инструментов.

</div>

---

## Что это

Eclipse DnD Forge — **операционная система мастера D&D на ИИ-агентах**. Не просто генератор контента и не просто чат с AI — каждая сущность на визуальном графе является **обращаемым агентом**: NPC, монстр, фракция или сам DM. Мир продолжает жить между сессиями, события подхватываются нарратором, реплики переносятся в канонический текст сессии одним кликом.

Форк [VisualStoryWriting](https://github.com/m-damien/VisualStoryWriting) (MIT). Визуальный граф `@xyflow/react` сохранён, всё остальное переработано под D&D + agent-first архитектуру.

### Стратегический вектор

> **Tabletop with AI agents**, not "DM helper tools".
>
> Encounter generator, dice roller и initiative tracker — второстепенные инструменты, висящие на agent-слое. Сначала строится `AiProvider` abstraction + agent runtime, всё остальное — частные случаи поверх.

---

## 🎮 Demo + быстрый старт

### Попробовать online

**<https://pavelhopson.github.io/eclipse-dnd-forge/>**

При открытии нужно выбрать AI-провайдера (по умолчанию OpenAI) и ввести API-ключ. Ключ хранится **только в локальном localStorage**, никуда не уходит. Поддерживаются:

- **OpenAI** (cloud) — `gpt-4o` по умолчанию, нужен ключ с <https://platform.openai.com>
- **Anthropic Claude** (cloud) — `claude-opus-4-7` по умолчанию, нужен ключ с <https://console.anthropic.com>
- **Ollama** (self-hosted) — локальный daemon, ключ не нужен. Запускать с `OLLAMA_ORIGINS="*"` чтобы браузер мог достучаться

Опционально: **fallback chain** — активный провайдер первым, остальные с валидным конфигом по очереди при ошибках.

### Локально

```bash
git clone https://github.com/PavelHopson/eclipse-dnd-forge.git
cd eclipse-dnd-forge
npm install
npm run dev
```

Откроется на `http://localhost:5173`. Provider config переживает reload (localStorage).

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

### Стартовые кампании

3 hand-authored seed campaigns с полностью прописанными NPC backstories (goal/secret/knowledge):

- **Phandalin — Lost Mine Opener** (Toblen Stonehill / Linan Swift / Sildar / Cragmaw Goblins)
- **Barovia — Mists of Strahd** (Strahd / Father Donavich / Mad Mary / Doru)
- **Cinder Hollow — Falling Star** (Old Mab / Sheriff Vance / Deputy Wren / Clerics of Pelor / Zhentarim Broker / Hooded Stranger)
- **Blank Campaign** (пустое поле)

---

## 🎬 Полный gameplay loop

1. Открыть [demo](https://pavelhopson.github.io/eclipse-dnd-forge/) → выбрать провайдера → ввести key → стартануть **Phandalin**
2. 👑 **DM** → "Set the opening scene" → стримит описание Stonehill Inn → `**Toblen:** "..."` авто-мирится в chat-историю Toblen
3. 📜 **Insert at cursor** → нарратив встаёт в нужное место session text
4. 💬 Кликнуть Toblen → **Talk** → диалог с памятью DM-сцены
5. ⏳ Поставить **Auto-advance: 15min** → каждые 15 мин ticks → "🌍 N events waiting" в DM
6. На Realms tab выбрать **Cragmaw Hideout** → 🪓 **Generate encounter** → 4 группы монстров с тактикой
7. На Heroes tab выбрать монстра → ⚔️ **Suggest tactic** → "Klarg lunges at the cleric..." → Insert
8. 🗡️ **Initiative tracker** → add party + Klarg → Start combat → Next turn
9. 🎲 **Dice roller** → `2d6+3` → 11 → Insert as roll
10. Drag HP Klarg 30→8 → AI rewrite: "Klarg качается, плюётся кровью..."
11. Drag danger Phandalin 3→7 → AI rewrite: "Улицы непривычно пусты, тревога в воздухе..."
12. 📖 **End session** → AI генерирует recap → следующий DM-turn знает "PREVIOUSLY ON..."

---

## Стек

| Слой | Технология |
|---|---|
| UI | React 19 + TypeScript + Tailwind CSS |
| Bundler | Vite 5 |
| Граф | `@xyflow/react` + `d3-force` |
| Текст | Slate (rich text), `react-markdown` |
| State | Zustand (4 store: model, agent, world-events, sessions, initiative, ai-config) |
| AI | OpenAI / Anthropic / Ollama под единым `AiProvider` |
| Validation | Zod 3.x + in-house `zodToJsonSchema` для cross-provider structured outputs |
| Storage | localStorage (config, sessions, world events, initiative — всё persisted) |

---

## Структура

```
src/
├── model/
│   ├── Model.tsx              — useModelStore (entities, locations, action edges, session text)
│   ├── dice.ts                — parser + roller для dice expressions
│   ├── ai/
│   │   ├── types.ts           — AiProvider interface (streamChat + generateStructured)
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
│       └── campaignTemplates.ts — 4 seed кампании
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
    │   └── SessionsPanel.tsx
    ├── entityActionView/      — entity node + sliders (HP, abilities, properties)
    └── locationView/          — location node + danger ring + slider
```

---

## Roadmap

Полная дорожная карта — **[`ROADMAP.md`](ROADMAP.md)**. Список 19 шипнутых слайсов хранится там с commit SHA и техническими нотами. Открытые follow-ups:

- ActionEdge → SceneBeat (связать timeline с Session model)
- Auto-suggest end-session по word-count эвристике
- 🏰 **Backlog** (R&D, не запланировано): процедурный dungeon-gen, hex world-map, fog of war, temporal world states, character sheets, PDF export, multiplayer, autonomous AI DM mode, cinematic NPC briefings, voice profiles, ambient audio per scene

---

## Безопасность ключей

API-ключи (OpenAI / Anthropic) хранятся **только в браузерном localStorage**. Этот демо — для локального прототипирования и личного использования. Перед любым публичным размещением (paid SaaS, прод-deploy) ключи нужно вынести в backend (OpenAI client сейчас работает с `dangerouslyAllowBrowser: true`, Anthropic с `anthropic-dangerous-direct-browser-access` header — это сигналы официальных SDK'ов о том же).

---

## Вдохновение

- [VisualStoryWriting](https://github.com/m-damien/VisualStoryWriting) — ядро проекта (MIT)
- [D&D 5.1 SRD](https://www.dndbeyond.com/sources/srd) — Open Gaming License
- [donjon](https://donjon.bin.sh/) — генераторы для D&D
- [Dungeon Scrawl](https://dungeonscrawl.com/) — редактор карт подземелий

---

## Лицензия

[MIT](LICENSE) — форк [VisualStoryWriting](https://github.com/m-damien/VisualStoryWriting) (MIT)

---

<div align="center">
<sub>Eclipse Forge · Сделано для мастеров подземелий</sub>
</div>
