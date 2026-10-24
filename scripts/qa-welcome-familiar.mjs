// Only an isolated, synthetic local browser; no AI/provider calls.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
const port=Number(process.argv[2]??9232), base=process.argv[3]??'http://127.0.0.1:5198/';
assert.match(base,/^http:\/\/127\.0\.0\.1:\d+\/$/);
const tabs=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const page=tabs.find(t=>t.type==='page'&&t.url.startsWith(base));assert.ok(page);
const socket=new WebSocket(page.webSocketDebuggerUrl);await new Promise(r=>socket.addEventListener('open',r,{once:true}));
let seq=0, checks=0;const pending=new Map(),assetRequests=[],runtimeErrors=[];
socket.onmessage=e=>{const v=JSON.parse(e.data);if(v.method==='Network.requestWillBeSent'&&v.params.request.url.includes('/mascots/'))assetRequests.push(v.params.request.url);if(v.method==='Runtime.exceptionThrown')runtimeErrors.push(v.params.exceptionDetails.exception?.description??v.params.exceptionDetails.text);const p=pending.get(v.id);if(!p)return;clearTimeout(p.timer);pending.delete(v.id);v.error?p.reject(Error(JSON.stringify(v.error))):p.resolve(v.result);};
function rpc(method,params={}){return new Promise((resolve,reject)=>{const id=++seq;const timer=setTimeout(()=>reject(Error(method+' timeout')),15000);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));});}
async function js(expression){const r=await rpc('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description??r.exceptionDetails.text);return r.result.value;}
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function until(exp,label){for(let i=0;i<80;i++){if(await js(exp))return;await pause(150);}throw Error('Timeout: '+label);}
async function press(label,keyboard){
    const exp=`[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')===${JSON.stringify(label)}||b.textContent.trim()===${JSON.stringify(label)}||b.textContent.includes(${JSON.stringify(label)}))`;
    const rect=await js(`(()=>{const b=${exp};if(!b||b.disabled)throw Error('Unavailable '+${JSON.stringify(label)});b.scrollIntoView({block:'center'});if(${!!keyboard})b.focus();return b.getBoundingClientRect().toJSON()})()`);
    if(keyboard){
        const code=keyboard==='Enter'?'Enter':'Space',value=keyboard==='Enter'?13:32;
        assert.equal(await js(`document.activeElement===${exp}`),true);
        await rpc('Input.dispatchKeyEvent',{type:'keyDown',key:keyboard==='Enter'?'Enter':' ',code,windowsVirtualKeyCode:value,text:keyboard==='Enter'?'\r':' '});
        await rpc('Input.dispatchKeyEvent',{type:'keyUp',key:keyboard==='Enter'?'Enter':' ',code,windowsVirtualKeyCode:value});
    }else{
        const x=rect.x+rect.width/2,y=rect.y+rect.height/2;
        assert.equal(await js(`document.elementFromPoint(${x},${y})?.closest('button')===${exp}`),true,'Actual mouse target');
        await rpc('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',buttons:1,clickCount:1});
        await rpc('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',buttons:0,clickCount:1});
    }
}
async function shot(name){if(!process.env.QA_SCREENSHOT_DIR)return;await mkdir(process.env.QA_SCREENSHOT_DIR,{recursive:true});const r=await rpc('Page.captureScreenshot',{format:'png'});await writeFile(join(process.env.QA_SCREENSHOT_DIR,name+'.png'),Buffer.from(r.data,'base64'));}
async function tapGreeting(){
    const point=await js(`(()=>{const b=document.querySelector('.welcome-familiar__portrait');b.scrollIntoView({block:'center'});const r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
    assert.equal(await js(`document.elementFromPoint(${point.x},${point.y})?.closest('button')===document.querySelector('.welcome-familiar__portrait')`),true);
    await rpc('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...point,radiusX:1,radiusY:1,force:1}]});
    await rpc('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
}
const pass=s=>console.log(`PASS ${++checks}: ${s}`);
async function launcher(){await rpc('Page.navigate',{url:base});await until(`!!document.querySelector('.welcome-familiar')`,'welcome');}
try{
    const command=await rpc('Browser.getBrowserCommandLine');assert.ok(command.arguments.some(a=>a.startsWith('--user-data-dir=')&&a.includes('eclivarium-reliability-mascot-')));assert.ok(command.arguments.some(a=>a.startsWith('--headless')));
    await rpc('Page.enable');await rpc('Runtime.enable');await rpc('Browser.setDownloadBehavior',{behavior:'deny'});
    await rpc('Network.enable');await rpc('Performance.enable');
    await rpc('Page.addScriptToEvaluateOnNewDocument',{source:`(()=>{const nativeFetch=window.fetch.bind(window);window.qaFetchGuard=true;window.fetch=(url,opts)=>{const u=new URL(url instanceof Request?url.url:String(url),location.href);if(u.origin!==location.origin||u.pathname.includes('/chat/completions')||u.pathname.endsWith('/api/chat')){sessionStorage.setItem('qa_forbidden_network','true');throw Error('QA blocks external/provider calls')}return nativeFetch(url,opts)}})()`});
    await launcher();assert.equal(await js(`window.qaFetchGuard`),true,'External fetch guard installed');assert.equal(await js(`Object.keys(localStorage).filter(k=>k.startsWith('eclivarium_campaign_v1:')).length`),0,'Fresh QA profile only');
    await rpc('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
    await pause(1000);
    assert.equal(await js(`document.querySelector('.welcome-familiar').dataset.state`),'rest');
    assert.equal(await js(`document.querySelector('.welcome-familiar').getAnimations({subtree:true}).filter(a=>a.playState==='running').length`),0);
    await shot('welcome-desktop');pass('static rest; no infinite mascot frame loop');
    // A real second browser tab, not a synthetic visibility property override.
    const backgroundTab=await rpc('Target.createTarget',{url:'about:blank'});
    await until(`document.hidden`,'original tab becomes hidden');
    assert.equal(await js(`document.querySelector('.welcome-familiar').dataset.motion`),'still');
    assert.equal(await js(`document.querySelector('.welcome-familiar').getAnimations({subtree:true}).filter(a=>a.playState==='running').length`),0);
    await rpc('Page.bringToFront');await rpc('Target.closeTarget',{targetId:backgroundTab.targetId});
    await until(`!document.hidden`,'original tab restored');
    pass('real hidden tab has no mascot animation');
    await press('Поздороваться с фамильяром','Enter');
    assert.equal(await js(`document.querySelector('.welcome-familiar').dataset.state`),'greeting');
    assert.match(await js(`document.querySelector('.welcome-familiar__reply').textContent`),/Рад встрече/);
    await js(`document.querySelector('.welcome-familiar__figure').getAnimations().forEach(a=>{a.pause();a.currentTime=80})`);
    await shot('welcome-motion');await pause(1000);
    for(const expected of ['Покой','Скрыть фамильяра']){
        await rpc('Input.dispatchKeyEvent',{type:'rawKeyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
        await rpc('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
        assert.equal(await js(`document.activeElement.textContent`),expected);
        assert.ok(await js(`parseFloat(getComputedStyle(document.activeElement).outlineWidth)>0`),'Visible keyboard focus');
    }
    await press('Поздороваться с фамильяром','Space');assert.equal(await js(`document.querySelector('.welcome-familiar').dataset.state`),'greeting');
    assert.ok(await js(`document.querySelector('.welcome-familiar img').src.endsWith('/delight.svg')`));
    await pause(30);
    const metricsBefore=await rpc('Performance.getMetrics');await pause(100);const metricsAfter=await rpc('Performance.getMetrics');
    const metric=(m,name)=>m.metrics.find(x=>x.name===name)?.value??0;
    console.log('Motion sample LayoutCount delta:',metric(metricsAfter,'LayoutCount')-metric(metricsBefore,'LayoutCount'));
    pass('focus and Enter/Space acknowledge; short finite motion');
    await press('Покой');assert.equal(await js(`document.querySelector('.welcome-familiar').dataset.motion`),'still');
    await press('Поздороваться с фамильяром');assert.equal(await js(`getComputedStyle(document.querySelector('.welcome-familiar__figure')).animationName`),'none');
    await press('Оживить');
    await rpc('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
    await until(`document.querySelector('.welcome-familiar').dataset.motion==='still'`,'reduced motion');
    await press('Поздороваться с фамильяром','Enter');
    assert.equal(await js(`getComputedStyle(document.querySelector('.welcome-familiar__figure')).transform`),'none');
    assert.equal(await js(`getComputedStyle(document.querySelector('.welcome-familiar__figure')).animationName`),'none');
    await shot('welcome-reduced-motion');pass('manual pause and live reduced-motion preserve static feedback');
    await rpc('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
    await press('Скрыть фамильяра','Enter');
    assert.equal(await js(`document.activeElement.textContent`),'Показать фамильяра');
    await launcher();assert.equal(await js(`!!document.querySelector('.welcome-familiar__portrait')`),false);
    await press('Показать фамильяра','Space');
    assert.equal(await js(`document.activeElement.getAttribute('aria-label')`),'Поздороваться с фамильяром');
    pass('hide persists through reload; return restores keyboard focus');
    await rpc('Network.setCacheDisabled',{cacheDisabled:true});
    await rpc('Network.setBlockedURLs',{urls:['*/mascots/kverk-v0.1.0/*']});
    const requestStart=assetRequests.length;await launcher();
    await until(`!!document.querySelector('.welcome-familiar__fallback')`,'asset failure fallback');
    await pause(1100);
    assert.ok(assetRequests.length-requestStart<=2,'At most one fallback attempt; no retry loop');
    await press('Поздороваться с фамильяром','Enter');assert.match(await js(`document.querySelector('.welcome-familiar__reply').textContent`),/Рад встрече/);
    await shot('welcome-asset-fallback');
    await rpc('Network.setBlockedURLs',{urls:[]});await launcher();
    await until(`document.querySelector('.welcome-familiar img')?.naturalWidth>0`,'local art restored');
    pass('missing art: one fallback at most, accessible text control survives');
    // Real existing main transition, no provider setup or changed campaign behavior.
    await press('Пустая кампания');await until(`!!document.querySelector('[contenteditable=true]')`,'campaign main transition');
    assert.equal(await js(`!!document.querySelector('.welcome-familiar')`),false);assert.ok(await js(`!!document.querySelector('.react-flow')`));
    pass('visible mascot -> existing blank-campaign action -> workspace, no map overlay');
    await launcher();await rpc('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
    await rpc('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
    await pause(1000);await js(`window.scrollTo(0,0)`);await shot('welcome-mobile');
    const r=await js(`document.querySelector('.welcome-familiar').getBoundingClientRect().toJSON()`);assert.ok(r.left>=0&&r.right<=390,'Mascot fits narrow viewport');
    await tapGreeting();assert.equal(await js(`document.querySelector('.welcome-familiar').dataset.state`),'greeting');
    await press('Скрыть фамильяра');await press('Пустая кампания');
    await until(`!!document.querySelector('[contenteditable=true]')`,'mobile main transition');
    assert.equal(await js(`!!document.querySelector('.welcome-familiar')`),false);
    await press('Мир и инструменты');assert.ok(await js(`document.querySelector('.react-flow').getBoundingClientRect().width>0`));
    assert.equal(await js(`sessionStorage.getItem('qa_forbidden_network')`),null);
    assert.deepEqual(runtimeErrors,[],'No uncaught runtime exceptions');
    pass('mobile click/hide -> main transition -> visible world, no provider requests');
    console.log(`Welcome familiar browser checks passed: ${checks}`);
}finally{socket.close();}
