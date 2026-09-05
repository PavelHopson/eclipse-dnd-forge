import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workshop = await readFile(new URL("../src/view/dnd/LocationMapWorkshop.tsx", import.meta.url), "utf8");
const panel = await readFile(new URL("../src/view/dnd/MapWorkflowPanel.tsx", import.meta.url), "utf8");
const styles = await readFile(new URL("../src/view/dnd/MapWorkshop.css", import.meta.url), "utf8");
const locationsEditor = await readFile(new URL("../src/view/locationView/LocationsEditor.tsx", import.meta.url), "utf8");

test("Map Workshop keeps the primary path visible and accessible", () => {
    assert.match(panel, /role="tablist"/);
    assert.match(panel, /aria-selected=/);
    assert.match(workshop, /Сохранить карту/);
    assert.match(workshop, /role="alert"/);
    assert.match(workshop, /aria-live="polite"/);
    assert.match(workshop, /isDisabled=\{!previewDataUrl \|\| !name\.trim\(\)\}/);
});

test("Map Workshop keeps one map-first workspace across desktop and mobile", () => {
    assert.match(panel, /import "\.\/MapWorkshop\.css"/);
    assert.match(panel, /className="dnd-overlay-panel map-workflow-panel"/);
    assert.ok(
        workshop.indexOf("<MapStoryPins") < workshop.indexOf("className=\"map-import-drawer\""),
        "the active map should appear before the secondary import form",
    );
    assert.equal(workshop.match(/<MapStoryPins/g)?.length, 1);
    assert.match(styles, /\.map-story-workspace\s*\{/);
    assert.match(styles, /\.map-story-board\s*\{/);
    assert.match(styles, /@media \(max-width: 760px\)/);
    assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
});

test("Map Workshop image import stays local and rejects active remote rendering surfaces", () => {
    assert.match(workshop, /accept="\.png,\.jpg,\.jpeg,\.webp,image\/png,image\/jpeg,image\/webp"/);
    assert.match(workshop, /validateLocationMapSourceHeader/);
    assert.match(workshop, /rel="noopener noreferrer"/);
    assert.doesNotMatch(workshop, /dangerouslySetInnerHTML/);
    assert.doesNotMatch(workshop, /<iframe/);
    assert.doesNotMatch(workshop, /\bfetch\s*\(/);
});

test("external map tools remain explicitly non-affiliated research references", () => {
    assert.match(workshop, /не копирует их код, интерфейс, форматы или материалы/);
    assert.match(workshop, /не подтверждает ваши права автоматически/);
    assert.match(workshop, /Проверка названия продукта остаётся отдельным этапом/);
});

test("manual locations use stable storage-safe ids instead of user text", () => {
    assert.match(locationsEditor, /event\.currentTarget\.value\.trim\(\)/);
    assert.match(locationsEditor, /new Set\(locationNodes\.map\(\(node\) => node\.id\)\)/);
    assert.match(locationsEditor, /while \(existingLocationIds\.has\(`location-\$\{nextLocationIndex\}`\)\)/);
    assert.match(locationsEditor, /id: `location-\$\{nextLocationIndex\}`/);
    assert.doesNotMatch(locationsEditor, /id: `location-\$\{location\}`/);
});
