// Local-only browser regression. Start preview + an isolated Edge/Chromium with
// --enable-automation --headless --user-data-dir=<...eclivarium-reliability-...>
// --remote-debugging-port=9230. This script refuses ordinary user profiles.
import assert from 'node:assert/strict';

const port = Number(process.argv[2] ?? 9230);
const baseUrl = process.argv[3] ?? 'http://127.0.0.1:4173/';
assert.match(baseUrl, /^http:\/\/127\.0\.0\.1:\d+\/$/, 'QA only accepts a loopback preview URL');
assert.ok(Number.isInteger(port) && port >= 1024 && port <= 65535);
const tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const page = tabs.find(t => t.type === 'page' && t.url.startsWith(baseUrl));
assert.ok(page, 'Open the isolated QA tab on the local preview at port 4173');
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
let sequence = 0;
const pending = new Map();
socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (!message.id) return;
    const call = pending.get(message.id); if (!call) return;
    clearTimeout(call.timer); pending.delete(message.id);
    if (message.error) call.reject(new Error(JSON.stringify(message.error))); else call.resolve(message.result);
});
function rpc(method, params = {}, sessionId) {
    return new Promise((resolve, reject) => {
        const id = ++sequence;
        const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 12000);
        pending.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
}
const pause = (ms = 150) => new Promise(resolve => setTimeout(resolve, ms));
async function evaluate(expression) {
    const result = await rpc('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
    return result.result.value;
}
async function until(expression, label) {
    for (let i = 0; i < 60; i++) { if (await evaluate(expression)) return; await pause(150); }
    throw new Error(`Timed out: ${label}`);
}
async function click(label) {
    await evaluate(`(() => { const button = [...document.querySelectorAll('button')].find(e => e.textContent.trim() === ${JSON.stringify(label)} || e.getAttribute('aria-label') === ${JSON.stringify(label)}); if (!button || button.disabled) throw new Error('Unavailable button: ' + ${JSON.stringify(label)}); button.click(); })()`);
    await pause(250);
}
const activeExpression = `JSON.parse(localStorage.getItem('eclivarium_campaign_v1:' + sessionStorage.getItem('eclivarium_active_campaign_v1')))`;
const active = () => evaluate(activeExpression);
const story = () => evaluate(`document.querySelector('[contenteditable=true]')?.innerText.trim()`);
const worldIdentity = () => evaluate(`JSON.stringify({ text: document.querySelector('[contenteditable=true]')?.innerText, locations: [...document.querySelectorAll('.react-flow__node')].filter(n => (n.getAttribute('data-id') || '').startsWith('location-')).map(n => n.getAttribute('data-id')).sort() })`);
async function workspaceReady() {
    await until(`!!document.querySelector('[contenteditable=true]') && !!document.querySelector('.campaign-bar')`, 'workspace');
    await until(`document.querySelector('.campaign-bar [role=status]')?.innerText === 'Сохранено в этом браузере'`, 'durable save');
}
async function reload() { await rpc('Page.reload'); await pause(400); await workspaceReady(); }
async function template(name) {
    await until(`!![...document.querySelectorAll('button')].find(e => e.textContent.includes(${JSON.stringify(name)}))`, 'launcher');
    await evaluate(`[...document.querySelectorAll('button')].find(e => e.textContent.includes(${JSON.stringify(name)})).click()`);
    await pause(500); await workspaceReady();
}
async function key(key, code, modifiers = 0) {
    const windowsVirtualKeyCode = key.toUpperCase().charCodeAt(0);
    await rpc('Input.dispatchKeyEvent', { type: 'rawKeyDown', key, code, modifiers, windowsVirtualKeyCode });
    await rpc('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode }); await pause(350);
}
async function drawRoom() {
    await evaluate(`window.qaPointers = []; ['pointerdown','pointermove','pointerup','pointercancel','lostpointercapture'].forEach(type => document.querySelector('svg[aria-label^="Редактор карты"]').addEventListener(type, e => window.qaPointers.push({ type, x:e.clientX, y:e.clientY, button:e.button, buttons:e.buttons })));`);
    await evaluate(`(() => { const panel = document.querySelector('.map-workflow-panel'); const svg = document.querySelector('svg[aria-label^="Редактор карты"]'); panel.scrollTop += svg.getBoundingClientRect().top - panel.getBoundingClientRect().top - 120; })()`);
    await pause();
    const r = await evaluate(`document.querySelector('svg[aria-label^="Редактор карты"]').getBoundingClientRect().toJSON()`);
    await rpc('Input.dispatchMouseEvent', { type: 'mouseMoved', x: r.x + 80, y: r.y + 80, button: 'none', buttons: 0, pointerType: 'mouse' });
    await pause(250);
    assert.ok(await evaluate(`!!document.elementFromPoint(${r.x + 80}, ${r.y + 80})?.closest('svg[aria-label^="Редактор карты"]')`), 'Canvas must be reachable');
    await rpc('Input.dispatchMouseEvent', { type: 'mousePressed', x: r.x + 80, y: r.y + 80, button: 'left', buttons: 1, clickCount: 1, pointerType: 'mouse' });
    await pause();
    await rpc('Input.dispatchMouseEvent', { type: 'mouseMoved', x: r.x + 220, y: r.y + 180, button: 'none', buttons: 1, pointerType: 'mouse' });
    await pause();
    await rpc('Input.dispatchMouseEvent', { type: 'mouseReleased', x: r.x + 220, y: r.y + 180, button: 'left', buttons: 0, clickCount: 1, pointerType: 'mouse' });
    await pause(400);
    if ((await draft()).shapes.length === 0) console.log('POINTER DIAGNOSTIC', await evaluate(`JSON.stringify(window.qaPointers)`));
}
const draft = async () => JSON.parse((await active()).resources['eclivarium_living_atlas_draft_v1:location-0']);
let checks = 0;
const pass = label => { console.log(`PASS ${++checks}: ${label}`); };

try {
    const command = await rpc('Browser.getBrowserCommandLine');
    assert.ok(command.arguments.some(arg => arg.startsWith('--user-data-dir=') && arg.includes('eclivarium-reliability-')), 'Refusing non-QA browser profile');
    assert.ok(command.arguments.some(arg => arg.startsWith('--headless')), 'QA requires a headless isolated browser');
    await rpc('Browser.setDownloadBehavior', { behavior: 'deny' });
    await rpc('Runtime.enable'); await rpc('Page.enable');
    await rpc('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    assert.equal(await evaluate(`Object.keys(localStorage).filter(k => k.startsWith('eclivarium_campaign_v1:')).length`), 0, 'Use a fresh disposable profile');
    await click('Ollama (локально)');
    await template('Синдер-Холлоу —');
    const first = await active(); assert.equal(first.world.locationNodes.length, 3);
    const marker = 'QA: мир должен пережить перезагрузку и отказ записи.';
    await evaluate(`(() => { const editor = document.querySelector('[contenteditable=true]'); editor.focus(); window.getSelection().selectAllChildren(editor); })()`);
    await pause(250); await rpc('Input.insertText', { text: marker });
    await until(`${activeExpression}.world.textState[0].children.map(n => n.text).join('') === ${JSON.stringify(marker)}`, 'saved edited text');
    await reload(); assert.equal(await story(), marker); assert.equal((await active()).world.locationNodes.length, 3);
    pass('text and seeded world survive reload');
    const other = await rpc('Target.createTarget', { url: baseUrl + '#/free-form' });
    try {
        const attached = await rpc('Target.attachToTarget', { targetId: other.targetId, flatten: true });
        let blocked = false;
        for (let i = 0; i < 50; i++) {
            const result = await rpc('Runtime.evaluate', { expression: `document.body.innerText.includes('Не удалось открыть кампанию')`, returnByValue: true }, attached.sessionId);
            if (result.result.value) { blocked = true; break; } await pause(150);
        }
        assert.ok(blocked, 'A second editing tab must be rejected by the writer lock');
    } finally { await rpc('Target.closeTarget', { targetId: other.targetId }); }
    pass('browser writer lock blocks a second editor for the same campaign');

    await click('Переключить панель сессий');
    await evaluate(`document.querySelector('.dnd-overlay-panel input[type=checkbox]').click(); window.qaSetItem = Storage.prototype.setItem; Storage.prototype.setItem = function(k,v) { if(k.startsWith('eclivarium_campaign_v1:') && JSON.parse(v).resources.eclipse_dnd_sessions_v1) throw new DOMException('QA quota', 'QuotaExceededError'); return window.qaSetItem.call(this,k,v); };`);
    await click('Завершить и начать новую');
    assert.equal(await story(), marker); assert.equal((await active()).resources.eclipse_dnd_sessions_v1, undefined);
    assert.ok(await evaluate(`!!document.querySelector('.dnd-overlay-panel [role=alert]')`));
    pass('failed archive preserves text and does not claim a durable archive');

    await evaluate(`window.qaCreateURL = URL.createObjectURL; URL.createObjectURL = function(blob) { window.qaBackupBlob = blob; return window.qaCreateURL(blob); };`);
    await click('Копия для мастера');
    const backup = await evaluate(`window.qaBackupBlob.text()`);
    assert.equal(JSON.parse(backup).world.textState[0].children[0].text, marker);
    await evaluate(`Storage.prototype.setItem = window.qaSetItem; URL.createObjectURL = window.qaCreateURL;`);
    await click('Завершить и начать новую');
    assert.equal(await story(), '');
    assert.equal(JSON.parse((await active()).resources.eclipse_dnd_sessions_v1).sessions[0].text, marker);
    pass('backup remains available on quota failure and archival can be retried');
    await click('Закрыть панель сессий'); await click('Мир и локации'); await click('Открыть создание и импорт карты мира'); await click('Нарисовать карту');
    await drawRoom(); assert.equal((await draft()).shapes.length, 1);
    const beforeUndo = await worldIdentity();
    await evaluate(`document.querySelector('svg[aria-label^="Редактор карты"]').focus()`);
    await key('z', 'KeyZ', 2); assert.equal((await draft()).shapes.length, 0); assert.equal(await worldIdentity(), beforeUndo);
    await key('z', 'KeyZ', 10); assert.equal((await draft()).shapes.length, 1); assert.equal(await worldIdentity(), beforeUndo);
    pass('atlas Ctrl+Z/redo change only the map, not campaign history');
    await click('Использовать в локации'); await click('Сохранить карту');
    assert.equal(JSON.parse((await active()).resources.eclipse_location_maps_v1).maps.length, 1);
    await evaluate(`(() => { const select = [...document.querySelectorAll('.map-workflow-panel select')].find(s => [...s.options].some(o => o.value === 'location-1')); select.value = 'location-1'; select.dispatchEvent(new Event('change', {bubbles:true})); })()`);
    await pause(); await click('Нарисовать карту');
    assert.equal(JSON.parse((await active()).resources['eclivarium_living_atlas_draft_v1:location-1']).shapes.length, 0);
    assert.equal((await draft()).shapes.length, 1);
    await click('Закрыть редактор карты');
    pass('different locations keep separate atlas drafts');
    await click('Закрыть карты кампании');
    await click('Открыть Reference Board кампании'); await click('Редактировать');
    await evaluate(`(() => { const input = document.querySelector('.reference-form-grid input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'QA world A references'); input.dispatchEvent(new Event('input', {bubbles:true})); })()`);
    await pause(); await click('Сохранить project bible');
    assert.equal(JSON.parse((await active()).resources.eclipse_dnd_reference_board_v1).bible.title, 'QA world A references');
    await click('Закрыть Reference Board');
    await click('Кампании'); await pause(600);
    await template('Баровия —');
    assert.notEqual((await active()).id, first.id);
    assert.equal((await active()).resources.eclipse_dnd_sessions_v1, undefined);
    await click('Открыть Reference Board кампании');
    assert.ok(!await evaluate(`document.querySelector('.reference-board-panel').innerText.includes('QA world A references')`));
    await click('Закрыть Reference Board');
    pass('Reference Board data does not leak to another campaign');
    await click('Переключить панель сессий');
    assert.ok(await evaluate(`document.querySelector('.dnd-overlay-panel').innerText.includes('Пока нет архивированных сессий')`));
    await click('Закрыть панель сессий'); await click('Мир и локации'); await click('Открыть создание и импорт карты мира');
    assert.equal(await evaluate(`document.querySelectorAll('.map-library-card').length`), 0);
    await click('Нарисовать карту'); assert.equal((await draft()).shapes.length, 0);
    pass('new campaign has no previous archive, maps or atlas draft');
    await click('Закрыть редактор карты'); await click('Закрыть карты кампании'); await click('Кампании'); await pause(600);
    await click(`Открыть кампанию ${first.name}`); await pause(600); await workspaceReady();
    assert.equal((await active()).id, first.id);
    assert.equal(JSON.parse((await active()).resources.eclipse_location_maps_v1).maps.length, 1);
    assert.equal((await draft()).shapes.length, 1);
    assert.equal(JSON.parse((await active()).resources.eclipse_dnd_reference_board_v1).bible.title, 'QA world A references');
    pass('opening the saved first campaign restores its own resources');
    await click('Кампании'); await pause(600);
    await evaluate(`(() => { const input = document.querySelector('input[aria-label="Резервная копия кампании"]'); const transfer = new DataTransfer(); transfer.items.add(new File([${JSON.stringify(backup)}], 'qa.campaign.json', {type:'application/json'})); input.files = transfer.files; input.dispatchEvent(new Event('change', {bubbles:true})); })()`);
    await until(`document.querySelectorAll('.campaign-library__row').length === 3`, 'restored backup');
    pass('backup UI restores as a third independent campaign');
    await click(`Открыть кампанию ${first.name}`); await pause(600); await workspaceReady();
    await rpc('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await pause(700);
    assert.equal(await evaluate(`document.documentElement.scrollWidth`), 390);
    assert.ok(await evaluate(`!!document.querySelector('.campaign-bar button')`));
    pass('mobile campaign controls render without horizontal overflow');
    await evaluate(`localStorage.setItem('eclivarium_campaign_v1:' + sessionStorage.getItem('eclivarium_active_campaign_v1'), '{broken');`);
    await rpc('Page.reload');
    await until(`document.body.innerText.includes('Не удалось открыть кампанию')`, 'corruption recovery screen');
    assert.equal(await evaluate(`localStorage.getItem('eclivarium_campaign_v1:' + sessionStorage.getItem('eclivarium_active_campaign_v1'))`), '{broken');
    pass('corrupt campaign fails closed without overwriting its raw data');
    console.log(`Campaign reliability browser checks passed: ${checks}`);
} finally {
    for (const call of pending.values()) clearTimeout(call.timer);
    socket.close();
}
