# Eclipse DnD Forge — Roadmap

> Single source of truth. README links here. Update on every shipped slice.

Last update: **2026-05-13** (cross-provider structured outputs — JSONPrompt no longer hard-OpenAI). Branch: `main`. Remote: unarchived 2026-05-13, pushes working again.

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

### v0.2 slice 15 — Initiative tracker 🗡️
*Shipped 2026-05-13. Pure-state, no AI — but pulls live data from the world graph.*

- [x] **`src/store/useInitiativeStore.ts`** — Zustand store with localStorage persistence (`eclipse_dnd_initiative_v1`): ordered `InitiativeEntry[]` (id, name, initiative, optional entityId / hp / notes), `activeIndex`, `round`, `active` flag. Actions: `addEntry`, `removeEntry`, `updateEntry`, `startCombat` (sorts desc by initiative, sets round=1), `nextTurn` (advances index, wraps + increments round), `endCombat`, `clearAll`.
- [x] **`src/view/dnd/InitiativePanel.tsx`** — toolbar panel: chip-row of entities not yet in the tracker (one click → auto-rolls d20 + DEX-mod from the entity's ability scores, appends to list); custom-row form (Name + Init); ordered list with active-turn highlight, inline HP editor, remove buttons; bottom controls — Start combat / Next turn / End combat / Clear.
- [x] **Toolbar wire-in** — global `🗡️` button next to World Tick. Mutually exclusive with all other right-side panels.

### v0.2 slice 14 — Encounter Generator ⚔️🎲
*Shipped 2026-05-13. Classic DM tool, now augmented by the Agent stack underneath.*

- [x] **`src/model/prompts/generators/EncounterGenerator.ts`** — `EncounterGenerator` returns a structured payload: monster groups (each with combat role, count, full stat block, goal, knowledge) + an environmental twist + an XP-budget estimate. Uses the new cross-provider structured-output path so it runs on all three providers.
- [x] **`calcXpBudget(level, size, difficulty)`** — DMG 2014 XP-budget table baked in. Surfaces in UI so the DM can sanity-check the model's output against the target.
- [x] **`generateEncounterIntoScene`** — spawns each monster group as new `EntityNode`s (`kind: monster`, full stats, goal, knowledge) with multi-count groups getting `#N` suffixes. Re-runs the layout so they don't pile on existing entities.
- [x] **`src/view/dnd/EncounterGeneratorPanel.tsx`** — toolbar panel keyed by selected location: party level / party size / difficulty / DM notes form, live XP-budget readout, result block with per-monster cards + twist callout + "Insert into session" button that drops an encounter-summary paragraph into Slate.
- [x] **Wire-in** — on the Realms & Locations tab, when exactly one location node is selected, a battle-axe button appears in the global toolbar. Click → opens encounter generator anchored to that location. Mutually exclusive with all other right-side panels.
- [x] **Combat AI pre-wired** — generated monsters carry goal + knowledge, so the existing `Suggest tactic` button on the Heroes & NPCs tab works on them out of the box.

### v0.2 slice 13 — Cross-provider structured outputs 🔌
*Shipped 2026-05-13. Frees the entity / location extractors and NPC generator from hard-OpenAI dependency.*

- [x] **`AiProvider.generateStructured<T>(messages, spec, options)`** — new method on the provider interface. Returns a typed value validated against the supplied zod schema. Throws on validation failure so the FallbackProvider can move to the next provider.
- [x] **`src/model/ai/zodToJsonSchema.ts`** — minimal in-house converter for the zod shapes Eclipse DnD Forge actually uses (object / array / string / number / boolean / enum / optional). ~40 LOC. Throws on unsupported shapes so we fail loudly rather than ship malformed schemas.
- [x] **`OpenAIProvider.generateStructured`** — uses `zodResponseFormat` (existing OpenAI helper) on `chat.completions.create`. Same guarantees as the legacy JSONPrompt code path.
- [x] **`AnthropicProvider.generateStructured`** — uses tool-use. Declares a single tool with `input_schema` derived from the zod schema, forces `tool_choice: { type: "tool" }`, extracts payload from the resulting `tool_use` content block.
- [x] **`OllamaProvider.generateStructured`** — uses `format: "json"` + injects the JSON Schema into the system prompt. Parses + validates with zod; throws on mismatch.
- [x] **`FallbackProvider.generateStructured`** — same chain semantics as `streamChat`. Tries providers in order, aggregates errors, throws if all fail.
- [x] **`JSONPrompt` refactor** — branches by active config:
      - OpenAI + no fallback → keep the existing streaming path (preserves partial-parse UI for entity / location extractors)
      - Anything else (Ollama / Anthropic / fallback) → use `currentProvider().generateStructured`. No streaming, but one synthetic partial fires through `onPartialResponse` so existing consumers (layout-on-each-entity callback) still see one update.
- [x] **Launcher copy updated** — removed the "structured outputs are OpenAI-specific" disclaimer that's no longer accurate. Optional OpenAI key on Ollama / Anthropic tabs reframed as "fallback chain enabler".

### v0.2 slice 12 — World Tick auto-scheduling ⏱️
*Shipped 2026-05-13. World can now advance on its own while the app is open.*

- [x] **`WorldTickInterval` enum + lookup tables** in `useWorldEventStore`: `off | 5min | 15min | 1h | 4h`, with label and millisecond maps. Default is `off` (preserves earlier manual-only behaviour).
- [x] **Two new persisted fields**: `autoTickInterval` and `lastAutoTickAt`. Both flow through the same `eclipse_dnd_world_events_v1` storage key.
- [x] **`setAutoTickInterval()` + `markAutoTicked()`** store actions. Manual ticks now also call `markAutoTicked()` so the auto-scheduler does not immediately re-fire after a click.
- [x] **Settings row inside `WorldTickPanel`** — Select with all five cadences + a "Last tick: HH:MM:SS" caption when auto is enabled.
- [x] **Auto-scheduler effect in `VisualWritingInterface`** — runs only when `autoTickInterval !== "off"` and the model is not read-only. Polls every 30s, fires a tick when `Date.now() - lastAutoTickAt >= intervalMs`. Skips silently when no eligible entities or when a manual tick is already in flight. Mirrors each event into the corresponding NPC's chat history with the same `(Off-screen tick: ...)` framing the manual path uses. In-tab only — closing the tab pauses the scheduler.

### v0.2 slice 11 — DM ↔ World Tick awareness 🔗
*Shipped 2026-05-13. Closes the loop: ticks happen → DM narration naturally references them.*

- [x] **`useWorldEventStore` watermark** — new `lastDmAcknowledgedAt` field (persisted to localStorage). New action `markDmAcknowledged()` bumps it; new selector `getEventsForDm()` returns only events with an `action` and `createdAt > lastDmAcknowledgedAt`.
- [x] **`buildDmSystemPrompt` extended** — adds an "OFF-SCREEN EVENTS SINCE YOUR LAST NARRATION" section when there are pending events. Strict instruction: weave AT LEAST ONE in naturally (rumour / sighting / dialogue / track), do NOT list them to the players.
- [x] **`runDmTurn`** — pulls up to 20 most-recent pending events into the context, calls `markDmAcknowledged()` only on successful stream so a thrown stream still leaves events pending for the retry.
- [x] **DmAgentPanel indicator** — live "🌍 N off-screen events waiting — the DM will weave them in" chip subscribed reactively to the store, so the chip updates in real time as ticks land.

### v0.2 slice 10 — Off-screen World Tick 🌍⏳
*Shipped 2026-05-13. The "living world" loop — entities act between sessions even when no DM is at the table.*

- [x] **`src/model/agents/WorldTickAgent.ts`** — `buildWorldTickSystemPrompt(ctx)` assembles a DM-side world-simulation prompt for ONE entity at a time. Output is a JSON object (`{action, consequence?}`) — no OpenAI-specific structured outputs, parsed manually so the same code runs on Ollama and Anthropic via `currentProvider()`. Forgiving parser (strips markdown fences, extracts first `{...}` block on fallback); malformed replies surface as `raw`-only events instead of crashing the batch.
- [x] **`runWorldTick({onEventCommitted, tickId?})`** — orchestrator that iterates over every entity with a `goal` (NPCs / monsters / factions only — heroes excluded), runs ticks in parallel with concurrency cap 3, streams each event through the callback as it lands. Per-entity errors become `(tick failed: ...)` events rather than aborting the whole tick.
- [x] **`src/store/useWorldEventStore.ts`** — Zustand event log with `localStorage` persistence (`eclipse_dnd_world_events_v1`). Hard cap of 200 events. Tracks `insertedIds` so the panel knows which events are already promoted into the session text. `currentTickId` filter so the UI shows only the latest batch by default.
- [x] **`src/view/dnd/WorldTickPanel.tsx`** — wide chat-like panel: eligibility banner ("Will tick N entities"), "Advance the world" button (streams events as they arrive), per-event card with action + optional consequence + Insert button. "Insert all into session" bottom action consolidates the whole tick into a single `**Between sessions —** ...` block.
- [x] **Cross-reference into chat history** — every off-screen action is also mirrored into the entity's chat history (assistant message, prepended by a one-time "(Off-screen tick: ...)" user marker). Future "Talk to that NPC" picks up what they did between sessions.
- [x] **Toolbar wire-in** — global "⏳ Advance the world" button next to DM. Mutually exclusive with all other right-side panels.

### v0.2 slice 9 — Combat AI ⚔️
*Shipped 2026-05-12. Third agent type on the same architecture — monsters as tactical advisors.*

- [x] **`src/model/agents/CombatAgent.ts`** — `buildCombatSystemPrompt(ctx)` assembles a *DM-side combat advisor* prompt: full creature card (incl. goal), heroes / NPCs / other creatures present, battlefield narrative. Strict output rules: one sentence, present tense, no game-mechanic mentions, no dice asks, match player language.
- [x] **`suggestCombatTactic(monsterEntityId, onPartial)`** — single-shot streaming call. System + one user line ("Propose this creature's next action."). Goes through the same `currentProvider()` pipeline — supports OpenAI / Ollama / Anthropic / Fallback chain transparently.
- [x] **NpcDialoguePanel — "Combat AI" block** — visible only when the selected entity is `kind === "monster"`. Shows the proposed tactic in italic + an "Insert tactic" button that drops the sentence into the session text at the cursor.
- [x] One-sentence proposals are deliberately decision-only: the DM still narrates the actual outcome (hit / miss / status), keeping the agent in advisory role rather than overstepping the table.

### v0.2 slice 8 — Insert-at-cursor ✒️
*Shipped 2026-05-12. Promotes Agent output into wherever the writer is currently editing.*

- [x] **`insertTextAtCursor(text)` and `insertNpcQuoteAtCursor(speaker, text)`** added to `sessionInjector.ts`. Uses `Transforms.insertText(globalEditor, "\n\n" + text + "\n", { at: editor.selection })`. Falls back to `appendParagraphToSession` when there is no selection (e.g. editor not yet focused).
- [x] **All three Insert buttons** (NPC dialogue replies, DM narration, NPC generator hook) switched from append-at-end to cursor-aware. Tooltips updated.
- [x] **Slate normalisation respected** — the editor in this codebase merges multiple paragraphs into one with embedded `\n` separators (see `globalEditor.normalizeNode`), so inserting newlines + text is the right shape; we do not need to insert paragraph nodes manually.

### v0.2 slice 7 — DM ↔ NPC cross-reference 🪶
*Shipped 2026-05-12. Continuity between DM narration and per-NPC chat.*

- [x] **`src/model/agents/dmCrossReference.ts`** — `extractNpcQuotes(dmText, entityNodes)` parses `**Name:** ...` lines from DM output (greedy on the speech body until the next blank line, the next `**Name:**`, or end). Filters to entities that exist in the current world graph (exact case-insensitive name match).
- [x] **`mirrorDmQuotesToNpcHistories(quotes)`** — appends each quoted line as an `assistant` message in that NPC's chat history. Prepends a one-time `user` framing note (`"(DM narrated this scene; the following lines are what you said aloud during it.)"`) so the per-NPC chat preserves context coherence.
- [x] **DmAgentPanel wired** — after each DM turn finishes, extract + mirror runs automatically. A small green "Mirrored DM-narrated lines into … " indicator confirms which entities received lines.

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
