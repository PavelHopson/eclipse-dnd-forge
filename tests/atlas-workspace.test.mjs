import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createEmptyLivingAtlasDocument, readLivingAtlasDocument } from '../src/model/dnd/livingAtlas.ts';
import { atlasWallWidth, isAtlasFloorPoint } from '../src/model/dnd/atlasGeometry.ts';
import { createLocationMapAsset, readLocationMapLibrary, serializeLocationMapLibrary, LOCATION_MAP_LIBRARY_SCHEMA } from '../src/model/dnd/locationMap.ts';
import { CampaignRepository, CAMPAIGN_PREFIX } from '../src/model/dnd/campaignStorage.ts';
import { emptyCampaignWorld } from '../src/model/dnd/campaignDocument.ts';
import { readCampaignBackup } from '../src/model/dnd/campaignBackup.ts';

const preview = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZlZsAAAAASUVORK5CYII=';
const source = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
function map(atlasDocument) {
    return createLocationMapAsset({ id: 'map-test-1', locationId: 'location-0', name: 'Map', fileName: 'map.png', previewDataUrl: preview,
        grid: { type: 'square', scale: 5, unit: 'ft', widthCells: 30, heightCells: 20 },
        provenance: { rightsBasis: 'original', creator: 'Author', provider: '', sourceUrl: null, license: '', attribution: '', commercialIntent: false, commercialRights: 'not-requested', containsRealPerson: false, consentEvidence: '', ipRisk: 'none' },
        ...(atlasDocument ? { atlasDocument } : {}) });
}
const library = (asset) => ({ schemaVersion: LOCATION_MAP_LIBRARY_SCHEMA, maps: [asset] });

test('saved maps round-trip their editable geometry without breaking raster-only records', () => {
    for (const asset of [map(), map(createEmptyLivingAtlasDocument('Map'))]) {
        assert.deepEqual(readLocationMapLibrary(serializeLocationMapLibrary(library(asset))).maps[0], asset);
    }
});
test('map sources reject unknown fields, invalid shapes and grid mismatch before storage', () => {
    const original = map(createEmptyLivingAtlasDocument('Map'));
    for (const change of [
        (value) => { value.atlasDocument.html = '<script>invalid</script>'; },
        (value) => { value.atlasDocument.shapes = [null]; },
        (value) => { value.atlasDocument.widthCells = 31; },
        (value) => { value.grid.type = 'hex'; },
    ]) {
        const value = structuredClone(original); change(value);
        assert.throws(() => readLocationMapLibrary(JSON.stringify(library(value))));
    }
});
test('imported document marker survives serialization and rejects forged source values', () => {
    const doc = { ...createEmptyLivingAtlasDocument(), source: 'imported' };
    assert.equal(readLivingAtlasDocument(JSON.stringify(doc)).source, 'imported');
    assert.throws(() => readLivingAtlasDocument(JSON.stringify({ ...doc, source: 'trusted' })));
    const editor = source('../src/view/dnd/LivingAtlasEditor.tsx');
    const workshop = source('../src/view/dnd/LocationMapWorkshop.tsx');
    assert.match(editor, /source: "imported"/);
    assert.match(workshop, /setRightsBasis\(imported \? "unverified"/);
    assert.match(workshop, /editingMap\?\.provenance/);
});
test('preview and source are one durable write; quota failure cannot half-update a map', () => {
    const values = new Map(); let fail = false;
    const storage = { getItem: (k) => values.get(k) ?? null, setItem: (k,v) => { if(fail)throw new Error('quota'); values.set(k,v); }, get length(){return values.size;}, key:(i)=>[...values.keys()][i] };
    const repo = new CampaignRepository(storage, storage);
    const id = repo.create('Campaign', emptyCampaignWorld()); repo.activate(id);
    const original = map(createEmptyLivingAtlasDocument('First'));
    repo.writeResource('eclipse_location_maps_v1', serializeLocationMapLibrary(library(original)));
    const before = values.get(CAMPAIGN_PREFIX + id);
    const changed = { ...original, atlasDocument: { ...original.atlasDocument, name: 'Changed' }, name: 'Changed' };
    fail = true;
    assert.throws(() => repo.writeResource('eclipse_location_maps_v1', serializeLocationMapLibrary(library(changed))));
    assert.equal(values.get(CAMPAIGN_PREFIX + id), before);
    fail = false;
    const backup = readCampaignBackup(repo.exportRaw());
    assert.deepEqual(readLocationMapLibrary(backup.resources.eclipse_location_maps_v1).maps[0], original);
});
test('continuous floor membership connects intersecting rooms and square-capped diagonal corridors', () => {
    const shapes = [
        { id:'room-a', kind:'room', x:2, y:2, width:5, height:5 },
        { id:'room-b', kind:'room', x:5, y:4, width:5, height:5 },
        { id:'corridor-a', kind:'corridor', x1:7, y1:6, x2:14, y2:13, width:2 },
    ];
    for (const [x,y] of [[4,4],[6,5],[8,7],[12,11],[14,13]]) assert.equal(isAtlasFloorPoint(shapes,x,y),true);
    assert.equal(isAtlasFloorPoint(shapes,15,3),false);
    assert.equal(isAtlasFloorPoint(shapes,12,11),isAtlasFloorPoint([...shapes].reverse(),12,11));
    assert.equal(atlasWallWidth(2),atlasWallWidth(1)*2);
});
test('renderer draws all interiors after outlines and applies door cutouts to walls', () => {
    const renderer = source('../src/view/dnd/AtlasFloorLayer.tsx');
    assert.ok(renderer.indexOf('shape={shape} outline />') < renderer.indexOf('shape={shape} outline={false}'));
    assert.match(renderer, /maskUnits="userSpaceOnUse"/);
    assert.match(renderer, /data-atlas-walls="true"/);
    assert.match(renderer, /atlasWallWidth\(wall.width\)/);
    assert.doesNotMatch(renderer, /dangerouslySetInnerHTML|innerHTML|fetch\(/);
});
test('workspace escapes graph clipping and makes background inert with focus recovery', () => {
    const dialog = source('../src/view/dnd/MapWorkspaceDialog.tsx');
    const css = source('../src/view/dnd/AtlasWorkspace.css');
    assert.match(dialog, /createPortal/); assert.match(dialog, /aria-modal="true"/);
    assert.match(dialog, /node.inert = true/); assert.match(dialog, /previousFocus.focus/);
    assert.match(css, /position: fixed; inset: 0/); assert.match(css, /atlas-inspector\[hidden\]/);
    assert.match(css, /prefers-reduced-motion/); assert.match(css, /safe-area-inset-bottom/);
});
