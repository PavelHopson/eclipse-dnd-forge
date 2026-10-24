import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("Reference Board wizard exposes the six bounded asset kinds and clear states", async () => {
  const [panel, contract] = await Promise.all([
    readFile(new URL("src/view/dnd/ReferenceBoardPanel.tsx", root), "utf8"),
    readFile(new URL("src/model/dnd/referenceBoard.ts", root), "utf8"),
  ]);

  for (const kind of ["character", "creature", "location", "object", "pose", "shot"]) {
    assert.match(contract, new RegExp(`\\"${kind}\\"`));
  }
  assert.match(panel, /Project bible/);
  assert.match(panel, /Stable traits/);
  assert.match(panel, /Preview/);
  assert.match(panel, /Provenance и статус/);
  assert.match(panel, /role="alert"/);
  assert.match(panel, /role="status"/);
  assert.match(panel, /isReadingPreview/);
  assert.match(panel, /containsRealPerson/);
  assert.match(panel, /disabled=\{rightsStatus !== "complete"\}/);
});

test("Reference Board visual contract covers mobile, focus and reduced motion", async () => {
  const styles = await readFile(new URL("src/view/dnd/ReferenceBoardPanel.css", root), "utf8");

  assert.match(styles, /\.reference-board-panel/);
  assert.match(styles, /:focus-visible/);
  assert.match(styles, /@media \(max-width: 760px\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /grid-template-columns: 1fr/);
});

test("Project Bible success requires a durable save and keeps a keyboard recovery path", async () => {
  const panel = await readFile(new URL("src/view/dnd/ReferenceBoardPanel.tsx", root), "utf8");
  const store = await readFile(new URL("src/store/useReferenceBoardStore.ts", root), "utf8");
  const handler = panel.slice(panel.indexOf("const saveBible ="), panel.indexOf("const downloadBoard ="));
  assert.match(store, /saveBible: \(bible: Omit<ReferenceProjectBible, "updatedAt">\) => boolean/);
  assert.match(handler, /setFeedback\(null\)/);
  assert.match(handler, /if \(!saved\) return;/);
  assert.ok(handler.indexOf("if (!saved) return;") < handler.indexOf("setIsEditingBible(false)"));
  assert.match(handler, /bibleEditButtonRef\.current\?\.focus\(\)/);
  assert.match(panel, /className="reference-message is-error is-wide" role="alert"/);
  assert.match(panel, /bibleErrorRef\.current\?\.scrollIntoView\(\{ block: "center" \}\)/);
});
