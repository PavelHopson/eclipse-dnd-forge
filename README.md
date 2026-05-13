<div align="center">

# ⚔️ Eclipse DnD Forge

### AI-powered D&D Campaign Manager

**Визуальная карта мира · Таймлайн сессий · AI Dungeon Master · Генератор квестов и NPC**

[![React](https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vite.dev)
[![Tailwind](https://img.shields.io/badge/Tailwind-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![MIT](https://img.shields.io/badge/License-MIT-22c55e?style=for-the-badge)](LICENSE)

> **Статус:** 🏗️ Early access — форк [VisualStoryWriting](https://github.com/m-damien/VisualStoryWriting), адаптируется под D&D. Launcher, domain model и extractor-промпты уже переведены в D&D-плоскость. Roadmap ниже отражает реальное состояние, не маркетинг.

</div>

---

## Что это

Eclipse DnD Forge — инструмент для мастеров D&D и писателей фэнтези. Основан на Visual Story-Writing (интерактивный AI-генератор рассказов с картой мира), адаптированный под настольные ролевые игры.

**Ядро (от VisualStoryWriting):**
- Интерактивная карта мира — перетаскивай персонажей, AI адаптирует нарратив
- Таймлайн событий — хронология кампании, переупорядочивание влияет на сюжет
- AI-редактор — соединяешь персонажей → AI предлагает сцену взаимодействия
- Rich text editor (Slate) с markdown поддержкой

**D&D адаптация (в разработке):**
- 🎲 Расы, классы, монстры из SRD 5.1 (Open Gaming License)
- 🗺️ Генератор подземелий и карт локаций
- 🧙 AI Dungeon Master — генерирует квесты, NPC, энкаунтеры
- ⚔️ Трекер инициативы и боевых сцен
- 📋 Листы персонажей (Character Sheets)
- 🎭 Генератор NPC с личностью, мотивацией и квестами
- 🏰 Шаблоны локаций (таверна, подземелье, лес, город)
- 🎵 Атмосферные пресеты (описания обстановки для разных сцен)

---

## Стек

| Технология | Роль |
|-----------|------|
| React 18 + TypeScript | UI компоненты |
| Vite | Сборка |
| Tailwind CSS | Стилизация |
| @xyflow/react | Интерактивные графы (карта мира) |
| Slate | Rich text editor |
| Zustand | Стейт-менеджмент |
| d3-force | Физика расположения на карте |
| OpenAI API | AI Dungeon Master |
| react-d3-tree | Дерево сюжетных веток |

---

## Быстрый старт

```bash
git clone https://github.com/PavelHopson/eclipse-dnd-forge.git
cd eclipse-dnd-forge
npm install
npm run dev
```

Открыть http://localhost:5173 и ввести OpenAI API ключ.

---

## Roadmap

The full roadmap lives in **[`ROADMAP.md`](ROADMAP.md)** — done / active / next / backlog, updated on every shipped slice.

**Strategic direction:** Eclipse DnD Forge is a **tabletop with AI agents**, not a DM helper. Every entity on the visual graph is an addressable agent — NPC, monster, faction, hero, or DM. Encounter generators, dice rollers and initiative trackers are second-class tools that hang off the Agent layer.

Short version:

- ✅ **v0.1 slice 1** — D&D rebrand: Campaign Launcher, domain model (kind/role/abilities/hp/ac/cr · biome/danger), extractor prompts in D&D vocabulary, fantasy UI.
- ✅ **v0.2 slice 1 — NPC Generator** — one-click full 5e NPC with stat block + scene hook + goal + secret + knowledge.
- ✅ **v0.2 slice 2 — Living NPCs (Agent layer foundation)** — click an entity → talk to it. Streaming AI dialogue, per-entity memory, scene-aware system prompts, hand-authored backstories for all seed-campaign NPCs.
- ✅ **v0.2 slice 3 — DM Agent** — global AI Dungeon Master that narrates scenes from world state, voices NPCs through quoted lines, reacts to player actions.
- ✅ **v0.2 slice 4 — Hook → editor injection** — every AI output (NPC reply, DM narration, NPC generator hook) has a one-click "Insert into session" button that promotes it into the canonical Slate session text.
- ✅ **v0.2 slice 5 — Multi-provider AI** — conversational agents (NPC dialogue, DM narration) run through a unified `AiProvider` interface. Two providers shipped: OpenAI (cloud) and Ollama (self-hosted). Choice persists in localStorage; switcher lives on the Launcher.
- ✅ **v0.2 slice 6 — Anthropic + Fallback chain** — Claude added as third provider. Optional fallback chain wraps the active provider and retries on the next configured one if it fails (rate limits, daemon down, expired key).
- ✅ **v0.2 slice 7 — DM ↔ NPC cross-reference** — after every DM turn, any `**Name:**` quote in the narration is auto-mirrored into that NPC's chat history. Future "Talk to that NPC" picks up the DM-narrated context.
- ✅ **v0.2 slice 8 — Insert-at-cursor** — all "Insert into session" buttons now drop into the current Slate cursor position (falls back to append at end when there's no selection).
- ✅ **v0.2 slice 9 — Combat AI** — third agent type on the same architecture. When a monster entity is selected, a "Suggest tactic" button proposes a one-sentence tactical action grounded in the battlefield and the creature's goal. Insert directly into the session text.
- ✅ **v0.2 slice 10 — Off-screen World Tick** — every NPC / monster / faction with a goal gets an off-screen action between sessions. Events are persisted, mirrored into entities' chat histories, and one-click-insertable into the session text. Works across all 3 providers.
- ✅ **v0.2 slice 11 — DM ↔ Tick awareness** — pending tick events are automatically folded into the next DM system prompt with a strict "weave at least one in" instruction. Watermark prevents repeats.
- ✅ **v0.2 slice 12 — Auto-scheduling** — optional cadence selector inside the Tick panel: off / 5min / 15min / 1h / 4h. In-tab scheduler fires ticks while the app is open; persists last-tick timestamp so reload picks up correctly.
- 🎯 Next: classic DM tools now meaningful on top of the Agent stack — Encounter Generator (will pair with Combat AI) · Initiative tracker · inline dice roller · (design item) cross-provider structured outputs.
- 🛠 Parked DM tools: Encounter Generator · dice roller · initiative tracker · D&D-aware text editors.
- 🏰 Backlog: dungeon/world-map generation, temporal world states, asset pipeline, multiplayer, full autonomous AI DM mode, cinematic NPC briefings.

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
