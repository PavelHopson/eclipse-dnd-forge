import assert from "node:assert/strict";
import test from "node:test";
import {
    LOCATION_MAP_LIBRARY_SCHEMA,
    createLocationMapAsset,
    evaluateLocationMapRights,
    readLocationMapLibrary,
    serializeLocationMapLibrary,
    validateLocationMapPreviewDataUrl,
    validateLocationMapSourceHeader,
} from "../src/model/dnd/locationMap.ts";

const PREVIEW = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZlZsAAAAASUVORK5CYII=";

function provenance(overrides = {}) {
    return {
        rightsBasis: "original",
        creator: "Campaign author",
        provider: "",
        sourceUrl: null,
        license: "",
        attribution: "",
        commercialIntent: false,
        commercialRights: "not-requested",
        containsRealPerson: false,
        consentEvidence: "",
        ipRisk: "none",
        ...overrides,
    };
}

function asset(provenanceOverrides = {}) {
    return createLocationMapAsset({
        id: "map-greyhaven-1",
        locationId: "location-1",
        name: "Drowned Tunnels",
        fileName: "drowned-tunnels.png",
        previewDataUrl: PREVIEW,
        grid: { type: "square", scale: 5, unit: "ft", widthCells: 30, heightCells: 20 },
        provenance: provenance(provenanceOverrides),
    }, 1_700_000_000_000);
}

test("round-trips an allowed local location-map asset", () => {
    const map = asset();
    const library = { schemaVersion: LOCATION_MAP_LIBRARY_SCHEMA, maps: [map] };
    const parsed = readLocationMapLibrary(serializeLocationMapLibrary(library));

    assert.equal(map.rightsState, "allowed");
    assert.deepEqual(parsed, library);
    assert.equal(validateLocationMapPreviewDataUrl(PREVIEW), PREVIEW);
});

test("external-tool maps stay review-required until records and commercial rights are complete", () => {
    const review = provenance({
        rightsBasis: "external-tool",
        provider: "Example mapper",
        sourceUrl: "https://example.com/terms",
        license: "CC BY 4.0",
        attribution: "Map created with Example mapper",
        commercialIntent: true,
        commercialRights: "unknown",
    });
    assert.deepEqual(evaluateLocationMapRights(review), {
        state: "review-required",
        reasons: ["commercial-rights-unverified"],
    });

    assert.equal(evaluateLocationMapRights({
        ...review,
        commercialRights: "confirmed",
    }).state, "allowed");
});

test("unverified rights, missing consent and prohibited derivative/commercial use fail closed", () => {
    assert.equal(evaluateLocationMapRights(provenance({ rightsBasis: "unverified" })).state, "blocked");
    assert.equal(evaluateLocationMapRights(provenance({
        containsRealPerson: true,
        consentEvidence: "",
    })).state, "blocked");
    assert.equal(evaluateLocationMapRights(provenance({ ipRisk: "blocked" })).state, "blocked");
    assert.equal(evaluateLocationMapRights(provenance({
        commercialIntent: true,
        commercialRights: "prohibited",
    })).state, "blocked");
});

test("image validation accepts allowlisted magic bytes and rejects active or mismatched formats", () => {
    const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    assert.equal(validateLocationMapSourceHeader("image/png", png), "image/png");
    assert.throws(() => validateLocationMapSourceHeader("image/jpeg", png), /does not match|соответствует/);
    assert.throws(() => validateLocationMapSourceHeader("image/svg+xml", png), /PNG, JPEG and WebP|PNG, JPEG и WebP/);
});

test("library parser rejects unknown fields and rights-state drift", () => {
    const map = asset();
    assert.throws(
        () => readLocationMapLibrary(JSON.stringify({
            schemaVersion: LOCATION_MAP_LIBRARY_SCHEMA,
            maps: [{ ...map, remoteUrl: "https://example.com/map.png" }],
        })),
        /unknown fields/,
    );
    assert.throws(
        () => readLocationMapLibrary(JSON.stringify({
            schemaVersion: LOCATION_MAP_LIBRARY_SCHEMA,
            maps: [{ ...map, rightsState: "blocked" }],
        })),
        /does not match/,
    );
});
