# Eclipse DnD Forge

> AI-powered D&D Campaign Manager — visual world map, timeline, AI Dungeon Master.

## Tech Stack

- **Frontend:** React 18 · TypeScript · Vite · Tailwind CSS 3
- **Graphs:** @xyflow/react · d3-force · react-d3-tree
- **Editor:** Slate (rich text)
- **State:** Zustand
- **AI:** OpenAI API (GPT-4o) — planned: Gemini, Claude, Ollama

## Commands

```bash
npm install
npm run dev        # Dev server on :5173
npm run build      # Production build
npm run lint       # ESLint
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

## D&D Context

- SRD 5.1 content (Open Gaming License) is the baseline
- D&D terminology: characters = heroes/NPCs, events = sessions, locations = dungeons/towns
- AI prompts should be D&D-aware: describe scenes with fantasy atmosphere, generate stat blocks, use D&D mechanics
