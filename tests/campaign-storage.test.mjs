import assert from 'node:assert/strict';
import test from 'node:test';
import { CampaignRepository, CAMPAIGN_PREFIX } from '../src/model/dnd/campaignStorage.ts';
import { captureCampaignWorld, emptyCampaignWorld, readCampaignDocument, templateWorld } from '../src/model/dnd/campaignDocument.ts';
import { readSessionArchive } from '../src/model/dnd/sessionArchive.ts';
import { readCampaignBackup } from '../src/model/dnd/campaignBackup.ts';
import { readWorldEventState, readInitiativeState } from '../src/model/dnd/campaignResourceValidation.ts';

class MemoryStorage {
    values = new Map(); fail = false;
    get length() { return this.values.size; }
    key(index) { return [...this.values.keys()][index] ?? null; }
    getItem(key) { return this.values.get(key) ?? null; }
    setItem(key, value) { if (this.fail) throw new Error('QuotaExceededError'); this.values.set(key, value); }
}
function fixture() {
    const storage = new MemoryStorage(), tab = new MemoryStorage();
    const repo = new CampaignRepository(storage, tab);
    const world = templateWorld('Мой мир', [{ name: 'Аша', emoji: 'A', properties: [] }], [{ name: 'Гавань', emoji: 'G' }]);
    const id = repo.create('Мир А', world); repo.activate(id);
    return { storage, tab, repo, world, id };
}
test('campaign snapshot and scoped resources survive a new tab/repository', () => {
    const { storage, repo, world, id } = fixture();
    repo.writeResource('eclipse_dnd_sessions_v1', '{"sessions":[],"nextSessionNumber":1}');
    const reloaded = new CampaignRepository(storage, new MemoryStorage());
    assert.deepEqual(reloaded.getActive().world, world);
    assert.equal(reloaded.getActive().id, id);
    assert.ok(reloaded.readResource('eclipse_dnd_sessions_v1'));
});
test('two campaigns with reused local IDs never share resources', () => {
    const { repo, world, id } = fixture();
    repo.writeResource('eclipse_location_maps_v1', 'first map');
    repo.writeResource('eclivarium_living_atlas_draft_v1:location-0', 'first draft');
    const second = repo.create('Мир Б', world); repo.activate(second);
    assert.equal(repo.readResource('eclipse_location_maps_v1'), null);
    assert.equal(repo.readResource('eclivarium_living_atlas_draft_v1:location-0'), null);
    repo.activate(id); assert.equal(repo.readResource('eclipse_location_maps_v1'), 'first map');
});
test('quota failure leaves the durable document and successful revision unchanged', () => {
    const { storage, repo, id } = fixture();
    const before = storage.getItem(CAMPAIGN_PREFIX + id); storage.fail = true;
    assert.throws(() => repo.writeResource('eclipse_dnd_sessions_v1', 'new archive'), /записать/);
    assert.equal(repo.readResource('eclipse_dnd_sessions_v1'), null);
    assert.equal(repo.saveWorld(emptyCampaignWorld()), false);
    assert.equal(storage.getItem(CAMPAIGN_PREFIX + id), before);
    assert.equal(repo.getStatus().state, 'error');
});
test('a second tab cannot silently overwrite a changed campaign', () => {
    const { storage, tab, repo, id } = fixture();
    const second = new CampaignRepository(storage, tab); second.getActive();
    repo.writeResource('eclipse_dnd_sessions_v1', 'newer');
    assert.equal(second.saveWorld(emptyCampaignWorld()), false);
    assert.match(second.getStatus().error, /другой вкладке/);
    assert.equal(readCampaignDocument(storage.getItem(CAMPAIGN_PREFIX + id)).resources.eclipse_dnd_sessions_v1, 'newer');
});
test('browser repository refuses writes without ownership and after switching campaign', () => {
    const { repo, id, world } = fixture(); repo.requireWriterLock();
    assert.equal(repo.saveWorld(world), false);
    repo.grantWriterLock(id); assert.equal(repo.saveWorld(world), true);
    const second = repo.create('Second', world); repo.activate(second);
    assert.equal(repo.saveWorld(world), false);
});
test('legacy migration is idempotent and retains even damaged original keys', () => {
    const storage = new MemoryStorage(); storage.setItem('eclipse_dnd_sessions_v1', '{broken');
    storage.setItem('eclipse_dnd_ai_config_v2', 'not a campaign resource');
    const repo = new CampaignRepository(storage, new MemoryStorage());
    repo.migrateLegacy(); repo.migrateLegacy();
    assert.equal(repo.list().length, 1); repo.activate('legacy');
    assert.equal(repo.readResource('eclipse_dnd_sessions_v1'), '{broken');
    assert.equal(storage.getItem('eclipse_dnd_sessions_v1'), '{broken');
    assert.ok(!repo.exportRaw().includes('not a campaign resource'));
    repo.blockResource('eclipse_dnd_sessions_v1');
    assert.throws(() => repo.writeResource('eclipse_dnd_sessions_v1', '[]'), /нельзя перезаписать/);
});
test('a corrupted saved campaign is not replaced with defaults', () => {
    const { storage, tab, id } = fixture(); storage.setItem(CAMPAIGN_PREFIX + id, '{broken');
    const reload = new CampaignRepository(storage, tab);
    assert.throws(() => reload.prepare());
    assert.equal(storage.getItem(CAMPAIGN_PREFIX + id), '{broken');
    assert.equal(reload.list()[0].damaged, true);
});

test('legacy migration quota failure cannot block an existing active campaign', () => {
    const { storage, tab, id } = fixture();
    storage.setItem('eclipse_dnd_sessions_v1', '{"sessions":[],"nextSessionNumber":1}');
    storage.fail = true;
    const reload = new CampaignRepository(storage, tab);
    assert.doesNotThrow(() => reload.prepare());
    assert.equal(reload.getActive().id, id);
    assert.equal(storage.getItem(CAMPAIGN_PREFIX + 'legacy'), null);
    assert.equal(storage.getItem('eclipse_dnd_sessions_v1'), '{"sessions":[],"nextSessionNumber":1}');
});
test('explicit world projection drops UI state and credentials; malformed input fails closed', () => {
    const { repo, world } = fixture();
    assert.deepEqual(captureCampaignWorld({ ...world, openaiApiKey: 'not-for-storage', selectedNodes: ['entity-0'] }), world);
    const doc = JSON.parse(repo.exportRaw());
    assert.throws(() => readCampaignDocument(JSON.stringify({ ...doc, openaiApiKey: 'not-for-storage' })));
    assert.throws(() => readCampaignDocument(JSON.stringify({ ...doc, resources: { '__proto__': 'x', unknown: 'y' } })));
    doc.world.textState = [{ children: [{ text: 'safe', html: '<script>bad</script>' }] }];
    assert.throws(() => readCampaignDocument(JSON.stringify(doc)));
});
test('session archive rejects null rows, invalid counters and unbounded text', () => {
    assert.deepEqual(readSessionArchive('{"sessions":[],"nextSessionNumber":1}'), { sessions: [], nextSessionNumber: 1 });
    for (const bad of [{ sessions: [null], nextSessionNumber: 1 }, { sessions: [], nextSessionNumber: 1.5 }]) {
        assert.throws(() => readSessionArchive(JSON.stringify(bad)));
    }
});
test('backup round-trip is validated and restore creates a separate campaign', () => {
    const { repo, id } = fixture();
    repo.writeResource('eclipse_dnd_sessions_v1', '{"sessions":[],"nextSessionNumber":1}');
    const doc = readCampaignBackup(repo.exportRaw());
    const restored = repo.create(doc.name + ' copy', doc.world, doc.resources);
    assert.notEqual(restored, id);
    assert.equal(repo.list().length, 2);
    const malicious = JSON.parse(repo.exportRaw());
    malicious.resources.eclipse_dnd_sessions_v1 = '{"sessions":[null],"nextSessionNumber":1}';
    assert.throws(() => readCampaignBackup(JSON.stringify(malicious)));
});
test('malformed restored combat and world events fail closed before UI rendering', () => {
    assert.throws(() => readInitiativeState('{"entries":[null],"activeIndex":0,"round":1,"active":true}'));
    assert.throws(() => readWorldEventState('{"events":[null],"insertedIds":[],"lastDmAcknowledgedAt":0,"lastAutoTickAt":0,"autoTickInterval":"off"}'));
});

test('world journal accepts current timestamps through backup and repository reload', () => {
    const { repo, storage, tab } = fixture();
    const now = Date.parse('2026-09-05T12:00:00Z');
    const journal = { events: [{ id: 'event-1', tickId: 'tick-1', entityId: 'entity-Аша', entityName: 'Аша', action: 'Отправилась в гавань', createdAt: now }], insertedIds: ['event-1'], lastDmAcknowledgedAt: now, lastAutoTickAt: now, autoTickInterval: 'off' };
    const raw = JSON.stringify(journal);
    assert.deepEqual(readWorldEventState(raw), journal);
    repo.writeResource('eclipse_dnd_world_events_v1', raw);
    const reloaded = new CampaignRepository(storage, tab);
    assert.deepEqual(readWorldEventState(reloaded.readResource('eclipse_dnd_world_events_v1')), journal);
    assert.equal(readCampaignBackup(reloaded.exportRaw()).resources.eclipse_dnd_world_events_v1, raw);
    for (const invalid of [-1, 1.5, 9e15]) {
        assert.throws(() => readWorldEventState(JSON.stringify({ ...journal, lastAutoTickAt: invalid })));
    }
});
test('document schema rejects duplicate nodes, dangling edges and excessive text', () => {
    const { repo } = fixture();
    const doc = JSON.parse(repo.exportRaw());
    doc.world.entityNodes.push(doc.world.entityNodes[0]);
    assert.throws(() => readCampaignDocument(JSON.stringify(doc)));
    doc.world.entityNodes.pop();
    doc.world.actionEdges = [{ id: 'edge-1', source: 'missing', target: 'entity-0', data: { name: '', sourceLocation: '', targetLocation: '', passage: '' } }];
    assert.throws(() => readCampaignDocument(JSON.stringify(doc)));
    doc.world.actionEdges = []; doc.world.textState = [{ children: [{ text: 'x'.repeat(1_000_001) }] }];
    assert.throws(() => readCampaignDocument(JSON.stringify(doc)));
});
