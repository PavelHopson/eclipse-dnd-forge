// Local-only browser regression. Start preview + an isolated Edge/Chromium with
// --enable-automation --headless --user-data-dir=<...eclivarium-reliability-mapworkspace-editing-...>
// --remote-debugging-port=9231. This script refuses ordinary user profiles.
import assert from 'node:assert/strict';

const port = Number(process.argv[2] ?? 9231);
const baseUrl = process.argv[3] ?? 'http://127.0.0.1:5197/';
assert.match(baseUrl, /^http:\/\/127\.0\.0\.1:\d+\/$/, 'QA only accepts a loopback preview URL');
assert.ok(Number.isInteger(port) && port >= 1024 && port <= 65535);
const tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const page = tabs.find(t => t.type === 'page' && t.url.startsWith(baseUrl));
assert.ok(page, 'Open the isolated QA tab on the requested loopback preview');
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
async function pressCanvas(key, code, keyCode, modifiers=0) {
    await evaluate("document.querySelector('.atlas-canvas').focus()");
    await rpc('Input.dispatchKeyEvent',{type:'rawKeyDown',key,code,windowsVirtualKeyCode:keyCode,modifiers});
    await rpc('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:keyCode}); await pause(250);
}
async function pixel(x,y) {
    return evaluate(`(async()=>{const svg=document.querySelector('.atlas-canvas').cloneNode(true);svg.querySelectorAll('[data-ui-only=true]').forEach(e=>e.remove());svg.setAttribute('width','960');svg.setAttribute('height','640');svg.setAttribute('xmlns','http://www.w3.org/2000/svg');const url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)],{type:'image/svg+xml'}));try{const image=new Image();image.src=url;await image.decode();const c=document.createElement('canvas');c.width=960;c.height=640;const ctx=c.getContext('2d');ctx.drawImage(image,0,0);return [...ctx.getImageData(${x*32},${y*32},1,1).data];}finally{URL.revokeObjectURL(url)}})()`);
}
async function editNumber(label,value) {
    const selector=await evaluate(`(() => {const e=[...document.querySelectorAll('.atlas-size-fields label')].find(e=>e.textContent.trim()===${JSON.stringify(label)}).querySelector('input');e.id='qa-number';e.focus();return '#qa-number';})()`);
    await setField(selector,String(value)); await evaluate("document.querySelector('#qa-number')?.blur()");await pause(250);
}
try {
    const command=await rpc('Browser.getBrowserCommandLine');
    assert.ok(command.arguments.some(a=>a.includes('eclivarium-reliability-mapworkspace-editing-')));
    assert.ok(command.arguments.some(a=>a.startsWith('--headless')));
    await rpc('Browser.setDownloadBehavior',{behavior:'deny'});
    await rpc('Runtime.enable');await rpc('Page.enable');
    await rpc('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
    assert.equal(await evaluate("Object.keys(localStorage).filter(k=>k.startsWith('eclivarium_campaign_v1:')).length"),0,'Fresh QA profile required');
    await click('Ollama (локально)');await template('Синдер-Холлоу —');
    await visibleButton('Мир и локации');await visibleButton('Открыть создание и импорт карты мира');await visibleButton('Нарисовать карту');await pause(500);
    await dragGrid(2,2,7,7);await dragGrid(10,3,14,8);
    await visibleButton('Стена');await dragGrid(4,13,13,13);
    const original=await draft(), world=await worldIdentity();
    await visibleButton('Выбор');await gridMouse(4,4);await gridMouse(4,4,'mouseReleased');await pause();
    assert.equal(await evaluate("document.querySelectorAll('[data-resize-handle]').length"),4);
    await dragGrid(7,7,9,8);
    assert.deepEqual((await draft()).shapes[0],{...original.shapes[0],width:7,height:6});
    await visibleButton('Отменить изменение');assert.deepEqual((await draft()).shapes,original.shapes);
    await visibleButton('Вернуть изменение');
    await gridMouse(4,4);await gridMouse(4,4,'mouseReleased');await pause();
    await editNumber('Ширина',8);assert.equal((await draft()).shapes[0].width,8);
    await editNumber('Высота',-2);assert.equal((await draft()).shapes[0].height,6);
    await evaluate("document.querySelector('[data-resize-handle=se]').focus()");
    await rpc('Input.dispatchKeyEvent',{type:'rawKeyDown',key:'ArrowDown',code:'ArrowDown',windowsVirtualKeyCode:40});
    await rpc('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowDown',code:'ArrowDown',windowsVirtualKeyCode:40});await pause(250);
    assert.equal((await draft()).shapes[0].height,7);
    assert.equal(await worldIdentity(),world);
    pass('room resize works by native handle, numeric input and keyboard; undo stays local');

    const beforeBusy=(await draft()).shapes;
    await evaluate("window.qaDecode=Image.prototype.decode;Image.prototype.decode=function(){return new Promise(resolve=>{window.qaReleaseDecode=()=>resolve(window.qaDecode.call(this));});}");
    await visibleButton('Скачать PNG');await until("!!window.qaReleaseDecode","delayed export");
    await evaluate("document.querySelector('[data-resize-handle=se]').focus()");
    await rpc('Input.dispatchKeyEvent',{type:'rawKeyDown',key:'ArrowDown',code:'ArrowDown',windowsVirtualKeyCode:40});
    await rpc('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowDown',code:'ArrowDown',windowsVirtualKeyCode:40});
    await evaluate("document.querySelector('.atlas-close').click()");
    assert.ok(await evaluate("!!document.querySelector('.living-atlas-editor')"));
    assert.deepEqual((await draft()).shapes,beforeBusy);
    await evaluate("Image.prototype.decode=window.qaDecode;window.qaReleaseDecode()");
    await until("document.querySelector('.living-atlas-editor')?.getAttribute('aria-busy')==='false'","finished export");
    pass('busy export blocks descendant keyboard edits and close without losing geometry');

    await gridMouse(8,13);await gridMouse(8,13,'mouseReleased');await pause();
    assert.equal(await evaluate("document.querySelectorAll('[data-resize-handle]').length"),2);
    await dragGrid(13,13,16,15);
    assert.deepEqual((await draft()).shapes[2],{...original.shapes[2],x2:16,y2:15});
    await editNumber('Начало X',5);assert.equal((await draft()).shapes[2].x1,5);
    await editNumber('Конец Y',13);
    await editNumber('Конец X',5);
    assert.equal((await draft()).shapes[2].x2,16);
    assert.equal(await evaluate("[...document.querySelectorAll('.atlas-size-fields label')].find(e=>e.textContent.trim()==='Конец X').querySelector('input').value"),'16');
    pass('line endpoints resize by native handle and coordinate field');

    await gridMouse(4,4);await gridMouse(4,4,'mouseReleased');await pause();
    await visibleButton('Несколько');await gridMouse(12,5);await gridMouse(12,5,'mouseReleased');await pause();
    assert.ok(await evaluate("document.querySelector('.atlas-selection-bar').textContent.includes('Выбрано: 2')"));
    await visibleButton('Несколько');
    const beforeGroup=(await draft()).shapes;
    await dragGrid(4,4,2,3);
    let grouped=(await draft()).shapes;
    assert.equal(grouped[0].x,0);assert.equal(grouped[1].x,8);assert.equal(grouped[1].x-grouped[0].x,beforeGroup[1].x-beforeGroup[0].x);
    await pressCanvas('ArrowLeft','ArrowLeft',37);assert.deepEqual((await draft()).shapes,grouped);
    await visibleButton('Отменить изменение');assert.deepEqual((await draft()).shapes,beforeGroup);
    await dragGrid(1,1,15,10);
    assert.ok(await evaluate("document.querySelector('.atlas-selection-bar').textContent.includes('Выбрано: 2')"));
    await pressCanvas('Delete','Delete',46);assert.equal((await draft()).shapes.length,1);
    await visibleButton('Отменить изменение');assert.deepEqual((await draft()).shapes,beforeGroup);
    pass('multi-click and marquee groups move as a unit at boundaries; delete is one undo step');

    await visibleButton('Добавить слой');
    const layer=(await draft()).layers[1];assert.ok(layer);
    await evaluate("document.querySelector('.atlas-layers input').focus()");
    await setField('.atlas-layers input','Детали');await evaluate("document.querySelector('.atlas-layers input').blur()");await pause();
    await visibleButton('Комната');await dragGrid(18,3,24,8);
    await visibleButton('Стена');await dragGrid(1,5,16,5);
    const layered=await draft();assert.equal(layered.shapes.at(-1).layerId,layer.id);
    assert.ok((await pixel(4,5))[0]<60,'upper wall paints above base room');
    await visibleButton('Ниже');assert.ok((await pixel(4,5))[0]>200,'lower wall is behind the room');
    await visibleButton('Выше');assert.ok((await pixel(4,5))[0]<60);
    await visibleButton('Скрыть слой Детали');
    assert.equal(await evaluate(`document.querySelector('[data-render-layer="${layer.id}"]')`),null);
    assert.equal(await evaluate(`document.querySelector('[data-shape-id="${layered.shapes.at(-1).id}"]')`),null);
    assert.ok((await pixel(4,5))[0]>200);
    // Capture the real export serializer; downloads remain denied in this temporary browser.
    await evaluate("window.qaUrls=URL.createObjectURL;window.qaExportSvg=null;URL.createObjectURL=function(blob){if(blob.type==='image/svg+xml')blob.text().then(text=>window.qaExportSvg=text);return window.qaUrls.call(this,blob)}");
    await visibleButton('Скачать PNG');await until("!!window.qaExportSvg","export");
    const svg=await evaluate('window.qaExportSvg');
    assert.ok(!svg.includes(layered.shapes.at(-1).id));assert.ok(!svg.includes('data-ui-only'));assert.ok(!svg.includes('data-resize-handle'));
    await evaluate("URL.createObjectURL=window.qaUrls");
    assert.equal((await draft()).shapes.length,5);
    pass('layer order changes real pixels; hidden layers and editing handles are absent from actual PNG source');

    await visibleButton('Показать слой Детали');await visibleButton('Заблокировать слой Детали');
    const locked=(await draft()).shapes;
    await dragGrid(20,10,25,12);assert.deepEqual((await draft()).shapes,locked);
    await visibleButton('Выбор');await pressCanvas('a','KeyA',65,2);
    assert.ok(await evaluate("document.querySelector('.atlas-selection-bar').textContent.includes('Выбрано: 3')"));
    await pressCanvas('Delete','Delete',46);assert.deepEqual((await draft()).shapes,locked.slice(3));
    await visibleButton('Отменить изменение');assert.deepEqual((await draft()).shapes,locked);
    await visibleButton('Разблокировать слой Детали');
    await gridMouse(4,4);await gridMouse(4,4,'mouseReleased');await pause();
    const transferredId=(await draft()).shapes[0].id;
    await setField('.atlas-layers select',layer.id);
    assert.equal((await draft()).shapes.find(s=>s.id===transferredId).layerId,layer.id);
    await visibleButton('Отменить изменение');assert.equal((await draft()).shapes[0].layerId,undefined);
    pass('locked layers resist drawing, select-all and deletion; transfer preserves IDs and is undoable');

    await visibleButton('Скрыть слой Детали');
    const saved=await draft();await visibleButton('Использовать в локации');await visibleButton('Сохранить карту');
    const map=(await mapList())[0];assert.deepEqual(map.atlasDocument.layers,saved.layers);assert.deepEqual(map.atlasDocument.shapes,saved.shapes);
    await visibleButton('Закрыть карты кампании');await reload();
    await visibleButton('Мир и локации');await visibleButton('Открыть создание и импорт карты мира');await visibleButton('Редактировать карту '+map.name);
    assert.equal(await evaluate("document.querySelectorAll('[data-render-layer]').length"),1);
    const stored=JSON.parse((await active()).resources['eclivarium_living_atlas_draft_v1:'+map.id]);
    assert.deepEqual(stored.layers,saved.layers);assert.deepEqual(stored.shapes,saved.shapes);
    pass('save and reload preserve resized geometry, layers, hidden source and stable map ID');

    const beforeImport=JSON.parse((await active()).resources['eclivarium_living_atlas_draft_v1:'+map.id]);
    await uploadProject(JSON.stringify({...beforeImport,layers:[{...layer,visible:'yes'}]}));
    assert.deepEqual(JSON.parse((await active()).resources['eclivarium_living_atlas_draft_v1:'+map.id]),beforeImport);
    pass('malformed layer import leaves the existing editable map intact');

    await rpc('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await pause(300);
    await visibleButton('Скрыть параметры');await visibleButton('Показать карту целиком');
    assert.equal(await evaluate("document.documentElement.scrollWidth"),390);
    assert.ok(await evaluate("document.querySelector('.atlas-canvas-scroll').getBoundingClientRect().height >= 350"));
    await visibleButton('Слои');await visibleButton('Показать слой Детали');await visibleButton('Заблокировать слой Детали');
    await visibleButton('Разблокировать слой Детали');await visibleButton('Скрыть параметры');
    await visibleButton('Выбор');await visibleButton('Несколько');await visibleButton('Выбрать всё');
    assert.ok(await evaluate("document.querySelector('.atlas-selection-bar').textContent.includes('Выбрано: 5')"));
    await visibleButton('Закрыть редактор карты');await visibleButton('Закрыть карты кампании');
    assert.equal(await evaluate("document.querySelector('#root').inert"),false);
    pass('mobile layer and multi-selection controls have reachable hit targets and leave the workspace focus-safe');
    console.log('Atlas editing browser checks passed: '+checks);
} finally {for(const call of pending.values())clearTimeout(call.timer);socket.close();}
