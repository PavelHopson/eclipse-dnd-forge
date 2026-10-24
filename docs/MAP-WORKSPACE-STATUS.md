# Map workspace — status

- Date: 2026-09-05
- Checkout: `E:\projects\eclipse-dnd-forge`, branch `main`, baseline `9f33757` plus existing dirty work.
- Scope: audit A05–A06, viewport-sized workspace, editable map lifecycle, wall width and continuous room/corridor rendering.
- Publication: implemented and verified locally; no commit, push or deployment.
- Source: [functional audit](FUNCTIONAL-AUDIT-2026-09-05.md), following the [campaign reliability slice](CAMPAIGN-RELIABILITY-STATUS.md). Historical reports remain unchanged.
- Decisions: preserve map IDs, pins and provenance on edits; imported geometry does not establish source rights. Keep old raster-only maps readable. No new dependencies, cloud writes or third-party code/assets.

## Implemented

- Viewport portal outside React Flow transforms/clipping. The background is inert while open; Tab stays inside, focus is restored on close, canvas Escape closes only the editor. Responsive toolbar, collapsible inspector, pan and fit-to-view leave the canvas as the main workspace.
- Saved map records can contain a validated `atlasDocument`. Raster-only records remain readable. Preview and editable source are persisted in one campaign write, with grid/source dimension checks and existing file/count/size limits.
- An explicit Edit action reopens each map's own document/draft. Save preserves its map ID, creation time, provenance and Story Pins rather than adding a duplicate. New maps get independent documents; the UI now distinguishes location count from the eight-map campaign limit.
- A newer saved document wins over an old draft; newer unsaved edits remain recoverable. Undo/redo receives fresh timestamps. Save failures preserve the previous durable preview/source and allow retry.
- All room/corridor outlines render before all interiors, removing internal seams independently of shape order. Explicit wall width affects SVG and exports; door masks cut openings through walls. Hit targets/selection are removed from exported images.
- Imported project geometry is marked as imported and does not automatically establish source rights. Existing map provenance is retained; a new imported source requires review. No remote assets, new dependencies, provider calls or third-party implementation were introduced.
- Map deletion asks for confirmation; a failed map write no longer removes its pins. Import/export temporarily blocks competing editor actions.

## Verification — 2026-09-05

- `npm test`: **100/100 passed**, including seven new workspace/model/security regressions.
- `npm run typecheck`, `npm run lint`, `npm run build`: passed.
- `npm run bundle:check`: passed; initial graph 580.4 KiB, largest deferred chunk 280.1 KiB.
- `node scripts/qa-map-workspace.mjs`: **8/8 passed** in a disposable headless Edge profile at desktop 1440×1000 and mobile 390×844, against the production build served locally on port 5197.
- New browser evidence includes real mouse drawing/button hit targets, pixel sampling of floor joins and doorway/wall rendering, undo/redo, reload/edit/save with unchanged IDs/rights/pins, persisted rename, independent second map, quota failure/retry, malformed/valid project imports, mobile layout and keyboard focus/Escape.
- `node scripts/qa-campaign-reliability.mjs 9231 http://127.0.0.1:5197/`: 12/12 passed with the new workspace. The helper now accepts an explicit loopback URL so another project's occupied port need not be reused.
- Visual inspection: desktop canvas and mobile editor with saved geometry, inspector, toolbar and primary action. Physical phone/stylus, Safari/Firefox, screen reader and large-map performance were not tested.
- `git diff --check`: passed. Pattern-based scan of 50 changed/untracked text files found no credential/private-key matches; binaries excluded. Manual review covered schema bounds, stored data, imported source rights, SVG rendering and error paths.
- `npm audit --omit=dev --ignore-scripts`: **one existing Low** (`postcss-selector-parser`, [GHSA-w9m9-85wc-3x92](https://github.com/advisories/GHSA-w9m9-85wc-3x92)); no dependency changes. No new confirmed Critical/High/Medium security findings in the reviewed surface; this was a proportional `conducting-api-security-testing` pass, not a pentest.

## Boundaries and next safe action

- This is non-destructive visual floor union, not a polygon topology/navmesh engine. Arbitrary cutouts, resize/group transforms, curved walls, layers, hex grids, lighting and fog remain future slices. Doors currently use horizontal/vertical grid placement.
- PNG/WebP previews and editable data remain browser-local; localStorage quota and the four-MiB map library/eight-map cap still apply. IndexedDB/media scaling and cloud collaboration are not implemented.
- Historical residual: deletion used separate map/pin writes and a second-write failure could leave orphaned pins. The local atomic-write fix and verification are recorded below (2026-10-09); publication is not implied.
- Commercial/IP/name gates from the audit remain open; real AI and production configuration were not exercised. Reference Board UI and unrelated app files were not changed in this slice.
- The requested design-taste skill was unavailable; the implementation follows project UX principles and established components/icons, not a third-party interface replica.
- Next: user review of the local editor, then editable geometry controls (resize/groups and layers). Preserve the combined dirty tree; publish only on an explicit user instruction after reviewing the intended diff.

## 2026-10-09 — atomic map/pin deletion residual, local only

- Scope: the later deletion residual documented above, not a redefinition or closure of the original geometry/lifecycle audit A06. Checkout `E:/projects/eclipse-dnd-forge`, `main`, HEAD `82b81fe`. No commit, push or deployment in this slice.
- Reproduction: the old browser path passed the existing eight map checks, then failed the new check `Failed deletion must retain the map` when a pins-changing storage write was rejected. The map had already been persisted as deleted while its pins remained.
- Fix: `CampaignRepository.writeResources` validates every resource before using the existing single-document commit, including writer ownership, revision and storage bounds checks. Map deletion reads both libraries from the campaign repository and submits both replacements together. Stores and selection update only after success; failure keeps the map and pins, displays the existing error and scrolls it into view. Retry deletes only the selected map and its pins. No schema migration or dependency change.
- Exact write-set: `src/model/dnd/campaignStorage.ts`, `src/store/useLocationMapStore.ts`, `src/view/dnd/LocationMapWorkshop.tsx`, `tests/campaign-storage.test.mjs`, `tests/map-story-pins-ui.test.mjs`, `scripts/qa-map-workspace.mjs`, `docs/MAP-WORKSPACE-STATUS.md`.
- The accepted Project Bible slice (five files listed in `CAMPAIGN-RELIABILITY-STATUS.md`) and unrelated `README.md` were preserved, with before/after SHA-256 checks. No Reference Board UI/store changes were made in this slice.

### Verification

- `npm.cmd test`: **114/114 passed**. `node --experimental-strip-types --test tests/campaign-storage.test.mjs tests/map-story-pins-ui.test.mjs tests/atlas-workspace.test.mjs`: **32/32 passed**.
- `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run build`, `npm.cmd run bundle:check`: passed. Bundle budget: initial graph 580.4 KiB, largest deferred chunk 291.7 KiB. `node --check scripts/qa-map-workspace.mjs`: passed.
- `node scripts/qa-map-workspace.mjs 9232 http://127.0.0.1:5198/`: **9/9 passed**, production build served by Vite preview, disposable headless Edge profile. The new desktop scenario rejects a maps-changing write and then a pins-changing write; both retain durable resources and visible map/pins without false success. Retry produces exactly one map/pins-changing commit with revision +1 and unchanged world payload; another map and its pins survive, including reload.
- Independent graph-layout autosaves may advance the campaign revision during the scenario. The regression measures the deletion commit itself, not all unrelated autosaves over the whole scenario.
- `node scripts/qa-campaign-reliability.mjs 9232 http://127.0.0.1:5198/`: **14/14 passed** in a separate fresh profile, including Project Bible failure/retry/reload, campaign isolation, backup and corruption handling.
- Existing map desktop/mobile and keyboard checks passed; the new deletion fault scenario ran at 1440×1000. Native confirmation was stubbed to accept the exact deletion prompt; the native dialog itself, physical touch/stylus, screen readers, Firefox and Safari were not tested.
- Visual evidence retained locally in `C:/Users/garaa/Documents/Codex/2026-08-23/dnd/a06-map-delete-2026-10-09-after/`: `map-delete-eclipse_location_maps_v1-failure.png` and `map-delete-eclipse_map_story_pins_v1-failure.png`. The latter was visually inspected for the visible error and retained map/pin.
- Proportional storage security review covered blocked/unknown resources, writer ownership and stale revisions with negative tests. No new confirmed security finding in this bounded surface; this is not general security clearance. No dependency changes or fresh dependency advisory audit in this slice.
- Remaining boundaries: browser-local storage limits still apply. A07/IP/trademark, server-owned ACL, authentication/PKCE, rollback/SLO and full player journeys remain outside this fix and are not accepted by these checks. No paid AI calls or real campaign data were used.

### Independent local acceptance — A-00, 2026-10-09

- A-00 accepted this deletion residual locally after reviewing the atomic commit, validation, writer-ownership and stale-revision guards; independently repeated focused tests **32/32**, a fresh build and map browser regression **9/9** on its own preview/headless Edge. Both injected write failures retained map/pins in UI and storage; retry used one resource-changing write, with the second map preserved after reload. A-00 also inspected the visible failure screenshot.
- Local evidence: [A-00 receipt](C:/Users/garaa/.codex/visualizations/2026/09/13/01a09b0e-bbf6-71b3-bbd4-bd865dc5e8a7/portfolio-goal-2026-10-08/dnd-map-delete-review-20261009/receipt.json), timestamp `2026-10-09T11:39:07.385Z`, result `PASS`, browser exit `0`. All four source SHA-256 values in the receipt were matched against this checkout before recording acceptance.
- Native confirmation was accepted by the QA harness; no real campaign data, providers or production were used. This acceptance does not authorize merge, push or deployment. The user's clarification of upload meaning/scope remains pending; no new implementation work is started.
