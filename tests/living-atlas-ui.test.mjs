import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const editor = await readFile(new URL("../src/view/dnd/LivingAtlasEditor.tsx", import.meta.url), "utf8");
const workshop = await readFile(new URL("../src/view/dnd/LocationMapWorkshop.tsx", import.meta.url), "utf8");
const styles = await readFile(new URL("../src/view/dnd/MapWorkshop.css", import.meta.url), "utf8");

test("Living Atlas exposes an obvious bounded drawing path", () => {
    for (const label of ["Выбор", "Комната", "Коридор", "Стена", "Дверь"]) assert.match(editor, new RegExp(label));
    assert.match(editor, /onPointerDown=\{startDrawing\}/);
    assert.match(editor, /onPointerMove=\{continuePointer\}/);
    assert.match(editor, /Отменить изменение/);
    assert.match(editor, /Вернуть изменение/);
    assert.match(editor, /Использовать в локации/);
});

test("Living Atlas project import is local, bounded and parsed through the strict model", () => {
    assert.match(editor, /MAX_LIVING_ATLAS_FILE_BYTES/);
    assert.match(editor, /readLivingAtlasDocument\(await file\.text\(\)\)/);
    assert.match(editor, /serializeLivingAtlasDocument/);
    assert.match(editor, /campaignResourceStorage\.setItem/);
    assert.doesNotMatch(editor, /localStorage\.setItem/);
    assert.doesNotMatch(editor, /dangerouslySetInnerHTML|innerHTML|<iframe|\bfetch\s*\(/);
});

test("Living Atlas is integrated as a first-class location-map action", () => {
    assert.match(workshop, /<LivingAtlasEditor/);
    assert.match(workshop, /Нарисовать карту/);
    assert.match(workshop, /setRightsBasis\(imported \? "unverified" : previous\?\.rightsBasis \?\? "original"\)/);
    assert.match(workshop, /atlasDocument:/);
    assert.match(editor, /closest\("\.map-workflow-panel"\)/);
    assert.match(editor, /scrollTo\(\{ top: 0, left: 0 \}\)/);
});

test("Living Atlas visual contract covers focus, responsive layout and reduced motion", () => {
    assert.match(styles, /\.living-atlas-editor\s*\{/);
    assert.match(styles, /\.atlas-canvas\s*\{/);
    assert.match(styles, /\.atlas-tool\.is-active\s*\{/);
    assert.match(styles, /@media \(max-width: 760px\)/);
    assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
});
