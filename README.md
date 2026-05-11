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

The full roadmap lives in **[`ROADMAP.md`](ROADMAP.md)** — done / active / next / backlog, updated on every shipped slice. Short version:

- ✅ **v0.1 slice 1** — D&D rebrand of the entry point: Campaign Launcher, domain model (kind/role/abilities/hp/ac/cr · biome/danger), extractor prompts in D&D vocabulary, fantasy UI.
- 🚧 **v0.2 slice 1 — NPC Generator** (active): one-click full 5e NPC with stat block + scene hook, dropped onto the visual graph.
- 🎯 Next: Encounter Generator · inline dice roller · initiative tracker · multi-provider AI · Sessions as a first-class layer.
- 🏰 Backlog: dungeon/world-map generation, temporal world states, asset pipeline, multiplayer, AI DM mode, cinematic NPC briefings.

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
