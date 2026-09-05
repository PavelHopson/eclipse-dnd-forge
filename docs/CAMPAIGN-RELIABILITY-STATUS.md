# Campaign reliability — status

- Date: 2026-09-05
- Checkout: `E:\projects\eclipse-dnd-forge`, branch `main`; existing dirty work preserved.
- Scope: audit A01–A04 — durable campaign snapshots, campaign isolation, truthful archival and scoped undo.
- Publication: implemented and verified locally; no commit, push or deployment. Baseline is `9f33757` plus the pre-existing Living Atlas, UI and documentation work.
- Source audit: [FUNCTIONAL-AUDIT-2026-09-05.md](FUNCTIONAL-AUDIT-2026-09-05.md). That report remains a historical baseline, not a claim about the updated code.

## Implemented

- Versioned, validated campaign documents with current Slate text, entity/location graph, action edges and campaign-scoped resources. Explicit projection excludes credentials, store actions and transient UI/React Flow state.
- Restore before workspace mount; debounced autosave, explicit retry and visible durable/pending/error status. Saved campaign library distinguishes opening a world from creating a new one.
- Sessions, maps, story pins, Reference Board, world events and initiative use the active campaign namespace. Atlas drafts additionally belong to a location. Switching campaigns reloads the workspace to end old async work and reset history.
- A failed archive write does not create a successful in-memory archive or clear the current text. Successful archival also preserves text edited while an asynchronous recap was running.
- Master-only JSON backup and bounded restore as a new independent campaign; nested resources are validated before import. Corrupt records remain intact and cannot be silently overwritten.
- Legacy resource keys are copied into a separate legacy campaign without deleting originals or guessing their world. A failed legacy copy cannot block an existing active campaign.
- Native browser Web Locks allow one editor per campaign; a document revision comparison also rejects stale writes. Atlas undo/redo stops at its local keyboard scope.
- User explicitly approved the narrow `src/store/useReferenceBoardStore.ts` change for isolation and write failures. `ReferenceBoardPanel.tsx` and `VisualWritingInterface.tsx` were not edited.

## Verification — 2026-09-05

- `npm test`: **93/93 passed** (14 campaign regression tests added to the 79-test baseline).
- `npm run typecheck`, `npm run lint`, `npm run build`: passed.
- `npm run bundle:check`: passed; initial graph 580.4 KiB, largest deferred chunk 273.8 KiB.
- `node scripts/qa-campaign-reliability.mjs`: **12/12 passed** against the final production build on local preview. Isolated headless Edge profile, no paid AI calls or user data.
- Browser evidence: text/world reload; exclusive second-tab editor lock; archive quota failure; backup during failure and retry; map-only undo/redo; separate location drafts; Reference Board separation; new-campaign isolation; reopening old resources; independent backup restore; 390px mobile controls without horizontal overflow; damaged core recovery without overwrite.
- Visual inspection: new campaign library on mobile and campaign bar on desktop. Mouse hit-testing used for drawing; some other browser actions use synthetic clicks. This is not full keyboard/screen-reader/touch coverage.
- `git diff --check`: passed. Pattern-based secret scan of 42 changed/untracked text files: no matches; binaries excluded. Manual review covered imported data, storage writes, error paths and credential exclusion.
- `npm audit --omit=dev --ignore-scripts` and full `npm audit --ignore-scripts --json`: **1 Low**, 0 Moderate/High/Critical. Existing `postcss-selector-parser` advisory [GHSA-w9m9-85wc-3x92](https://github.com/advisories/GHSA-w9m9-85wc-3x92) remains open; dependencies were not changed.
- Security playbook: proportional `conducting-api-security-testing` pass for validation, safe storage, bounded imports and secret handling; no new confirmed Critical/High/Medium security findings in the reviewed surface. This is not a penetration test or release clearance.

## Decisions and remaining limits

- No dependencies or cloud writes. One atomic localStorage write per campaign document for this slice; browser quota can be smaller than the 12 MiB schema/import cap. Large-media IndexedDB storage, backups across devices and crash/power-loss guarantees remain future work.
- A master backup includes narrative secrets and private campaign content; it is not a player handout, encryption or access control. Existing map/media rights gates remain unchanged.
- Browser locks fail closed if unsupported; Safari/Firefox, physical touch/stylus, large-world performance and actual production/AI flows were not tested.
- DM/NPC/play-loop transient conversations remain ephemeral by the existing design. Switching clears them rather than transferring them to another campaign; this slice does not add transcript retention.
- The protected Reference Board UI still emits its old project-bible success feedback unconditionally on save. Store state remains unchanged on failure and the error is exposed, but that UI message needs a separately approved correction. Global undo in other existing panels also remains outside the local Atlas fix.
- Map workspace sizing and geometry (A05–A06), commercial/IP/name gates (A07), real AI verification and the Low dependency advisory are not closed by this slice.
- The requested design-taste skill was unavailable; new controls use existing components/styles and the project's UX principles. No redesign of the existing workspace was attempted.

## Next safe action

Implement A05–A06 as a separate map-workspace slice: viewport-sized canvas, stable editable map documents, correct wall thickness, then room/corridor geometry. Preserve this dirty tree and its other owners' changes; do not publish or create a branch without a current user instruction. Use `apply_patch` for edits; only the standard patch CLI was used where the sandbox helper failed.
