import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pins = await readFile(new URL("../src/view/dnd/MapStoryPins.tsx", import.meta.url), "utf8");
const workshop = await readFile(new URL("../src/view/dnd/LocationMapWorkshop.tsx", import.meta.url), "utf8");

test("Story Pins expose an obvious mouse path and a keyboard-equivalent action", () => {
    assert.match(pins, /Интерактивная карта/);
    assert.match(pins, /onClick=\{placePin\}/);
    assert.match(pins, /Метка в центре/);
    assert.match(pins, /aria-label=\{`Интерактивная карта/);
    assert.match(pins, /MAX_MAP_STORY_PINS_PER_MAP/);
});

test("player preview hides GM-only pins and never claims access control", () => {
    assert.match(pins, /pins\.filter\(\(pin\) => pin\.visibility === "table"\)/);
    assert.match(pins, /локальный preview, а не защита доступа/);
    assert.match(pins, /Только мастер/);
    assert.match(pins, /Можно показать игрокам/);
});

test("blocked maps cannot create or edit derivative story pins", () => {
    assert.match(pins, /map\.rightsState !== "blocked"/);
    assert.match(pins, /новые производные метки нельзя добавлять или редактировать/);
    assert.match(pins, /role="alert"/);
});

test("Story Pins render bounded React text without active remote surfaces", () => {
    assert.doesNotMatch(pins, /dangerouslySetInnerHTML/);
    assert.doesNotMatch(pins, /<iframe/);
    assert.doesNotMatch(pins, /\bfetch\s*\(/);
    assert.doesNotMatch(pins, /\beval\s*\(/);
});

test("deleting a saved map also removes its local story pins", () => {
    assert.match(workshop, /removePinsForMap\(mapId\)/);
    assert.match(workshop, /<MapStoryPins key=\{activeMap\.id\} map=\{activeMap\}/);
});

test("player handout renderer uses the redacted plan and local canvas only", () => {
    assert.match(pins, /prepareMapPlayerHandout\(map, pins\)/);
    assert.match(pins, /for \(const pin of plan\.pins\)/);
    assert.match(pins, /canvas\.toBlob/);
    assert.match(pins, /URL\.createObjectURL/);
    assert.match(pins, /URL\.revokeObjectURL/);
    assert.match(pins, /без GM-меток и заметок/);
    assert.doesNotMatch(pins, /\bfetch\s*\(/);
});

test("handout download remains closed until rights are allowed", () => {
    assert.match(pins, /handoutPlan\.state === "ready"/);
    assert.match(pins, /права карты требуют ручной проверки/);
    assert.match(pins, /карта заблокирована rights gate/);
});
