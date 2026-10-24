// Synthetic local QA only. Requires a fresh, isolated headless Edge profile.
import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
const port = Number(process.argv[2] ?? 9232);
const baseUrl = process.argv[3] ?? 'http://127.0.0.1:5198/';
const before = process.argv.includes('--before');
assert.match(baseUrl, /^http:\/\/127\.0\.0\.1:\d+\/$/);
const tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const page = tabs.find(t => t.type === 'page' && t.url.startsWith(baseUrl));
assert.ok(page);
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
let id = 0;
const calls = new Map();
ws.onmessage = e => { const r = JSON.parse(e.data); const c = calls.get(r.id); if (!c) return; calls.delete(r.id); clearTimeout(c.timer); r.error ? c.reject(Error(JSON.stringify(r.error))) : c.resolve(r.result); };
function rpc(method, params = {}) { return new Promise((resolve, reject) => { const key = ++id; const timer = setTimeout(() => reject(Error(method + ' timeout')), 15000); calls.set(key, { resolve, reject, timer }); ws.send(JSON.stringify({ id: key, method, params })); }); }
async function js(expression) { const r = await rpc('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if(r.exceptionDetails) throw Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text); return r.result.value; }
const pause = (ms = 150) => new Promise(r => setTimeout(r, ms));
async function until(expression, label, rounds = 80) { for(let i = 0; i < rounds; i++) { if(await js(expression)) return; await pause(); } throw Error('Timeout: ' + label); }
async function click(label) {
    const point = await js(`(() => { const b=[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')===${JSON.stringify(label)} || b.textContent.trim()===${JSON.stringify(label)}); if(!b || b.disabled) throw Error('Button unavailable: '+${JSON.stringify(label)}); b.scrollIntoView({block:'center'}); const r=b.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`);
    assert.ok(await js(`!!document.elementFromPoint(${point.x},${point.y})?.closest('button')`));
    await rpc('Input.dispatchMouseEvent', {type:'mousePressed',...point,button:'left',buttons:1,clickCount:1});
    await rpc('Input.dispatchMouseEvent', {type:'mouseReleased',...point,button:'left',buttons:0,clickCount:1}); await pause(250);
}
async function input(text) { await js(`document.querySelector('textarea[placeholder^="Опишите"]').focus()`); await rpc('Input.insertText', {text}); }
async function screenshot(name) { if(!process.env.QA_SCREENSHOT_DIR) return; await mkdir(process.env.QA_SCREENSHOT_DIR,{recursive:true}); const r=await rpc('Page.captureScreenshot',{format:'png'});await writeFile(join(process.env.QA_SCREENSHOT_DIR,name+'.png'),Buffer.from(r.data,'base64')); }
const panel = `document.querySelector('button[aria-label="Закрыть панель DM"]')?.closest('.dnd-overlay-panel')`;
const draft = `document.querySelector('textarea[placeholder^="Опишите"]')?.value`;
const active = `JSON.parse(localStorage.getItem('eclivarium_campaign_v1:'+sessionStorage.getItem('eclivarium_active_campaign_v1')))`;
const injector = `(() => {
 const realFetch=window.fetch.bind(window); window.qaMode='offline'; window.qaCalls=[]; window.qaAborts=0;
 window.fetch=async (url,opts={})=>{
   if(String(url).endsWith('/api/chat')) {
     window.qaCalls.push(JSON.parse(opts.body));
     if(window.qaMode==='offline') throw new TypeError('Failed to fetch');
     if(/^http/.test(window.qaMode)) return new Response('PRIVATE_PROVIDER_DETAIL', {status:Number(window.qaMode.slice(4))});
     if(window.qaMode==='hang') return new Promise((resolve,reject)=>opts.signal?.addEventListener('abort',()=>{window.qaAborts++;reject(opts.signal.reason)}, {once:true}));
     if(window.qaMode==='malformed') return new Response('{broken}\\n');
     if(window.qaMode==='partial') return new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode(JSON.stringify({message:{content:'НЕЗАВЕРШЁННЫЙ'}})+'\\n'));setTimeout(()=>c.error(new TypeError('Failed to fetch')),500)}}));
     return new Response(JSON.stringify({message:{content:'СИНТЕТИЧЕСКИЙ ОТВЕТ'},done:false})+'\\n'+JSON.stringify({done:true})+'\\n');
   }
   if(new URL(String(url),location.href).origin!==location.origin) throw Error('QA external network blocked');
   return realFetch(url,opts);
 };
})()`;
let count = 0;
const pass = label => console.log(`PASS ${++count}: ${label}`);
try {
    const cmd = await rpc('Browser.getBrowserCommandLine');
    assert.ok(cmd.arguments.some(x=>x.startsWith('--user-data-dir=') && x.includes('eclivarium-reliability-a09-')));
    assert.ok(cmd.arguments.some(x=>x.startsWith('--headless')));
    await rpc('Browser.setDownloadBehavior',{behavior:'deny'});
    await rpc('Page.enable'); await rpc('Runtime.enable');
    await rpc('Page.addScriptToEvaluateOnNewDocument',{source:injector});
    await rpc('Page.navigate',{url:baseUrl});
    await until(`!![...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Ollama (локально)')`,'launcher');
    assert.equal(await js(`Object.keys(localStorage).filter(k=>k.startsWith('eclivarium_campaign_v1:')).length`),0);
    await rpc('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
    await click('Ollama (локально)');
    await js(`[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Синдер-Холлоу —')).click()`);
    await until(`!!document.querySelector('[contenteditable=true]')`,'workspace');
    await click('Переключить AI Мастера');
    const originalText = await js(`document.querySelector('[contenteditable=true]').innerText`);
    await input('QA: осматриваю мост'); await click('Отправить DM');
    await until(`!document.querySelector('textarea[placeholder^="Опишите"]').disabled`,'failed request settled');
    if(before) {
        const observed=await js(`({draft:${draft},text:${panel}.innerText,insertButtons:[...${panel}.querySelectorAll('button')].filter(b=>b.textContent.includes('Вставить в сессию')).length})`);
        console.log('BEFORE', JSON.stringify(observed));
        assert.equal(observed.insertButtons,0,'Failure must not be insertable as successful narrative');
    } else {
        assert.equal(await js(draft),'QA: осматриваю мост');
        assert.equal(await js(`${panel}.querySelectorAll('.agent-md').length`),0);
        assert.ok(await js(`${panel}.querySelector('[role=alert]')?.innerText.includes('соединение')`));
        assert.equal(await js(`document.querySelector('[contenteditable=true]').innerText`),originalText);
        pass('offline retains draft/history and cannot be inserted');
        await screenshot('dm-offline-desktop');
        for(const status of [401,429,503]) {
            await js(`window.qaMode='http${status}'`);await click('Повторить запрос');
            await until(`!document.querySelector('textarea[placeholder^="Опишите"]').disabled`,'HTTP rejection');
            assert.equal(await js(draft),'QA: осматриваю мост');
            assert.equal(await js(`${panel}.querySelectorAll('.agent-md').length`),0);
            assert.doesNotMatch(await js(`${panel}.innerText`),/PRIVATE_PROVIDER_DETAIL|HTTP \d|Failed to fetch/);
        }
        pass('401/429/503 remain errors, no raw payload or duplicate history');
        for(const mode of ['malformed','partial']) {
            await js(`window.qaMode='${mode}'`);await click('Повторить запрос');
            if(mode==='partial') { assert.equal(await js(`${panel}.querySelectorAll('.agent-md').length`),0); assert.equal(await js(`[...${panel}.querySelectorAll('button')].filter(b=>b.textContent.includes('Вставить в сессию')).length`),0); }
            await until(`!document.querySelector('textarea[placeholder^="Опишите"]').disabled`,'bad stream settles');
            assert.equal(await js(`${panel}.querySelectorAll('.agent-md').length`),0);
            assert.equal(await js(draft),'QA: осматриваю мост');
        }
        pass('malformed and interrupted partial streams are never canon');
        await js(`window.qaMode='hang'`); await click('Повторить запрос'); await click('Остановить');
        await until(`!document.querySelector('textarea[placeholder^="Опишите"]').disabled`,'cancel settled');
        assert.match(await js(`${panel}.querySelector('[role=alert]').innerText`),/остановлен/);
        assert.equal(await js(`window.qaAborts`),1);
        assert.equal(await js(draft),'QA: осматриваю мост');
        pass('Stop aborts transport and preserves request');
        await click('Повторить запрос');
        await until(`!document.querySelector('textarea[placeholder^="Опишите"]').disabled`,'real 45 second deadline',340);
        assert.match(await js(`${panel}.querySelector('[role=alert]').innerText`),/45 секунд/);
        assert.equal(await js(`window.qaAborts`),2);
        pass('45-second deadline settles stalled transport');
        await js(`window.qaMode='success'`);await click('Повторить запрос');
        await until(`${panel}.querySelectorAll('.agent-md').length===2`,'successful retry');
        assert.equal(await js(draft),'');
        assert.equal(await js(`window.qaCalls.at(-1).messages.filter(m=>m.role==='user').length`),1);
        assert.equal(await js(`[...${panel}.querySelectorAll('button')].filter(b=>b.textContent.includes('Вставить в сессию')).length`),1);
        assert.equal(await js(`document.querySelector('[contenteditable=true]').innerText`),originalText);
        pass('retry commits one user/assistant pair, canonical session stays unchanged');
        await input('QA: второй запрос');await js(`window.qaMode='hang'`);await click('Отправить DM');await click('Закрыть панель DM');
        await click('Переключить AI Мастера');
        assert.equal(await js(draft),'QA: второй запрос');
        assert.equal(await js(`${panel}.querySelectorAll('.agent-md').length`),2);
        assert.equal(await js(`document.querySelector('textarea[placeholder^="Опишите"]').disabled`),false);
        pass('close cancels in-flight work; reopen retains prior history and draft');
        await rpc('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
        await click('Мир и инструменты');
        await js(`window.qaMode='offline'`);await click('Отправить DM');
        await until(`!!${panel}.querySelector('[role=alert]')`,'mobile error');
        const bounds=await js(`(()=>{const r=${panel}.getBoundingClientRect();return {left:r.left,right:r.right,width:innerWidth};})()`);
        assert.ok(bounds.left>=0 && bounds.right<=bounds.width,'DM panel fits mobile width');
        await screenshot('dm-offline-mobile');
        // Exercise keyboard retry. No automatic provider retry and no duplicate prior messages.
        await js(`window.qaMode='success';[...${panel}.querySelectorAll('button')].find(b=>b.textContent.trim()==='Повторить запрос').focus()`);
        await rpc('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r'});
        await rpc('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
        await until(`${panel}.querySelectorAll('.agent-md').length===4`,'keyboard retry');
        assert.equal(await js(`window.qaCalls.at(-1).messages.filter(m=>m.role==='user').length`),2);
        pass('mobile error, keyboard retry and exact prior conversation');

        // A fresh document is necessary to reproduce a failed dynamic import.
        // Seed a scoped recovery snapshot through storage, not hidden application methods.
        const savedHistory=await js(`[...${panel}.querySelectorAll('.agent-md')].map((m,i)=>({role:i%2?'assistant':'user',content:m.innerText.trim(),createdAt:i+1}))`);
        await js(`sessionStorage.setItem('eclivarium_dm_recovery_v1:'+sessionStorage.getItem('eclivarium_active_campaign_v1'),JSON.stringify({draft:'QA: сбой модуля',history:${JSON.stringify(savedHistory)}}))`);
        await rpc('Network.enable');await rpc('Network.setCacheDisabled',{cacheDisabled:true});
        await rpc('Network.setBlockedURLs',{urls:['*providerFactory-*.js']});
        await rpc('Page.reload');await until(`!!document.querySelector('[contenteditable=true]')`,'reload before module failure');
        await click('Мир и инструменты');
        await click('Переключить AI Мастера');await click('Отправить DM');
        await until(`!![...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Сохранить и перезагрузить')`,'module recovery action');
        assert.equal(await js(`${panel}.querySelectorAll('.agent-md').length`),4);
        assert.equal(await js(draft),'QA: сбой модуля');
        assert.doesNotMatch(await js(`${panel}.querySelector('[role=alert]').innerText`),/https?:|\.js|import/);
        // Failed recovery persistence must NOT reload or discard the draft.
        await js(`window.qaSetItem=Storage.prototype.setItem; Storage.prototype.setItem=function(k,v){if(this===sessionStorage && k.startsWith('eclivarium_dm_recovery_v1:'))throw new DOMException('QA quota','QuotaExceededError');return window.qaSetItem.call(this,k,v)};window.qaSentinel=true`);
        await click('Сохранить и перезагрузить');
        assert.equal(await js(`window.qaSentinel`),true);
        assert.match(await js(`${panel}.querySelector('[role=alert]').innerText`),/Перезагрузка отменена/);
        assert.equal(await js(draft),'QA: сбой модуля');
        await js(`Storage.prototype.setItem=window.qaSetItem`);
        await screenshot('dm-module-recovery');
        await rpc('Network.setBlockedURLs',{urls:[]});
        await click('Сохранить и перезагрузить');
        await until(`!!document.querySelector('[contenteditable=true]') && !window.qaSentinel`,'safe reload');
        await click('Мир и инструменты');
        await click('Переключить AI Мастера');
        assert.equal(await js(draft),'QA: сбой модуля');
        assert.equal(await js(`${panel}.querySelectorAll('.agent-md').length`),4);
        assert.equal(await js(`document.querySelector('[contenteditable=true]').innerText`),originalText);
        await js(`window.qaMode='success'`);await click('Отправить DM');
        await until(`${panel}.querySelectorAll('.agent-md').length===6`,'module recovered');
        assert.equal(await js(`window.qaCalls.length`),1);
        pass('module failure -> refused unsafe reload -> saved reload -> history/draft recovered -> one retry');
        await click('Вставить в сессию');
        await until(`document.querySelector('[contenteditable=true]').innerText.includes('СИНТЕТИЧЕСКИЙ ОТВЕТ')`,'explicit successful insertion');
        await until(`${active}.world.textState.map(x=>x.children.map(c=>c.text||'').join('')).join('').includes('СИНТЕТИЧЕСКИЙ ОТВЕТ')`,'durable explicit insertion');
        await rpc('Page.reload');await until(`!!document.querySelector('[contenteditable=true]')`,'final reload');
        assert.ok(await js(`document.querySelector('[contenteditable=true]').innerText.includes('СИНТЕТИЧЕСКИЙ ОТВЕТ')`));
        pass('only explicit successful narrative insertion persists through reload');
        console.log(`AI recovery browser checks passed: ${count}; synthetic responses only, no real AI playtest`);
    }
} finally { ws.close(); }
