# Campaign reliability — status

## Current combined QA — 2026-10-20

- Полный `node scripts/qa-campaign-reliability.mjs` на production build,
  isolated headless Edge, desktop 1440×1000 и mobile 390×844: **15/15 PASS**.
- В этот прогон входят world timeline label regression, browser writer lock,
  archive/backup/retry, campaign isolation, map drafts, Reference Board,
  mobile overflow и fail-closed corruption recovery.
- Screenshot harness capture через `QA_SCREENSHOT_DIR` подтвердил 8 PNG:
  timeline desktop/mobile и Project Bible desktop/mobile failure/success/reload.
- Тестовый harness для offline Shared Table использует явный active lifecycle,
  чтобы visibility check не зависел от поведения headless browser.

## EF-05 / Project Bible recovery — 2026-10-08

- Scope: the residual false-success finding adjacent to A02, not a reopening of the fixed session-archive bug. Local implementation only on existing `main`, HEAD `82b81fe`; no branch, commit, push or deploy. Pre-existing README and untracked documentation remain untouched.
- `saveBible` now returns durable success explicitly. Validation/storage failure keeps the previous board and exposes a bounded error. The UI retains the editor and all six draft fields, clears stale success, and shows the error beside the retry action. Error scrolling preserves keyboard focus; successful retry returns focus to Edit.
- The draft is retained in the open editor, not a new persistent draft service: explicitly closing the panel or reloading before a successful retry can still discard unsaved edits.
- Write-set: `src/store/useReferenceBoardStore.ts`, `src/view/dnd/ReferenceBoardPanel.tsx`, `scripts/qa-campaign-reliability.mjs`, `tests/reference-board-ui.test.mjs`, this status file. No storage schema, dependencies, auth, media-rights rules or campaign-content changes.

### Acceptance evidence

- Local production build, isolated headless Edge, desktop **1440x1000** and mobile emulation **390x844**: **2/2 focused scenarios passed**. All six fields are filled through keyboard input/Tab; Enter triggers save and retry. Board opening uses the existing click helper, not an end-to-end keyboard-only application journey.
- Each scenario first saves a baseline, then intercepts only a changed Reference Board write in the active synthetic campaign with `QuotaExceededError`. Verified: the failure is actually triggered, prior durable/in-memory board is unchanged, all draft values remain, no success appears, the alert is visible, focus remains on Save, retry clears the error, and all six values survive reload.
- Full `node scripts/qa-campaign-reliability.mjs 9231 http://127.0.0.1:5197/`: **14/14 passed** (the previous 12 scenarios plus the two recovery scenarios).
- `npm test`: **111/111 passed**. Focused model/UI-contract/storage tests: **21/21 passed**. The UI-contract test reads source; browser evidence above is the behavioral proof.
- `npm run typecheck`, `npm run lint`, `npm run build`, `npm run bundle:check`: passed. Final bundle: initial graph **580.4 KiB**, largest deferred chunk **291.2 KiB**.
- `node --check scripts/qa-campaign-reliability.mjs`, `git diff --check`, scoped credential/private-key pattern scan and manual diff review: passed. No new security finding identified in this bounded change; validation and campaign isolation are unchanged, and draft content is not logged or sent remotely. No fresh dependency audit or production security test was run.
- Six local PNGs capture failure/success/reload on both sizes via optional `QA_SCREENSHOT_DIR`. Failure and success screenshots were visually reviewed. Existing mobile workspace tabs overlap part of the panel header; the tested error/retry controls remain visible. That surrounding layout, physical touch, screen readers and Safari/Firefox are not accepted by this slice.

### Local reproduction

Use a fresh disposable headless Edge/Chromium profile whose `--user-data-dir` contains `eclivarium-reliability-`, with `--enable-automation`, `--headless=new`, `--remote-debugging-port=9231`, and the preview URL below. Do not reuse an ordinary profile; the script rejects it. Check that ports 5197/9231 are available before starting your own processes.

```powershell
Set-Location E:\projects\eclipse-dnd-forge
npm.cmd run build
# Stop if the build fails. In a separate terminal, serve the build:
npm.cmd run preview -- --host 127.0.0.1 --port 5197 --strictPort
```

With preview and the isolated browser running, run one of the following against a fresh profile (the full suite includes the focused scenarios):

```powershell
Set-Location E:\projects\eclipse-dnd-forge
node scripts/qa-campaign-reliability.mjs 9231 http://127.0.0.1:5197/ --bible-only
# Or, in another fresh profile:
node scripts/qa-campaign-reliability.mjs 9231 http://127.0.0.1:5197/
```

A07/IP/notices/trademark, server campaign ACL, real-user PKCE canary, rollback/SLO, the three full player journeys, and atomic map/pins deletion remain open. No paid AI or production calls, billing changes or table edits were performed.

## Historical campaign reliability slice — 2026-09-05

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
- At the September 5 checkpoint, the protected Reference Board UI still emitted project-bible success feedback unconditionally on save. This residual is superseded by the local October 8 recovery evidence above. Global undo in other existing panels remains outside the local Atlas fix.
- Map workspace sizing and geometry (A05–A06), commercial/IP/name gates (A07), real AI verification and the Low dependency advisory are not closed by this slice.
- The requested design-taste skill was unavailable; new controls use existing components/styles and the project's UX principles. No redesign of the existing workspace was attempted.

## Next safe action

Implement A05–A06 as a separate map-workspace slice: viewport-sized canvas, stable editable map documents, correct wall thickness, then room/corridor geometry. Preserve this dirty tree and its other owners' changes; do not publish or create a branch without a current user instruction. Use `apply_patch` for edits; only the standard patch CLI was used where the sandbox helper failed.
