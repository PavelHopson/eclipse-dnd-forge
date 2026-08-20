import assert from "node:assert/strict";
import test from "node:test";
import {
    REFERENCE_BOARD_SCHEMA,
    provenanceStatus,
    readReferenceBoard,
} from "../src/model/dnd/referenceBoard.ts";

function boardFixture(provenance, status = "approved") {
    return JSON.stringify({
        schemaVersion: REFERENCE_BOARD_SCHEMA,
        bible: {
            title: "Greyhaven",
            visualDirection: "Quiet river-gothic campaign art",
            palette: ["charcoal", "brass"],
            cameraLanguage: "Grounded eye-level frames",
            continuityRules: ["The drowned bell is always cracked"],
            avoid: ["official logos"],
            updatedAt: 1,
        },
        assets: [{
            id: "reference-legal-001",
            kind: "character",
            name: "Mara Vale",
            summary: "Original fictional innkeeper",
            stableTraits: ["weathered brass key"],
            previewDataUrl: null,
            provenance,
            status,
            createdAt: 1,
            updatedAt: 1,
        }],
    });
}

test("existing Reference Board approval fails closed when real-person consent is missing", () => {
    const provenance = {
        kind: "commissioned",
        creator: "Commissioned Artist",
        sourceUrl: null,
        license: "Internal campaign reference only",
        containsRealPerson: true,
        consentEvidence: "",
    };

    assert.equal(provenanceStatus(provenance), "blocked");
    assert.throws(() => readReferenceBoard(boardFixture(provenance)), /complete provenance and consent/);
});

test("existing Reference Board approval rejects incomplete licensed provenance", () => {
    const provenance = {
        kind: "licensed",
        creator: "Example Artist",
        sourceUrl: null,
        license: "",
        containsRealPerson: false,
        consentEvidence: "",
    };

    assert.equal(provenanceStatus(provenance), "review");
    assert.throws(() => readReferenceBoard(boardFixture(provenance)), /complete provenance and consent/);
});

test("Reference Board V1 remains an internal gate, not a commercial media approval", () => {
    const provenance = {
        kind: "original",
        creator: "Eclipse Forge",
        sourceUrl: null,
        license: "Original fictional campaign reference",
        containsRealPerson: false,
        consentEvidence: "",
    };

    const board = readReferenceBoard(boardFixture(provenance));
    assert.equal(board.assets[0].status, "approved");
    assert.equal("commercialUse" in board.assets[0].provenance, false);
    assert.equal("biometricMode" in board.assets[0].provenance, false);
    assert.equal("takedown" in board.assets[0], false);
});
