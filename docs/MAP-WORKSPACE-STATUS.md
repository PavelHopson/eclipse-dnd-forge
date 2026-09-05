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
- Deletion of maps and their pins still uses separate resource writes; a second-write failure can leave orphaned pins, rather than deleting a map that failed to save. A future multi-resource transaction should cover that cleanup.
- Commercial/IP/name gates from the audit remain open; real AI and production configuration were not exercised. Reference Board UI and unrelated app files were not changed in this slice.
- The requested design-taste skill was unavailable; the implementation follows project UX principles and established components/icons, not a third-party interface replica.
- Next: user review of the local editor, then editable geometry controls (resize/groups and layers). Preserve the combined dirty tree; publish only on an explicit user instruction after reviewing the intended diff.
