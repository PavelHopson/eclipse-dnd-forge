import assert from "node:assert/strict";
import test from "node:test";
import {
    MAP_STORY_PIN_LIBRARY_SCHEMA,
    MAX_MAP_STORY_PINS_PER_MAP,
    createMapStoryPin,
    readMapStoryPinLibrary,
    serializeMapStoryPinLibrary,
} from "../src/model/dnd/mapStoryPins.ts";

function pin(index = 1, overrides = {}) {
    return createMapStoryPin({
        id: `pin-test-${index}`,
        mapId: "map-greyhaven-1",
        x: 1200 + index,
        y: 3400 + index,
        label: `Scene ${index}`,
        note: "A bounded narrative note",
        kind: "scene",
        visibility: "gm",
        ...overrides,
    }, 1_700_000_000_000 + index);
}

test("round-trips bounded normalized story-pin coordinates", () => {
    const library = {
        schemaVersion: MAP_STORY_PIN_LIBRARY_SCHEMA,
        pins: [pin()],
    };
    assert.deepEqual(readMapStoryPinLibrary(serializeMapStoryPinLibrary(library)), library);
    assert.equal(library.pins[0].x, 1201);
    assert.equal(library.pins[0].visibility, "gm");
});

test("sanitizes control and bidi characters without treating note text as markup", () => {
    const parsed = pin(2, {
        label: "Hidden\u202e marker\nname",
        note: "<img src=x onerror=alert(1)>",
        visibility: "table",
    });
    assert.equal(parsed.label, "Hidden marker name");
    assert.equal(parsed.note, "<img src=x onerror=alert(1)>");
    assert.equal(parsed.visibility, "table");
});

test("fails closed for unknown fields, invalid coordinates and invalid visibility", () => {
    const base = pin();
    const wrap = (value) => JSON.stringify({ schemaVersion: MAP_STORY_PIN_LIBRARY_SCHEMA, pins: [value] });
    assert.throws(() => readMapStoryPinLibrary(wrap({ ...base, remoteUrl: "https://example.com/pin" })), /unknown fields/);
    assert.throws(() => readMapStoryPinLibrary(wrap({ ...base, x: -1 })), /coordinates/);
    assert.throws(() => readMapStoryPinLibrary(wrap({ ...base, visibility: "public" })), /visibility/);
});

test("enforces unique ids and the per-map story-pin limit", () => {
    const duplicate = pin();
    assert.throws(() => readMapStoryPinLibrary(JSON.stringify({
        schemaVersion: MAP_STORY_PIN_LIBRARY_SCHEMA,
        pins: [duplicate, duplicate],
    })), /duplicate/);

    const pins = Array.from({ length: MAX_MAP_STORY_PINS_PER_MAP + 1 }, (_, index) => pin(index + 1));
    assert.throws(() => readMapStoryPinLibrary(JSON.stringify({
        schemaVersion: MAP_STORY_PIN_LIBRARY_SCHEMA,
        pins,
    })), /no more than 32/);
});

test("rejects oversized or unsupported story-pin libraries", () => {
    assert.throws(() => readMapStoryPinLibrary(" ".repeat(96 * 1024 + 1)), /exceeds 96 KB/);
    assert.throws(() => readMapStoryPinLibrary(JSON.stringify({
        schemaVersion: "eclipse.map-story-pins.v2",
        pins: [],
    })), /unsupported schema/);
});
