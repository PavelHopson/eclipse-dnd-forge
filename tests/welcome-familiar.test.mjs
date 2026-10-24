import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const component=await readFile(new URL('../src/view/dnd/WelcomeFamiliar.tsx',import.meta.url),'utf8');
const css=await readFile(new URL('../src/view/dnd/WelcomeFamiliar.css',import.meta.url),'utf8');
const launcher=await readFile(new URL('../src/view/Launcher.tsx',import.meta.url),'utf8');
test('familiar is isolated from campaign, providers, map and agent state',()=>{
    assert.match(launcher,/<WelcomeFamiliar\s*\/>/);
    assert.doesNotMatch(component,/useModelStore|campaignRepository|useAgentStore|fetch\(|currentProvider|insertTextAtCursor/);
    assert.doesNotMatch(css,/position:\s*(fixed|absolute)|z-index/);
});
test('native controls expose hide/return, pause and non-noisy decorative graphic',()=>{
    assert.match(component,/Поздороваться с фамильяром/);assert.match(component,/Показать фамильяра/);assert.match(component,/Скрыть фамильяра/);
    assert.match(component,/aria-pressed/);assert.match(component,/alt=""/);assert.match(component,/aria-hidden="true"/);
    assert.match(css,/:focus-visible/);assert.match(css,/min-height: 44px/);
});
test('motion is bounded and reduced/hidden-page aware, with no frame loop',()=>{
    assert.match(component,/visibilitychange/);assert.match(component,/removeEventListener/);
    assert.match(component,/prefers-reduced-motion: reduce/);assert.doesNotMatch(component,/requestAnimationFrame|setInterval/);
    assert.match(css,/180ms ease-in-out 1/);assert.doesNotMatch(css,/infinite|will-change/);
    assert.match(component,/clearTimeout/);
});
test('asset failure has a safe graphic/text fallback; optional preference failure cannot block welcome',()=>{
    assert.match(component,/onError=/);assert.match(component,/welcome-familiar__fallback/);
    assert.match(component,/try \{ localStorage.setItem/);assert.match(component,/catch/);
    assert.match(component,/Эскиз · локальная примерка/);
});
test('versioned original SVG snapshot is passive, local and has stable geometry',async()=>{
    for(const name of ['idle','greet','curious','delight','rest']){
        const svg=await readFile(new URL(`../public/mascots/kverk-v0.1.0/${name}.svg`,import.meta.url),'utf8');
        assert.match(svg,/viewBox="0 0 256 256"/);
        assert.doesNotMatch(svg,/<(?:script|foreignObject|image|animate|set)\b|href=|\bon\w+=|url\(/i);
        assert.ok(Buffer.byteLength(svg)<4096);
    }
    assert.match(component,/import.meta.env.BASE_URL/);
});
