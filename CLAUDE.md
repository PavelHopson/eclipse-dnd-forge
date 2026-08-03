# Eclipse DnD Forge

> AI-powered D&D Campaign Manager — visual world map, timeline, AI Dungeon Master.

## Tech Stack

- **Frontend:** React 18 · TypeScript · Vite · Tailwind CSS 3
- **Graphs:** @xyflow/react · d3-force · react-d3-tree
- **Editor:** Slate (rich text)
- **State:** Zustand
- **AI:** OpenAI · Anthropic Claude · Ollama под единым `AiProvider`

## Commands

```bash
npm ci --ignore-scripts --no-audit
npm run dev        # Dev server on :5173
npm run build      # Production build
npm run lint       # ESLint
npm run typecheck  # strict TypeScript gate
npm test           # importer / security / UI contracts
```

## Project Structure

```
eclipse-dnd-forge/
├── src/
│   ├── components/     # React components
│   ├── public/         # Static assets, videos
│   └── ...
├── package.json
├── vite.config.ts
└── tailwind.config.js
```

## Key Patterns

- Forked from VisualStoryWriting (MIT) — core visualization engine preserved
- AI generates narrative edits when visual elements are manipulated
- @xyflow/react handles the interactive node graph (world map)
- Slate editor for rich text story editing
- Zustand for global state management
- Cloud API keys are session-only and never belong in URL, localStorage, source, logs, or Vite public env

## D&D Domain Model (current)

Entities and locations carry optional D&D-flavoured fields on top of the original visual primitives:

- `Entity.kind`: `hero | npc | monster | faction | unknown`
- `Entity.role`: short archetype string ("Half-elf Ranger", "Vampire Lord")
- `Entity.abilities`: optional `{str, dex, con, int, wis, cha}` block
- `Entity.hp / ac / cr`: optional combat stats
- `Location.kind`: `dungeon | town | wild | plane | stronghold | unknown`
- `Location.biome`: short descriptor
- `Location.danger`: 1-10 threat scale, drives the colored ring around the location node

The `EntitiesExtractor` and `LocationExtractor` prompts now classify entities/locations in D&D vocabulary and return these fields. The original `properties` array remains intact (Slate sliders still wired to it via `ChangePropertyPrompt`).

## Campaign Launcher

`src/model/dnd/campaignTemplates.ts` seeds three concrete starters (Phandalin / Barovia / Cinder Hollow) + a Blank Campaign. Each template provides text + pre-built entity & location nodes. The Launcher view is brand-consistent ("Eclipse DnD Forge") and is the entry point — the old HCI study routes (`/study`, `/baseline`) are still wired in `App.tsx` but no longer surfaced on the Launcher.

## Roadmap

Single source of truth: [`ROADMAP.md`](ROADMAP.md). Done / active / next / backlog. Update it on every shipped slice (tick the box, move under Done with commit SHA, promote one item from Next into Active, bump the date).

## What is still legacy

- `src/study/` — HCI research study scaffolding from VisualStoryWriting, kept for completeness but not part of the D&D product surface
- Action edges still represent generic narrative actions; "scene beats" / "encounters" / "session timeline" semantics live only in naming, not yet in the model

## D&D Context

- SRD 5.1 content (Open Gaming License) is the baseline
- D&D terminology: characters = heroes/NPCs, events = sessions, locations = dungeons/towns
- AI prompts should be D&D-aware: describe scenes with fantasy atmosphere, generate stat blocks, use D&D mechanics
