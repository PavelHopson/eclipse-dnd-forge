# Eclipse DnD Forge — Roadmap

> Single source of truth. README links here. Update on every shipped slice.

Last update: **2026-05-11** (NPC Generator slice). Branch: `main`. Remote: archived/read-only — pushes blocked, commits stay local.

> ⏸️ **Status: paused — 2026-05-11.** Owner switched focus to other Eclipse work. v0.1 slice 1 and v0.2 slice 1 are committed locally on `main` (SHAs `7bee46d`, `69195f2`). Resume point = the **Active** block below (Encounter Generator). When picking this back up: run `npm install && npm run build` first to verify the two paused slices compile in a clean environment — they were shipped without a successful build run because of repeated `ECONNRESET` against npm registry during the dev session.

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
*Shipped 2026-05-11 in the same session as v0.1 slice 1.*

- [x] `NpcGenerator` prompt — structured JSON for a full 5e NPC (name, emoji, kind, role, 6 abilities, hp, ac, cr, DM hook). Anchored to party level + location + hostility + DM notes.
- [x] `generateNpcIntoScene` — generates, hydrates an `Entity` with all D&D fields, adds to the graph, re-runs layout.
- [x] UI: dedicated "Generate NPC" button on the Heroes & NPCs tab toolbar (only visible on that tab).
- [x] Inline form panel — race / occupation / party level / location / hostility / DM notes.
- [x] On success — shows the NPC stat block (HP / AC / CR + 6 abilities as chips) + the DM hook in a copy-friendly card, plus "Forge another" + "Done" actions.
- [x] Existing "Clear canvas" trash button rewired into the same toolbar group with its own tooltip.

---

## 🚧 Active

### v0.2 slice 2 — Encounter Generator
**Goal:** pick a location → generate a CR-balanced encounter sized for the party → drop the monsters onto the graph at that location.

- [ ] `EncounterGenerator` prompt: structured JSON returning 1-N monsters with roles ("brute", "skirmisher", "controller") + an environmental twist hook
- [ ] UI on Realms & Locations tab: select a location node → toolbar shows "Generate encounter here" → form (party level + party size + difficulty: easy/medium/hard/deadly)
- [ ] Encounter math: implement XP budget per DMG, log per-monster CR + total budget so the DM can sanity-check
- [ ] Drop monsters as new `Entity` nodes (kind = monster) with `hp / ac / cr` populated; create `ActionEdge`s connecting each monster to the selected location

---

## 🎯 Next (small, bounded)

- [ ] **Inline dice roller** — `/roll d20+5` syntax inside the Slate editor, result chip inline
- [ ] **Initiative tracker** — minimal: ordered list of entities with init scores, current-turn marker
- [ ] **Multi-provider AI** — factor `openai` client out of `Model.tsx` into `ai/Provider.ts`, allow Gemini / Claude / Ollama as fallback (mirror Star CRM auto-chain pattern)
- [ ] **Session / Encounter as first-class layer** — today `ActionEdge` is still generic narrative-action; introduce a `Session` group containing ordered scene beats and link to encounters
- [ ] **D&D-aware text editors** — `ChangeAbilityScorePrompt` (slider on STR rewrites the scene mechanically), `ChangeHpPrompt` (drops HP after combat), `ChangeDangerPrompt` (location danger up/down)
- [ ] **Hook → editor injection** — currently the NPC hook is shown read-only in the generator panel; add a one-click "Insert into session text" button that drops the hook at the cursor position in the Slate editor

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
