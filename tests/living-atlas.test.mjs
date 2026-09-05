import assert from "node:assert/strict";
import test from "node:test";
import {
    LIVING_ATLAS_SCHEMA,
    MAX_LIVING_ATLAS_FILE_BYTES,
    createEmptyLivingAtlasDocument,
    readLivingAtlasDocument,
    safeLivingAtlasFileStem,
    serializeLivingAtlasDocument,
} from "../src/model/dnd/livingAtlas.ts";

test("Living Atlas round-trips a bounded versioned vector project", () => {
    const document = createEmptyLivingAtlasDocument("Затопленный архив", 32, 24, 100);
    document.shapes = [
        { id: "room-main", kind: "room", x: 2, y: 3, width: 8, height: 6 },
        { id: "corridor-east", kind: "corridor", x1: 10, y1: 6, x2: 18, y2: 6, width: 2 },
        { id: "wall-north", kind: "wall", x1: 2, y1: 3, x2: 10, y2: 3, width: 1 },
        { id: "door-main", kind: "door", x: 10, y: 6, rotation: 90 },
    ];
    document.updatedAt = 101;

    const restored = readLivingAtlasDocument(serializeLivingAtlasDocument(document));
    assert.equal(restored.schemaVersion, LIVING_ATLAS_SCHEMA);
    assert.equal(restored.name, "Затопленный архив");
    assert.deepEqual(restored.shapes, document.shapes);
});

test("Living Atlas import fails closed for unknown fields, bounds and duplicate ids", () => {
    const document = createEmptyLivingAtlasDocument("Карта", 30, 20, 100);
    assert.throws(() => readLivingAtlasDocument(JSON.stringify({ ...document, remoteUrl: "https://example.com/map" })), /unknown fields/);

    document.shapes = [{ id: "room-bad", kind: "room", x: 29, y: 19, width: 4, height: 4 }];
    assert.throws(() => readLivingAtlasDocument(JSON.stringify(document)), /exceeds the canvas bounds/);

    document.shapes = [
        { id: "door-same", kind: "door", x: 3, y: 3, rotation: 0 },
        { id: "door-same", kind: "door", x: 4, y: 4, rotation: 90 },
    ];
    assert.throws(() => readLivingAtlasDocument(JSON.stringify(document)), /duplicate shape ids/);
});

test("Living Atlas treats hostile-looking names as bounded text and safe filenames", () => {
    const document = createEmptyLivingAtlasDocument('<img src=x onerror="alert(1)">\u202e', 30, 20, 100);
    assert.equal(document.name, '<img src=x onerror="alert(1)">');
    assert.equal(safeLivingAtlasFileStem(document.name), "-img src=x onerror=-alert(1)-");
});

test("Living Atlas rejects oversized and malformed project files", () => {
    assert.throws(() => readLivingAtlasDocument("{"), /invalid JSON/);
    assert.throws(() => readLivingAtlasDocument("x".repeat(MAX_LIVING_ATLAS_FILE_BYTES + 1)), /exceeds 1 MB/);
});
