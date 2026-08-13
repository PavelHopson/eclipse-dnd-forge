import assert from "node:assert/strict";
import test from "node:test";
import {
    CAMPAIGN_MAP_ASSET_SCHEMA,
    buildCampaignMapAsset,
    readCampaignMapAsset,
    readMapImport,
    serializeCampaignMapAsset,
} from "../src/model/dnd/campaignMapContract.ts";
import { readAzgaarExport } from "../src/model/dnd/azgaarImport.ts";

function exportFixture(burgs) {
    return JSON.stringify({
        info: { mapName: "The Shattered Realm", version: "1.139.7" },
        pack: { burgs },
    });
}

test("round-trips a bounded Campaign Map Asset through the same preview gate", () => {
    const summary = readAzgaarExport(exportFixture([
        { i: 1, x: 10, y: 20, name: "Highcourt", capital: 1, population: 120 },
        { i: 2, x: 30, y: 40, name: "Port Azure", port: 1, population: 80 },
    ]));
    const raw = serializeCampaignMapAsset(buildCampaignMapAsset(summary, summary.places));
    const asset = JSON.parse(raw);

    assert.equal(asset.schemaVersion, CAMPAIGN_MAP_ASSET_SCHEMA);
    assert.deepEqual(readCampaignMapAsset(raw).places, summary.places);
    assert.equal(readMapImport(raw).inputKind, "campaign-map-asset");
});

test("Campaign Map Asset rejects unknown fields, duplicates and oversized collections", () => {
    const base = {
        schemaVersion: CAMPAIGN_MAP_ASSET_SCHEMA,
        map: { name: "Realm", source: "Azgaar", sourceVersion: null },
        places: [{ sourceId: 1, name: "Gate", population: 10, capital: false, port: false, fortified: true }],
    };

    assert.throws(
        () => readCampaignMapAsset(JSON.stringify({ ...base, remoteUrl: "https://example.com/map.json" })),
        /unknown fields/,
    );
    assert.throws(
        () => readCampaignMapAsset(JSON.stringify({ ...base, places: [...base.places, { ...base.places[0] }] })),
        /duplicated/,
    );
    assert.throws(
        () => readCampaignMapAsset(JSON.stringify({
            ...base,
            places: Array.from({ length: 61 }, (_, index) => ({ ...base.places[0], sourceId: index, name: "Gate " + index })),
        })),
        /no more than 60/,
    );
});
