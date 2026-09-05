# Living Atlas implementation status

- Date: 2026-09-05
- Checkout: `E:\projects\eclipse-dnd-forge`
- Branch: `main` (no branch created)
- Publication: local changes only; no commit or push performed

## Scope

Implemented the first clean-room Living Atlas vertical slice inside Map Workshop:

- local vector canvas with room, corridor, wall, door, selection, movement, undo/redo, deletion, keyboard nudging, and zoom;
- strict versioned `.eclatlas.json` project import/export with bounded shape counts, dimensions, coordinates, file size, timestamps, identifiers, and exact object keys;
- local draft recovery through `localStorage`;
- PNG export and WebP preview handoff into the existing location-map rights/provenance flow;
- responsive, focus-visible, and reduced-motion styling;
- focused model and UI contract tests;
- a phased Living Atlas backlog entry in `ROADMAP.md`.
- storage-safe numeric IDs for manually created locations, so map assets can link to names written in any language;
- a mount-time panel scroll reset, so reopening Living Atlas always exposes its title and primary controls.

## Decisions

- The editor is an original capability implementation inspired by the general category of tabletop map tools. It does not import Dungeon Scrawl `.ds` files or reuse its code, assets, layout, naming, or protected expression.
- The MVP is local-only. It does not fetch remote assets, upload map data, or add a cloud sharing surface.
- Generated previews enter the existing map workflow as original work and still pass through its explicit rights/commercial-use gate before save/export.
- Project files fail closed on unknown fields or invalid limits instead of trying to repair untrusted imports.

## Evidence

- Focused Living Atlas and map tests: 18 passed.
- Full `npm test`: 79 passed.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run build`: passed (2,532 modules transformed).
- `npm run bundle:check`: passed (initial graph 578.2 KiB; largest deferred chunk 290.5 KiB).
- Dangerous-sink scan over the new model/editor returned no matches for `dangerouslySetInnerHTML`, direct HTML writes, dynamic evaluation, URL-state reads, `postMessage`, or `fetch`.
- `git diff --check`: passed.
- `npm audit --omit=dev --ignore-scripts`: one unresolved Low advisory in `postcss-selector-parser` (`GHSA-w9m9-85wc-3x92`); no package mutation was made in this slice.
- Production-build browser smoke passed in a fresh local headless Edge profile: a location was created, room/corridor/wall/door tools produced four shapes, undo/redo changed the count `4 → 3 → 4`, selection and keyboard movement moved a room by one grid cell, and Living Atlas produced a `960×640` WebP preview.
- The generated preview passed the existing rights gate, saved without an error, appeared in the local map library, and opened the Story Pins workspace.
- Mobile smoke passed at `390×844`: document width stayed bounded at `390px`; from a real `scrollTop: 536` panel state, opening Living Atlas reset it to `0` and exposed the editor header and project controls.

## Remaining limitation and next safe action

The Codex Computer Use helper still exits before browser initialization with `windows sandbox failed: helper_unknown_error: setup refresh had errors`, including after the permitted reset/retry sequence. Runtime QA was completed instead through the preinstalled Edge headless DevTools protocol against the local production build; no browser-test dependency or external service was added.

Next safe action: perform optional human exploratory polish, then start the next bounded Living Atlas slice (layers and hex-grid support before lighting/fog). Commit or push only after an explicit user instruction and after isolating the intended diff from the other existing working-tree changes.
