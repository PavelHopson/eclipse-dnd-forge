// Local-only browser regression. Start preview + an isolated Edge/Chromium with
// --enable-automation --headless --user-data-dir=<...eclivarium-reliability-...>
// --remote-debugging-port=9230. This script refuses ordinary user profiles.
import assert from 'node:assert/strict';

const port = Number(process.argv[2] ?? 9231);
const baseUrl = process.argv[3] ?? 'http://127.0.0.1:5197/';
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

async function gridMouse(x,y,type='mousePressed') {
    const r=await evaluate("document.querySelector('.atlas-canvas').getBoundingClientRect().toJSON()");
    const doc=await draft();
    await rpc('Input.dispatchMouseEvent',{type,x:r.x+x*r.width/doc.widthCells,y:r.y+y*r.height/doc.heightCells,button:'left',buttons:type==='mouseReleased'?0:1,clickCount:1,pointerType:'mouse'});
}
async function dragGrid(x1,y1,x2,y2) {
    await gridMouse(x1,y1); await pause(); await gridMouse(x2,y2,'mouseMoved'); await pause(); await gridMouse(x2,y2,'mouseReleased'); await pause(300);
}
async function setField(selector,value) {
    await evaluate(`(() => {const e=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(e instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event(e instanceof HTMLSelectElement?'change':'input',{bubbles:true}));})()`);
    await pause();
}
async function visibleButton(label) {
    const rect=await evaluate(`(() => {const e=[...document.querySelectorAll('button')].find(e=>e.textContent.trim()===${JSON.stringify(label)}||e.getAttribute('aria-label')===${JSON.stringify(label)}); if(!e||e.disabled)throw new Error('Button unavailable');e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();if(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('button')!==e)throw new Error('Button covered');return r.toJSON();})()`);
    await rpc('Input.dispatchMouseEvent',{type:'mousePressed',x:rect.x+rect.width/2,y:rect.y+rect.height/2,button:'left',buttons:1,clickCount:1});
    await rpc('Input.dispatchMouseEvent',{type:'mouseReleased',x:rect.x+rect.width/2,y:rect.y+rect.height/2,button:'left',buttons:0,clickCount:1});await pause(300);
}
const mapList=async()=>JSON.parse((await active()).resources.eclipse_location_maps_v1).maps;
async function uploadProject(raw) {
    await evaluate(`(() => {const e=document.querySelector('.atlas-project-actions input[type=file]');const dt=new DataTransfer();dt.items.add(new File([${JSON.stringify(raw)}],'qa.eclatlas.json',{type:'application/json'}));e.files=dt.files;e.dispatchEvent(new Event('change',{bubbles:true}));})()`);await pause(400);
}
try {
    const command=await rpc('Browser.getBrowserCommandLine');
    assert.ok(command.arguments.some(a=>a.includes('eclivarium-reliability-mapworkspace-')));
    assert.ok(command.arguments.some(a=>a.startsWith('--headless')));
    await rpc('Browser.setDownloadBehavior',{behavior:'deny'});
    await rpc('Runtime.enable');await rpc('Page.enable');
    await rpc('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
    assert.equal(await evaluate("Object.keys(localStorage).filter(k=>k.startsWith('eclivarium_campaign_v1:')).length"),0,'Fresh QA profile required');
    await click('Ollama (локально)');await template('Синдер-Холлоу —');
    await visibleButton('Мир и локации');await visibleButton('Открыть создание и импорт карты мира');await visibleButton('Нарисовать карту');await pause(500);
    assert.ok(await evaluate("document.querySelector('#root').inert"));
    assert.ok(await evaluate("document.querySelector('.atlas-canvas-scroll').getBoundingClientRect().height > 650"));
    await dragGrid(2,2,9,9);await dragGrid(7,6,13,12);
    await visibleButton('Коридор');await dragGrid(9,9,17,9);
    await visibleButton('Стена');await dragGrid(5,14,15,14);
    await setField('.atlas-inspector input[type=range]','2');
    assert.equal(await evaluate("document.querySelector('[data-wall-id]').getAttribute('stroke-width')"),'14');
    await visibleButton('Дверь');await gridMouse(10,14);await gridMouse(10,14,'mouseReleased');await pause();
    assert.equal((await draft()).shapes.length,5);
    pass('desktop viewport canvas and native pointer tools create editable geometry');
    const pixels=await evaluate(`(async()=>{const svg=document.querySelector('.atlas-canvas').cloneNode(true);svg.querySelectorAll('[data-ui-only=true]').forEach(e=>e.remove());svg.setAttribute('width','960');svg.setAttribute('height','640');svg.setAttribute('xmlns','http://www.w3.org/2000/svg');const url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)],{type:'image/svg+xml'}));try{const image=new Image();image.src=url;await image.decode();const c=document.createElement('canvas');c.width=960;c.height=640;const ctx=c.getContext('2d');ctx.drawImage(image,0,0);return [[7,7],[10,8],[7,14],[10,14]].map(([x,y])=>[...ctx.getImageData(x*32,y*32,1,1).data]);}finally{URL.revokeObjectURL(url)}})()`);
    assert.deepEqual(pixels[0].slice(0,3),[248,243,229]);assert.deepEqual(pixels[1].slice(0,3),[248,243,229]);
    assert.ok(pixels[2][0]<60);assert.ok(pixels[3][0]>200);
    pass('rendered pixels show merged interiors, variable wall thickness and a door cutout');
    const identity=await worldIdentity();await evaluate("document.querySelector('.atlas-canvas').focus()");
    await key('z','KeyZ',2);assert.equal((await draft()).shapes.length,4);
    await key('z','KeyZ',10);assert.equal((await draft()).shapes.length,5);assert.equal(await worldIdentity(),identity);
    await visibleButton('Использовать в локации');await visibleButton('Сохранить карту');
    let first=(await mapList())[0];assert.equal(first.atlasDocument.shapes.length,5);
    await visibleButton('Метка в центре');
    const originalPins=(await active()).resources.eclipse_map_story_pins_v1;
    await visibleButton('Закрыть карты кампании');await reload();await visibleButton('Мир и локации');await visibleButton('Открыть создание и импорт карты мира');
    await visibleButton('Редактировать карту '+first.name);
    const editKey='eclivarium_living_atlas_draft_v1:'+first.id;
    assert.equal(JSON.parse((await active()).resources[editKey]).shapes.length,5);
    await dragGrid(18,2,24,7);
    await visibleButton('Сохранить изменения');await setField('#map-name','QA — Новый чертёж');await visibleButton('Сохранить изменения карты');
    const updated=(await mapList())[0];assert.equal((await mapList()).length,1);assert.equal(updated.id,first.id);assert.equal(updated.atlasDocument.shapes.length,6);
    assert.deepEqual(updated.provenance,first.provenance);
    assert.equal((await active()).resources.eclipse_map_story_pins_v1,originalPins);
    await visibleButton('Редактировать карту '+updated.name);
    assert.equal(await evaluate("document.querySelector('#atlas-name').value"),'QA — Новый чертёж');
    await visibleButton('Закрыть редактор карты');
    pass('reload and edit preserve source, map ID and rights without duplicate maps');
    await visibleButton('Нарисовать карту');assert.equal((await draft()).shapes.length,0);
    await dragGrid(3,3,8,8);await visibleButton('Использовать в локации');await visibleButton('Сохранить карту');
    assert.equal((await mapList()).length,2);assert.equal((await mapList())[0].atlasDocument.shapes.length,6);
    pass('a second map has an independent document and does not replace the first');
    first=(await mapList())[0];
    await visibleButton('Редактировать карту '+first.name);
    await dragGrid(20,12,25,17);
    const oldMaps=(await active()).resources.eclipse_location_maps_v1;
    await evaluate(`window.qaSet=Storage.prototype.setItem; Storage.prototype.setItem=function(k,v){if(k.startsWith('eclivarium_campaign_v1:') && JSON.parse(v).resources.eclipse_location_maps_v1!==${JSON.stringify(oldMaps)})throw new DOMException('QA quota','QuotaExceededError');return window.qaSet.call(this,k,v)}`);
    await visibleButton('Сохранить изменения');await visibleButton('Сохранить изменения карты');
    assert.equal((await active()).resources.eclipse_location_maps_v1,oldMaps);
    assert.ok(await evaluate("document.querySelector('.location-map-workshop [role=alert]').innerText.includes('Не удалось')"));
    await evaluate("Storage.prototype.setItem=window.qaSet");await visibleButton('Сохранить изменения карты');
    assert.equal((await mapList())[0].atlasDocument.shapes.length,7);assert.equal((await mapList()).length,2);
    pass('quota failure preserves old preview/source; retry updates the same map');
    await visibleButton('Нарисовать карту');const before=await draft();await uploadProject('{broken');
    assert.deepEqual(await draft(),before);
    const imported={...before,id:'atlas-import-fixture',name:'Imported test',shapes:[{id:'room-import',kind:'room',x:1,y:1,width:5,height:5}]};
    await uploadProject(JSON.stringify(imported));assert.equal((await draft()).source,'imported');
    await visibleButton('Использовать в локации');
    assert.equal(await evaluate("document.querySelector('#map-rights-basis').value"),'unverified');
    pass('malformed project leaves the draft intact; a valid import cannot auto-approve source rights');
    await visibleButton('Закрыть карты кампании');
    await rpc('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await pause(350);
    await visibleButton('Мир и инструменты');await visibleButton('Открыть создание и импорт карты мира');await visibleButton('Нарисовать карту');await pause(400);
    assert.ok(await evaluate("document.querySelector('.atlas-canvas-scroll').getBoundingClientRect().height >= 350"));
    assert.equal(await evaluate("document.documentElement.scrollWidth"),390);
    await visibleButton('Параметры');await visibleButton('Скрыть параметры');await visibleButton('Показать карту целиком');
    await visibleButton('Закрыть редактор карты');await visibleButton('Закрыть карты кампании');
    assert.equal(await evaluate("document.querySelector('#root').inert"),false);
    pass('mobile canvas stays usable; toolbar, fit, inspector and close have real hit targets');
    await visibleButton('Открыть создание и импорт карты мира');await visibleButton('Нарисовать карту');
    await evaluate("document.querySelector('#atlas-name').focus()");
    await rpc('Input.dispatchKeyEvent',{type:'rawKeyDown',key:'Tab',code:'Tab',modifiers:8,windowsVirtualKeyCode:9});
    await rpc('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
    assert.ok(await evaluate("!!document.activeElement.closest('.map-workspace-root')"));
    await evaluate("document.querySelector('.atlas-canvas').focus()");
    await rpc('Input.dispatchKeyEvent',{type:'rawKeyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
    await pause(250);assert.equal(await evaluate("!!document.querySelector('.living-atlas-editor')"),false);
    await visibleButton('Закрыть карты кампании');
    assert.equal(await evaluate("document.querySelector('#root').inert"),false);
    pass('keyboard focus stays inside the dialog and canvas Escape closes only the editor');
    console.log('Map workspace browser checks passed: '+checks);
} finally {for(const call of pending.values())clearTimeout(call.timer);socket.close();}
