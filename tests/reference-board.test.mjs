import assert from "node:assert/strict";
import test from "node:test";
import {
    MAX_REFERENCE_ASSETS,
    REFERENCE_BOARD_SCHEMA,
    emptyReferenceBoard,
    provenanceStatus,
    readReferenceBoard,
    serializeReferenceBoard,
} from "../src/model/dnd/referenceBoard.ts";

function asset(overrides = {}) {
    return {
        id: "reference-original-001",
        kind: "character",
        name: "Ash Warden",
        summary: "Silhouette and continuity anchor.",
        stableTraits: ["broken left horn", "silver moon clasp"],
        previewDataUrl: null,
        provenance: {
            kind: "original",
            creator: "Eclipse Forge",
            sourceUrl: null,
            license: "Original project asset",
            containsRealPerson: false,
            consentEvidence: "",
        },
        status: "approved",
        createdAt: 1,
        updatedAt: 2,
        ...overrides,
    };
}

test("round-trips a bounded Reference Board with project bible and stable traits", () => {
    const board = emptyReferenceBoard(1);
    board.bible = {
        title: "Cinder Archive",
        visualDirection: "Quiet dark fantasy with readable silhouettes.",
        palette: ["charcoal", "warm gold"],
        cameraLanguage: "Eye-level portraits, wide location shots.",
        continuityRules: ["Moon clasp always stays silver"],
        avoid: ["Real people", "Franchise marks"],
        updatedAt: 2,
    };
    board.assets = [asset()];

    const parsed = readReferenceBoard(serializeReferenceBoard(board));
    assert.equal(parsed.schemaVersion, REFERENCE_BOARD_SCHEMA);
    assert.equal(parsed.assets[0].stableTraits[0], "broken left horn");
    assert.equal(provenanceStatus(parsed.assets[0].provenance), "complete");
});

test("rejects unknown fields, unsafe provenance URLs and oversized collections", () => {
    const base = { ...emptyReferenceBoard(1), assets: [asset()] };
    assert.throws(
        () => readReferenceBoard(JSON.stringify({ ...base, remotePreviewUrl: "https://example.com/image.png" })),
        /unknown fields/,
    );
    assert.throws(
        () => readReferenceBoard(JSON.stringify({
            ...base,
            assets: [asset({ provenance: { ...asset().provenance, sourceUrl: "http://example.com/source" } })],
        })),
        /must use HTTPS/,
    );
    assert.throws(
        () => readReferenceBoard(JSON.stringify({
            ...base,
            assets: Array.from({ length: MAX_REFERENCE_ASSETS + 1 }, (_, index) => asset({ id: `reference-original-${index + 100}` })),
        })),
        /no more than 24/,
    );
});

test("fails closed when a real person is approved without explicit consent evidence", () => {
    const provenance = {
        ...asset().provenance,
        containsRealPerson: true,
        consentEvidence: "",
    };
    assert.equal(provenanceStatus(provenance), "blocked");
    assert.throws(
        () => readReferenceBoard(JSON.stringify({
            ...emptyReferenceBoard(1),
            assets: [asset({ provenance, status: "approved" })],
        })),
        /complete provenance and consent/,
    );
});

test("accepts only bounded PNG, JPEG or WebP data previews", () => {
    const tinyPng = "data:image/png;base64,iVBORw0KGgo=";
    const parsed = readReferenceBoard(JSON.stringify({
        ...emptyReferenceBoard(1),
        assets: [asset({ previewDataUrl: tinyPng })],
    }));
    assert.equal(parsed.assets[0].previewDataUrl, tinyPng);
    assert.throws(
        () => readReferenceBoard(JSON.stringify({
            ...emptyReferenceBoard(1),
            assets: [asset({ previewDataUrl: "data:image/svg+xml;base64,PHN2Zz4=" })],
        })),
        /unsupported format/,
    );
});
