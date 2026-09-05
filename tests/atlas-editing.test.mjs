import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { atlasLayers, atlasVisibleShapes, atlasEditableShapes, BASE_ATLAS_LAYER_ID, MAX_ATLAS_LAYERS,
    createEmptyLivingAtlasDocument, readLivingAtlasDocument, serializeLivingAtlasDocument } from '../src/model/dnd/livingAtlas.ts';
import { resizeAtlasShape, selectAtlasRectangle, selectionBounds, transferAtlasSelection, translateAtlasSelection } from '../src/model/dnd/atlasEditing.ts';
import { CampaignRepository } from '../src/model/dnd/campaignStorage.ts';
import { emptyCampaignWorld } from '../src/model/dnd/campaignDocument.ts';
import { readCampaignBackup } from '../src/model/dnd/campaignBackup.ts';
const base = { id: BASE_ATLAS_LAYER_ID, name: 'Основа', visible: true, locked: false };
const upper = { id: 'layer-upper', name: 'Details', visible: true, locked: false };
const document = () => ({ ...createEmptyLivingAtlasDocument('Edit', 30, 20, 100), shapes: [
    { id: 'room-one', kind: 'room', x: 2, y: 3, width: 5, height: 4 },
    { id: 'room-two', kind: 'room', x: 10, y: 4, width: 3, height: 5 },
    { id: 'line-one', kind: 'wall', x1: 3, y1: 12, x2: 15, y2: 12, width: 2 },
    { id: 'door-one', kind: 'door', x: 7, y: 5, rotation: 90 },
] });
const read = doc => readLivingAtlasDocument(JSON.stringify(doc));

test('legacy projects preserve bytes and geometry while acquiring a stable implicit base layer', () => {
    const doc = document(), parsed = read(doc);
    assert.deepEqual(parsed, doc);
    assert.deepEqual(atlasLayers(parsed), [base]);
    assert.equal(parsed.layers, undefined);
    assert.deepEqual(atlasEditableShapes(parsed), doc.shapes);
});

test('layered projects round-trip source markers, hidden objects and ordering without gaining rights', () => {
    const doc = document();
    doc.layers = [upper, { ...base, visible: false }];
    doc.shapes[1].layerId = upper.id; doc.source = 'imported';
    const parsed = readLivingAtlasDocument(serializeLivingAtlasDocument(doc));
    assert.deepEqual(parsed, doc);
    assert.deepEqual(atlasVisibleShapes(parsed).map(s => s.id), ['room-two']);
    assert.equal(parsed.shapes.length, 4, 'master files retain hidden objects');
    doc.layers[1].visible = true;
    assert.deepEqual(atlasVisibleShapes(doc).map(s => s.id), ['room-two', 'room-one', 'line-one', 'door-one']);
});

test('layer parser fails closed for hostile fields, flags, IDs, absent base and size limits', () => {
    const doc = { ...document(), layers: [base, upper] };
    const badLayers = [[], [upper], [base, base], [{ ...base, locked: 'false' }], [{ ...base, visible: 1 }],
        [{ ...base, html: '<img>' }], [{ ...base, name: '\u202e' }], [base, { ...upper, id: 'url(#x)' }],
        [null], Array.from({length: MAX_ATLAS_LAYERS + 1}, (_, i) => ({ ...base, id: i ? 'layer-' + i : base.id }))];
    for (const layers of badLayers) assert.throws(() => read({ ...doc, layers }));
    for (const layerId of ['missing-layer', '../path', null, {}, '']) {
        assert.throws(() => read({ ...doc, shapes: [{ ...doc.shapes[0], layerId }] }));
    }
    assert.throws(() => read({ ...document(), shapes: [{ ...doc.shapes[0], layerId: upper.id }] }));
});

test('group movement clamps one shared delta at every edge and keeps relative positions and IDs', () => {
    const doc = document(), ids = doc.shapes.map(s => s.id);
    const shapes = translateAtlasSelection(doc, ids, -100, 100);
    assert.deepEqual(selectionBounds(shapes), { left: 0, top: 11, right: 13, bottom: 20 });
    assert.equal(shapes[1].x - shapes[0].x, 8);
    assert.deepEqual(shapes.map(s => s.id), ids);
    assert.deepEqual(shapes[2], { ...doc.shapes[2], x1: 1, x2: 13, y1: 20, y2: 20 });
    read({ ...doc, shapes });
    assert.equal(translateAtlasSelection(doc, ids, NaN, 1), doc.shapes);
    assert.equal(translateAtlasSelection(doc, [], 5, 5), doc.shapes);
});

test('selection, transforms and transfers refuse hidden or locked geometry and invalid targets', () => {
    for (const flags of [{ visible: false, locked: false }, { visible: true, locked: true }]) {
        const doc = { ...document(), layers: [{ ...base, ...flags }, upper] };
        doc.shapes[1].layerId = upper.id;
        assert.deepEqual(selectAtlasRectangle(doc, { x:0, y:0 }, { x:30, y:20 }), ['room-two']);
        const ids = doc.shapes.map(s => s.id);
        const moved = translateAtlasSelection(doc, ids, 2, 1);
        assert.deepEqual(moved[0], doc.shapes[0]); assert.notDeepEqual(moved[1], doc.shapes[1]);
        assert.equal(resizeAtlasShape(doc, 'room-one', 'se', {x:15, y:15}), doc.shapes);
        assert.equal(transferAtlasSelection(doc, ids, base.id), doc.shapes);
        assert.deepEqual(transferAtlasSelection(doc, ids, upper.id)[0], doc.shapes[0]);
    }
    const doc = document();
    assert.equal(transferAtlasSelection(doc, ['room-one'], 'missing-layer'), doc.shapes);
});

test('marquee includes intersecting objects in either drag direction and blank clicks clear it', () => {
    const doc = document();
    assert.deepEqual(selectAtlasRectangle(doc, {x:1, y:2}, {x:6, y:6}), ['room-one']);
    assert.deepEqual(selectAtlasRectangle(doc, {x:6, y:6}, {x:1, y:2}), ['room-one']);
    assert.deepEqual(selectAtlasRectangle(doc, {x:7, y:5}, {x:7, y:5}), []);
});

test('room corner resize keeps its opposite anchor, positive integer dimensions and canvas bounds', () => {
    const doc = document();
    assert.deepEqual(resizeAtlasShape(doc, 'room-one', 'nw', {x:0, y:1})[0],
        { ...doc.shapes[0], x:0, y:1, width:7, height:6 });
    for (const handle of ['nw','ne','sw','se']) for (const point of [{x:-999,y:-999},{x:999,y:999},{x:4.6,y:2.7}]) {
        const shapes = resizeAtlasShape(doc, 'room-one', handle, point);
        read({ ...doc, shapes }); assert.ok(shapes[0].width >= 1 && shapes[0].height >= 1);
        assert.equal(shapes[0].id, 'room-one'); assert.deepEqual(shapes.slice(1), doc.shapes.slice(1));
    }
    assert.equal(resizeAtlasShape(doc, 'room-one', 'se', {x:NaN,y:4}), doc.shapes);
    assert.equal(resizeAtlasShape(doc, 'room-one', 'start', {x:4,y:4}), doc.shapes);
});

test('line endpoint resizing preserves width and other endpoint, rejecting collapse and door scaling', () => {
    const doc = document();
    assert.deepEqual(resizeAtlasShape(doc, 'line-one', 'end', {x:18,y:16})[2], { ...doc.shapes[2], x2:18, y2:16 });
    assert.equal(resizeAtlasShape(doc, 'line-one', 'end', {x:3,y:12}), doc.shapes);
    assert.equal(resizeAtlasShape(doc, 'door-one', 'se', {x:9,y:9}), doc.shapes);
    assert.equal(resizeAtlasShape(doc, 'line-one', 'sw', {x:9,y:9}), doc.shapes);
});

test('layer transfers preserve identity, geometry and source and survive campaign backup validation', () => {
    const values = new Map();
    const storage = { getItem:k=>values.get(k) ?? null, setItem:(k,v)=>values.set(k,v), get length(){return values.size;}, key:i=>[...values.keys()][i] };
    const repo = new CampaignRepository(storage, storage);
    repo.activate(repo.create('Layers', emptyCampaignWorld()));
    const doc = { ...document(), layers:[base, upper], source:'imported' };
    doc.shapes = transferAtlasSelection(doc, ['room-one','door-one'], upper.id);
    assert.deepEqual(doc.shapes[0], { ...document().shapes[0], layerId:upper.id });
    repo.writeResource('eclivarium_living_atlas_draft_v1:location-0', serializeLivingAtlasDocument(doc));
    const backup = readCampaignBackup(repo.exportRaw());
    assert.deepEqual(readLivingAtlasDocument(backup.resources['eclivarium_living_atlas_draft_v1:location-0']), doc);
    const bad = JSON.parse(repo.exportRaw());
    // Imported backups run the same parser, not just the live editor.
    bad.resources['eclivarium_living_atlas_draft_v1:location-0'] = JSON.stringify({ ...doc, layers:[upper] });
    assert.throws(() => readCampaignBackup(JSON.stringify(bad)));
});

test('UI exports only visible layer groups and removes all selection and resize controls', () => {
    const editor = readFileSync(new URL('../src/view/dnd/LivingAtlasEditor.tsx', import.meta.url), 'utf8');
    const handles = readFileSync(new URL('../src/view/dnd/AtlasResizeControls.tsx', import.meta.url), 'utf8');
    assert.match(editor, /layers.filter\(layer => layer.visible\).map/);
    assert.match(editor, /data-render-layer/);
    assert.match(editor, /clone.querySelectorAll\("\[data-ui-only='true'\]"\)/);
    assert.match(handles, /data-ui-only="true"/);
    assert.match(handles, /role="button" tabIndex=\{0\}/);
    assert.match(editor, /event.shiftKey \|\| multiSelect/);
    assert.match(editor, /event.stopPropagation\(\)/);
    assert.match(editor, /onKeyDownCapture/);
    const css = readFileSync(new URL('../src/view/dnd/AtlasWorkspace.css', import.meta.url), 'utf8');
    assert.match(css, /atlas-inspector > \* \{ flex-shrink: 0; \}/);
});
