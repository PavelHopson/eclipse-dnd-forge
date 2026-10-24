import assert from 'node:assert/strict';
import test from 'node:test';
import { withAiDeadline, aiRecoveryMessage, AiModuleLoadError } from '../src/model/ai/requestRecovery.ts';
import { saveDmRecovery, readDmRecovery } from '../src/model/agents/dmRecoverySnapshot.ts';
// Provider classes use parameter properties: transpile in-memory with the existing TS dependency.
import ts from 'typescript';
import { readFile } from 'node:fs/promises';
const moduleUrl = source => 'data:text/javascript;base64,' + Buffer.from(ts.transpile(source, {target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext})).toString('base64');
async function providerClass(file, name) {
    const schemaSource = (await readFile(new URL('../src/model/ai/zodToJsonSchema.ts', import.meta.url),'utf8')).replace('"zod"',JSON.stringify(import.meta.resolve('zod')));
    const source = (await readFile(new URL('../src/model/ai/' + file, import.meta.url), 'utf8'))
        .replace('"./zodToJsonSchema.ts"', JSON.stringify(moduleUrl(schemaSource)));
    return (await import(moduleUrl(source)))[name];
}
const FallbackProvider = await providerClass('FallbackProvider.ts','FallbackProvider');

test('deadline cancels stalled operation and settles even if provider ignores abort', async () => {
    let signal;
    await assert.rejects(withAiDeadline(s => {signal=s;return new Promise(()=>{});}, undefined, 15), {name:'TimeoutError'});
    assert.equal(signal.aborted,true);
});
test('cancel before module load never invokes operation; cancel during stream settles', async () => {
    const pre = new AbortController();pre.abort();let calls=0;
    await assert.rejects(withAiDeadline(async()=>{calls++;}, pre.signal),{name:'AbortError'});
    assert.equal(calls,0);
    const mid=new AbortController(); const running=withAiDeadline(()=>new Promise(()=>{}),mid.signal);
    mid.abort();await assert.rejects(running,{name:'AbortError'});
});
test('completed deadline is disposed and late callbacks see aborted signal', async () => {
    let signal;
    assert.equal(await withAiDeadline(async s=>{signal=s;return 'complete';}), 'complete');
    assert.equal(signal.aborted,true);
});
test('player-facing errors never expose provider payload, path or key', () => {
    for(const error of [new Error('PRIVATE /internal/path token=value'),new TypeError('Failed to fetch PRIVATE'),new AiModuleLoadError(), ...[401,403,429,500,503].map(status=>new Error(`Ollama HTTP ${status}: PRIVATE`))]) {
        assert.doesNotMatch(aiRecoveryMessage(error),/PRIVATE|internal|token=|https?:/);
        assert.ok(aiRecoveryMessage(error).length>10);
    }
    assert.match(aiRecoveryMessage(new DOMException('secret','AbortError')),/остановлен/);
    assert.match(aiRecoveryMessage(new DOMException('secret','TimeoutError')),/45 секунд/);
});
test('fallback never starts next provider after abort/timeout for stream or structured calls',async()=>{
    for(const name of ['AbortError','TimeoutError','APIUserAbortError']) {
        for(const method of ['streamChat','generateStructured']) {
            let calls=0; const a={id:'ollama',[method]:async()=>{throw Object.assign(new Error('private'),{name});}};
            const b={id:'openai',[method]:async()=>{calls++;return {text:'bad'};}};
            const p=new FallbackProvider([a,b]);
            await assert.rejects(p[method]([],{}),{name});assert.equal(calls,0);
        }
    }
});
test('fallback resets failed partial and does not leak raw provider error details',async()=>{
    const partials=[];
    const a={id:'ollama',streamChat:async(_m,o)=>{o.onPartial('broken');throw Error('PRIVATE');}};
    const b={id:'openai',streamChat:async(_m,o)=>{o.onPartial('complete');return {text:'complete'};}};
    assert.deepEqual(await new FallbackProvider([a,b]).streamChat([],{onPartial:x=>partials.push(x)}),{text:'complete'});
    assert.deepEqual(partials,['broken','','complete']);
    await assert.rejects(new FallbackProvider([a]).streamChat([],{onPartial:()=>{}}),e=>!e.message.includes('PRIVATE'));
});
test('module reload snapshot is scoped, exact, validated and fails closed on storage errors',()=>{
    const values=new Map();const storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
    const data={draft:'Сохрани меня',history:[{role:'assistant',content:'Прежняя история',createdAt:1}]};
    saveDmRecovery(storage,'campaign-one',data);
    assert.deepEqual(readDmRecovery(storage,'campaign-one'),data);assert.equal(readDmRecovery(storage,'campaign-two'),null);
    assert.throws(()=>saveDmRecovery({...storage,setItem:()=>{throw Error('quota');}},'campaign-one',{draft:'new',history:[]}));
    assert.deepEqual(readDmRecovery(storage,'campaign-one'),data);
    assert.throws(()=>saveDmRecovery(storage,'campaign-one',{draft:'x'.repeat(1024*1024),history:[]}));
    values.set('eclivarium_dm_recovery_v1:campaign-two','{"draft":"x","history":[{"role":"system","content":"evil","createdAt":1}]}');
    assert.throws(()=>readDmRecovery(storage,'campaign-two'));
});
test('Ollama and Anthropic reject malformed/truncated/empty streams and accept split complete streams',async()=>{
    const oldFetch=globalThis.fetch;
    try {
        for(const [file,name,valid,truncated] of [
            ['OllamaProvider.ts','OllamaProvider','{"message":{"content":"hello"}}\n{"done":true}','{"message":{"content":"broken"}}\n'],
            ['AnthropicProvider.ts','AnthropicProvider','data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"hello"}}\ndata: {"type":"message_stop"}','data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"broken"}}\n'],
        ]) {
            const C=await providerClass(file,name); const provider = new C('synthetic-local-only');
            for(const body of ['',truncated,name==='OllamaProvider'?'{bad}\n':'data: {bad}\n']) {
                globalThis.fetch=async()=>new Response(body);
                await assert.rejects(provider.streamChat([]));
            }
            globalThis.fetch=async()=>new Response(new ReadableStream({start(c){const bytes=new TextEncoder().encode(valid);c.enqueue(bytes.slice(0,17));c.enqueue(bytes.slice(17));c.close();}}));
            assert.deepEqual(await provider.streamChat([]),{text:'hello'});
            for(const status of [401,429,503]) { globalThis.fetch=async()=>new Response('PRIVATE',{status});await assert.rejects(provider.streamChat([])); }
        }
    } finally {globalThis.fetch=oldFetch;}
});
