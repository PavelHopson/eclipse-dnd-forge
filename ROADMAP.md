# Eclipse DnD Forge — Roadmap

> Single source of truth. README links here. Update on every shipped slice.

Last update: **2026-05-12** (Anthropic + Fallback chain shipped on top of multi-provider; provider story complete). Branch: `main`. Remote: archived/read-only — pushes blocked, commits stay local.

> 🎯 **Strategic direction (set 2026-05-12):** Eclipse DnD Forge is not a DM helper tool — it is a **tabletop with AI agents**. Every entity on the visual graph is an addressable agent (NPC / monster / faction / hero / DM). The Agent layer is the core architecture; encounter generators, dice rollers, initiative trackers are second-class tools that hang off it. Past DM-tool roadmap items keep their place in **Backlog** but are no longer driving.

---

## ✅ Done

### v0.1 slice 1 — D&D rebrand of the entry point
*Commits: `856a022`, `5977879`, `5a2902c`, `7bee46d`.*

- [x] Project rebrand (README, CLAUDE.md, package name, license note)
- [x] Roadmap expanded with R&D directions (GPT-5.5, compression profiles, asset pipeline, etc.)
- [x] **Launcher** rewritten as a Campaign Launcher with four D&D starters:
      Phandalin (Lost Mine opener) · Barovia (Mists of Strahd) · Cinder Hollow (sandbox starter) · Blank Campaign
- [x] **Brand surface**: `index.html` title, favicon, Launcher header, fantasy color palette
- [x] **Domain model** extended (additive, non-breaking):
      - `Entity.kind` (`hero | npc | monster | faction | unknown`), `role`, `abilities` (STR/DEX/CON/INT/WIS/CHA), `hp`, `ac`, `cr`
      - `Location.kind` (`dungeon | town | wild | plane | stronghold`), `biome`, `danger` (1-10)
- [x] **Visual representation** of new fields:
      - Entity nodes show a coloured kind badge + role label
      - Location nodes show biome + a danger ring (green / amber / red by tier) + DANGER N/10 chip
- [x] **AI extractor prompts rewritten** in D&D vocabulary:
      - `EntitiesExtractor` classifies into hero/npc/monster/faction with structured-output enum
      - `LocationExtractor` classifies into dungeon/town/wild/plane/stronghold with biome + danger
      - `JSONPrompt.getDefaultValue` learned `ZodEnum` so partial streaming still renders mid-flight
- [x] **Tabs** renamed: "Heroes & NPCs" / "Realms & Locations" with fantasy icons
- [x] **HCI study routes** (`/study`, `/baseline`) hidden from Launcher (still wired in `App.tsx` for research replay; not surfaced as a product feature)

**Verified by:** manual TypeScript review (npm install kept failing with `ECONNRESET` to npm registry in the session that shipped this).

### v0.2 slice 1 — NPC Generator ✨
*Shipped 2026-05-11.*

- [x] `NpcGenerator` prompt — structured JSON for a full 5e NPC (name, emoji, kind, role, 6 abilities, hp, ac, cr, DM hook). Anchored to party level + location + hostility + DM notes.
- [x] `generateNpcIntoScene` — generates, hydrates an `Entity` with all D&D fields, adds to the graph, re-runs layout.
- [x] UI: dedicated "Generate NPC" button on the Heroes & NPCs tab toolbar (only visible on that tab).
- [x] Inline form panel — race / occupation / party level / location / hostility / DM notes.
- [x] Result card: HP/AC/CR + 6 abilities as chips, DM hook block, "Forge another" + "Done".
- [x] Existing "Clear canvas" trash button rewired into the same toolbar group with its own tooltip.

### v0.2 slice 2 — Living NPCs (Agent layer foundation) 🧠
*Shipped 2026-05-12. The strategic pivot: every entity becomes an addressable AI agent.*

- [x] **Domain extension** — `Entity.goal` (DM-visible motivation), `Entity.secret` (hidden), `Entity.knowledge[]` (concrete facts). All optional, additive.
- [x] **`NpcGenerator` schema upgrade** — now also returns goal + secret + 3-5 knowledge bullets. Old generator path stays backwards-compatible.
- [x] **Seed campaigns backfilled** — Phandalin / Barovia / Cinder Hollow NPCs (10+ characters) each have hand-authored goal / secret / knowledge so the first-click demo lands.
- [x] **Agent layer (`src/model/agents/NpcAgent.ts`)** — `buildNpcSystemPrompt` assembles a full in-character system prompt (character card, knowledge, goal, secret, scene text, other present entities, RP rules). `runNpcDialogue` streams the reply via OpenAI chat-completions.
- [x] **Agent state (`src/store/useAgentStore.ts`)** — Zustand store with per-entity chat history (`Record<entityId, AgentMessage[]>`), streaming flag, append / clear API. History persists across panel close & reopen within a session.
- [x] **Dialogue UI (`src/view/dnd/NpcDialoguePanel.tsx`)** — chat panel keyed by entity id: avatar + name + role + kind badge, collapsible DM-only context (goal/secret), scrolling conversation log with streaming-aware rendering, send + clear, in-character error fallback.
- [x] **Wire-in (`VisualWritingInterface.tsx`)** — when exactly one entity node is selected on the Heroes & NPCs canvas, a Talk-icon button appears next to Generate NPC. Click → opens dialogue panel for that entity; switching selection while the panel is open re-targets it; opening NPC Generator closes the dialogue and vice versa.

### v0.2 slice 3 — DM Agent 👑
*Shipped 2026-05-12 (same session). The second agent type on the same architecture.*

- [x] **`src/model/agents/DmAgent.ts`** — `buildDmSystemPrompt` assembles a narrator/referee system prompt: full scene text + every entity (kind + role) + every location (kind + biome + danger) + conversation history. Strict rules forbid game-mechanic mentions and enforce in-language replies.
- [x] **`DM_AGENT_ID` constant** — special key reuses `useAgentStore` so DM conversation history lives in the same store as NPC histories (no duplicate state machinery).
- [x] **`src/view/dnd/DmAgentPanel.tsx`** — wider chat panel (440px) with crown header, neutral background, multi-paragraph rendering. Empty-state shows example prompts in three languages.
- [x] **Toolbar wire-in** — global "Run scene with AI DM" crown button visible on both Heroes and Locations tabs. DM panel is mutually exclusive with NPC dialogue and NPC generator panels.

### v0.2 slice 4 — Hook → editor injection 📜
*Shipped 2026-05-12 (same session). Ties the Agent layer back into the canonical session text.*

- [x] **`src/model/agents/sessionInjector.ts`** — `appendParagraphToSession(text)` and `appendNpcQuoteToSession(speakerName, text)` append a new Slate paragraph to the session text via the existing `setTextState` path (so undo/redo + visual-refresh staleness work automatically). NPC quotes get a `**Name:**` bold prefix for natural reading once promoted.
- [x] **"Insert into session" buttons** added on three surfaces:
      - NPC dialogue replies — one button under each assistant message, formatted as quoted speech
      - DM narration — one button under each DM beat, inserted as a plain paragraph
      - NPC Generator hook block — one button on the result card, inserts the hook as a paragraph
- [x] All three buttons share the same scroll-quill icon + parchment styling, making the "promote to canon" gesture consistent across the product.

### v0.2 slice 5 — Multi-provider AI 🔀
*Shipped 2026-05-12. Cost-control and privacy/control story for the conversational paths.*

- [x] **`src/model/ai/types.ts`** — provider-neutral `AiProvider` interface with `streamChat(messages, options) → AiStreamResult`. Options carry model, temperature, abort signal, and an `onPartial` chunk callback. Provider-neutral `AiMessage` shape.
- [x] **`src/model/ai/OpenAIProvider.ts`** — wraps the existing `openai.chat.completions.create` streaming path. Default model: `gpt-4o-2024-08-06`.
- [x] **`src/model/ai/OllamaProvider.ts`** — self-hosted Ollama HTTP client. Calls `POST /api/chat` with `stream: true`, parses NDJSON chunks, exposes errors cleanly. Default base URL: `http://localhost:11434`, default model: `llama3.2`. Includes user-facing setup notes (model pull + `OLLAMA_ORIGINS="*"` for CORS).
- [x] **`src/store/useAiConfigStore.ts`** — Zustand store with localStorage persistence (`eclipse_dnd_ai_config_v1`). Holds provider id + per-provider config (base URL, model). Exposes `currentProvider()` and `currentModel()` accessors for non-React callers.
- [x] **`NpcAgent` and `DmAgent`** — both rewired through `currentProvider().streamChat(...)`. No more direct `openai` references in the conversational path.
- [x] **Launcher UI** — provider tab (OpenAI / Ollama) on the entry screen. OpenAI branch keeps the API-key field + model name. Ollama branch shows base URL + model + an optional OpenAI key (for structured-output paths that still require OpenAI: entity extractors, NPC generator). Campaign-start gating is provider-aware: Ollama doesn't require any key.
- [x] Structured-output paths (`JSONPrompt`, entity & location extractors, NPC generator) intentionally **stay OpenAI-only** — they rely on `response_format` with a zod schema, an OpenAI feature with no clean equivalent on Ollama. Cross-provider structured outputs are deferred.

### v0.2 slice 6 — Anthropic provider + Fallback chain 🔀⛓️
*Shipped 2026-05-12. Provider story completes — three real providers + a graceful degradation path.*

- [x] **`src/model/ai/AnthropicProvider.ts`** — Claude over `POST /v1/messages` with `stream: true`. Splits system prompt out-of-band (Anthropic API shape). Parses SSE `data: {...}` lines, consumes `content_block_delta` text deltas, surfaces inline `error` events. Browser-direct calls use the `anthropic-dangerous-direct-browser-access` opt-in header (local prototype only).
- [x] **`src/model/ai/FallbackProvider.ts`** — wraps an ordered list of providers. Tries each in turn; on error logs and moves to the next. Resets the visible partial to `""` between providers so the chat bubble doesn't show a broken fragment glued to the next reply. Aggregates errors and throws if all fail.
- [x] **`useAiConfigStore` v2** — adds `anthropicApiKey`, `anthropicModel`, `useFallback`. Storage key bumped to `eclipse_dnd_ai_config_v2`. `getProvider()` now returns `FallbackProvider` when `useFallback` is on, with chain order `[primary, ...eligible others]` where eligibility means "has enough config to attempt a call".
- [x] **Launcher updated** — third provider tab "Anthropic Claude (cloud)" with key + model fields and the same optional-OpenAI-key shape Ollama already had. Below the tabs, a single "Enable fallback chain" checkbox with a one-paragraph explainer.
- [x] **`AiProviderId` widened to `"openai" | "ollama" | "anthropic"`**, `AiProvider.id` accepts `AiProviderId | "fallback"` so the wrapper has a clean identity without polluting the user-facing union.

---

## 🚧 Active

*(slot open — next slice to be promoted from below)*

---

## 🎯 Next (small, bounded)

### Agent layer extensions (priority — same architecture, new agent types)

- [ ] **Cross-provider structured outputs** *(design item — not bounded for one slice yet)* — wrap JSON-mode for Ollama / tool-use for Anthropic so the entity extractors and NPC generator can also run off-OpenAI. Needs schema-translation layer across very different APIs.
- [ ] **Off-screen world tick** *(design item — not bounded for one slice yet)* — periodic agent loop that advances NPC/faction goals between sessions, emits events the DM can choose to surface. Needs scheduling architecture, event log, persistent agent state.
- [ ] **Combat AI** — same Agent class, tactical-reasoning system prompt for `kind: monster` entities. Monsters propose actions (flank, focus, retreat) given a battlefield snapshot.
- [ ] **DM ↔ NPC cross-reference** — when the DM narrates an NPC speaking (`**Name:** "..."` pattern), mirror that quote into the NPC's chat history so future per-NPC conversations stay consistent
- [ ] **Insert-at-cursor** — current Insert buttons append to the end of the session text; add a variant that uses the Slate cursor position

### Classic DM tools (parked under the Agent vector)

- [ ] **Encounter Generator** — pick a location → CR-balanced monster squad → drop into the graph. Will benefit from Combat AI once that ships.
- [ ] **Inline dice roller** — `/roll d20+5` inside the Slate editor, inline result chip
- [ ] **Initiative tracker** — ordered list of entities with init scores, current-turn marker
- [ ] **Session / Encounter as first-class layer** — reframe `ActionEdge` as scene beats inside a `Session` container
- [ ] **D&D-aware text editors** — `ChangeAbilityScorePrompt`, `ChangeHpPrompt`, `ChangeDangerPrompt` (slider on a stat rewrites the scene mechanically)

---

## 🏰 Backlog (larger / R&D)

From the original v0.3-v1.0 roadmap, kept intact:

- Procedural dungeon generator + hex world map
- Fog of War for player view
- Temporal world states (ancient / ruined / present version of a location)
- Upscale pipeline for portraits and maps
- VIGA 3D scene generation from sketches
- Character sheets, inventory & loot tracker
- PDF / Markdown campaign export
- Multiplayer (player views vs DM view)
- Full autonomous AI DM mode
- D&D Beyond / Roll20 import/export
- Ambient audio per scene
- Cinematic NPC briefings (portrait avatars, voice profiles)

---

## 🧱 Known legacy / debt

- `src/study/*` — HCI study scaffolding from VisualStoryWriting, untouched. Not part of the product surface but still in the bundle.
- `Action` type still represents generic narrative actions — needs reframing as "scene beats" inside a Session container.
- `dangerouslyAllowBrowser: true` on the OpenAI client — fine for local prototyping, must route through a backend before any hosted release.
- Build status: `npm run build` has not been run since the v0.1 slice was committed because of repeated `ECONNRESET` against npm registry in the dev environment. Run locally and pin the result here when network allows.

---

## How to update this file

When you ship a slice:
1. Tick the matching `[ ]` under **Active** or **Next**, move it under **Done** with the commit SHA.
2. Promote one item from **Next** into **Active** if the active slot is empty.
3. Update the "Last update" date at the top.
4. Keep the file under ~150 lines — backlog items are pointers, not specs.
