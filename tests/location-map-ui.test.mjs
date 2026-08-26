import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workshop = await readFile(new URL("../src/view/dnd/LocationMapWorkshop.tsx", import.meta.url), "utf8");
const panel = await readFile(new URL("../src/view/dnd/MapWorkflowPanel.tsx", import.meta.url), "utf8");

test("Map Workshop keeps the primary path visible and accessible", () => {
    assert.match(panel, /role="tablist"/);
    assert.match(panel, /aria-selected=/);
    assert.match(workshop, /Сохранить карту локации/);
    assert.match(workshop, /role="alert"/);
    assert.match(workshop, /aria-live="polite"/);
    assert.match(workshop, /isDisabled=\{!previewDataUrl \|\| !name\.trim\(\)\}/);
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
    assert.match(workshop, /не копирует их код, интерфейс, форматы или assets/);
    assert.match(workshop, /не подтверждает ваши права автоматически/);
    assert.match(workshop, /Product trademark gate остаётся отдельным/);
});
