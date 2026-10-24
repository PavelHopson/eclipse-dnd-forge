// Two-profile local playtest. Start two isolated headless Edge/Chromium instances with
// --enable-automation --headless=new --user-data-dir=<...eclivarium-shared-table-master/player...>
// and separate --remote-debugging-port values. Never point this at a normal profile.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const masterPort = Number(process.argv[2] ?? 9240);
const playerPort = Number(process.argv[3] ?? 9241);
const baseUrl = process.argv[4] ?? "http://127.0.0.1:5210/";
const screenshotDir = process.env.QA_SCREENSHOT_DIR;
assert.match(baseUrl, /^http:\/\/127\.0\.0\.1:\d+\/$/, "QA accepts loopback only");

const pause = (ms = 180) => new Promise((resolve) => setTimeout(resolve, ms));

async function connect(port, profileMarker) {
    const tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    const page = tabs.find((tab) => tab.type === "page");
    assert.ok(page, `No page target on CDP ${port}`);
    const socket = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve) => socket.addEventListener("open", resolve, { once: true }));
    let sequence = 0;
    const pending = new Map();
    const requests = [];
    const errors = [];
    socket.addEventListener("message", (event) => {
        const message = JSON.parse(event.data);
        if (message.method === "Network.requestWillBeSent") requests.push(message.params.request.url);
        if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails.text);
        if (message.method === "Fetch.requestPaused") {
            socket.send(JSON.stringify({ id: ++sequence, method: "Fetch.failRequest", params: { requestId: message.params.requestId, errorReason: "InternetDisconnected" } }));
            return;
        }
        if (!message.id) return;
        const call = pending.get(message.id); if (!call) return;
        clearTimeout(call.timer); pending.delete(message.id);
        if (message.error) call.reject(new Error(JSON.stringify(message.error))); else call.resolve(message.result);
    });
    const rpc = (method, params = {}) => new Promise((resolve, reject) => {
        const id = ++sequence;
        const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 12_000);
        pending.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params }));
    });
    const evaluate = async (expression) => {
        const result = await rpc("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
        if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
        return result.result.value;
    };
    const until = async (expression, label) => {
        for (let index = 0; index < 80; index++) { if (await evaluate(expression)) return; await pause(); }
        throw new Error(`Timed out: ${label}`);
    };
    const click = async (label) => {
        await evaluate(`(() => { const button=[...document.querySelectorAll('button')].find(e=>e.textContent.trim()===${JSON.stringify(label)}); if(!button||button.disabled) throw new Error('Unavailable: '+${JSON.stringify(label)}); button.click(); })()`);
        await pause(300);
    };
    const setField = async (selector, value) => {
        await evaluate(`(() => { const element=document.querySelector(${JSON.stringify(selector)}); if(!element) throw new Error('Missing field'); const descriptor=Object.getOwnPropertyDescriptor(element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,'value'); descriptor.set.call(element,${JSON.stringify(value)}); element.dispatchEvent(new Event('input',{bubbles:true})); })()`);
        await pause();
    };
    const setFieldAt = async (selector, index, value) => {
        await evaluate(`(() => { const element=document.querySelectorAll(${JSON.stringify(selector)})[${index}]; if(!element) throw new Error('Missing indexed field'); const descriptor=Object.getOwnPropertyDescriptor(element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,'value'); descriptor.set.call(element,${JSON.stringify(value)}); element.dispatchEvent(new Event('input',{bubbles:true})); })()`);
        await pause();
    };
    await rpc("Runtime.enable"); await rpc("Page.enable"); await rpc("Network.enable");
    const command = await rpc("Browser.getBrowserCommandLine");
    assert.ok(command.arguments.some((arg) => arg.startsWith("--user-data-dir=") && arg.includes(profileMarker)), "Refusing ordinary browser profile");
    assert.ok(command.arguments.some((arg) => arg.startsWith("--headless")), "QA requires headless browser");
    await rpc("Browser.setDownloadBehavior", { behavior: "deny" });
    return { port, socket, rpc, evaluate, until, click, setField, setFieldAt, requests, errors };
}

async function navigate(client, url) {
    await client.rpc("Page.navigate", { url });
    await client.until(`document.readyState==='complete' && !!document.querySelector('#root')`, "page load");
}

async function screenshot(client, name) {
    if (!screenshotDir) return;
    await mkdir(screenshotDir, { recursive: true });
    const result = await client.rpc("Page.captureScreenshot", { format: "png" });
    await writeFile(join(screenshotDir, `${name}.png`), Buffer.from(result.data, "base64"));
}

const master = await connect(masterPort, "eclivarium-shared-table-master-");
const player = await connect(playerPort, "eclivarium-shared-table-player-");
let checks = 0;
const pass = (label) => console.log(`PASS ${++checks}: ${label}`);

try {
    await master.rpc("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    await player.rpc("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await navigate(master, baseUrl);
    await master.until(`!![...document.querySelectorAll('a')].find(link=>link.textContent.includes('Открыть общий стол'))`, "launcher entry");
    await master.evaluate(`[...document.querySelectorAll('a')].find(link=>link.textContent.includes('Открыть общий стол')).click()`);
    await master.until(`!!document.querySelector('.shared-table-start')`, "master start");
    await master.click("Открыть сцену и получить приглашение");
    await master.until(`!!document.querySelector('.shared-table-shell') && !!document.querySelector('.shared-table-invite input')`, "master room");
    const playerInvite = await master.evaluate(`document.querySelector('.shared-table-invite input').value`);
    assert.match(playerInvite, /#\/party\?room=room-.+role=player&key=/);
    assert.equal(await master.evaluate(`document.body.innerText.includes('Управление сценой') && !document.body.innerText.includes('Действие и бросок')`), true);
    pass("master creates a real room and receives a player-only invitation");

    await navigate(player, playerInvite);
    await player.until(`!!document.querySelector('.shared-table-shell') && document.body.innerText.includes('Игрок')`, "player joins");
    assert.equal(await player.evaluate(`document.body.innerText.includes('Действие и бросок') && !document.body.innerText.includes('Управление сценой')`), true);
    assert.equal(await player.evaluate(`document.querySelector('.shared-table-scene h1').textContent`), "У врат затерянного святилища");
    assert.equal(await player.evaluate(`document.documentElement.scrollWidth`), 390);
    pass("independent player profile joins with player rights and sees the scene on a narrow screen");

    await player.setField(".shared-table-controls input", "Иара");
    await player.setFieldAt(".shared-table-controls textarea", 1, "Следопыт ищет след древнего механизма.");
    await player.setFieldAt(".shared-table-inline-fields input", 0, "12");
    await player.setFieldAt(".shared-table-inline-fields input", 1, "3");
    await player.click("Сохранить лист");
    await player.until(`document.querySelector('.shared-table-inline-fields input')?.value==='12'`, "character sheet save");
    pass("player saves a bounded character sheet");

    await pause(1500);
    await master.setField(".shared-table-initiative-add input:nth-of-type(1)", "Страж арки");
    await master.setField(".shared-table-initiative-add input:nth-of-type(2)", "14");
    await master.click("Добавить");
    await master.click("Сохранить инициативу");
    await player.until(`document.querySelector('.shared-table-initiative-readonly')?.innerText.includes('Страж арки')`, "initiative sync");
    await master.click("Начать бой");
    await player.until(`document.querySelector('.shared-table-initiative-readonly')?.innerText.includes('Раунд 1')`, "combat start sync");
    pass("master publishes initiative, starts combat and player receives the active turn");

    await player.setField(".shared-table-controls textarea", "Осматриваю руны на каменной арке");
    await player.click("Выполнить действие и бросить");
    await player.until(`document.querySelectorAll('.shared-table-action').length===1`, "player action");
    await master.until(`document.querySelector('.shared-table-action')?.innerText.includes('Иара')`, "master receives action");
    assert.ok(await master.evaluate(`document.querySelector('.shared-table-action').innerText.includes('d20')`));
    pass("server-authoritative roll and action synchronize to the master");

    await master.setFieldAt(".shared-table-check-controls input", 0, "15");
    await master.setFieldAt(".shared-table-check-controls input", 1, "2");
    await master.click("Рассчитать d20");
    await player.until(`!!document.querySelector('.shared-table-resolution')`, "player receives d20 resolution");
    pass("master requests a server-owned d20 check and player receives the result");

    await master.setField(".shared-table-action-reply textarea", "Замок поддаётся, и за аркой открывается новый проход.");
    await master.click("Ответить игроку");
    await player.until(`document.querySelector('.shared-table-dm-reply')?.innerText.includes('Замок поддаётся')`, "player receives DM response");
    pass("master response returns to the player and stays in the shared journal");

    await master.click("Следующий ход");
    await player.until(`document.querySelector('.shared-table-initiative-readonly')?.innerText.includes('Раунд 2')`, "next turn sync");
    await master.click("Завершить бой");
    await player.until(`!document.querySelector('.shared-table-initiative-readonly')?.innerText.includes('Раунд 2')`, "combat end sync");
    pass("server-owned turn advances and can end while preserving the initiative list");

    await master.setField(".shared-table-controls input", "Каменный порог");
    await master.setField(".shared-table-controls textarea", "В рунах проступает холодный синий свет.");
    await master.click("Показать обновлённую сцену");
    await player.until(`document.querySelector('.shared-table-scene h1')?.textContent==='Каменный порог'`, "player receives scene");
    pass("master-only scene update synchronizes to the player");

    await player.rpc("Page.reload");
    await player.until(`document.querySelector('.shared-table-action')?.innerText.includes('Иара') && document.querySelector('.shared-table-scene h1')?.textContent==='Каменный порог' && document.querySelector('.shared-table-inline-fields input')?.value==='12'`, "player reconnect state");
    pass("player reconnect restores scene and action history");

    await player.rpc("Fetch.enable", { patterns: [{ urlPattern: "*api/shared-table/rooms/*", requestStage: "Request" }] });
    await player.rpc("Page.setWebLifecycleState", { state: "active" });
    await player.evaluate(`document.dispatchEvent(new Event('visibilitychange'))`);
    await player.until(`document.body.innerText.includes('Связь потеряна')`, "offline state");
    await player.rpc("Fetch.disable");
    await player.click("Повторить");
    await player.until(`document.body.innerText.includes('Стол синхронизирован') && !document.body.innerText.includes('Связь потеряна')`, "reconnected state");
    pass("visible offline state recovers without losing the pending room state");

    assert.equal(await master.evaluate(`document.documentElement.scrollWidth <= window.innerWidth`), true);
    assert.equal(master.errors.length + player.errors.length, 0, "No uncaught browser exceptions");
    const external = [...master.requests, ...player.requests].filter((url) => !url.startsWith(baseUrl) && !url.startsWith("data:"));
    assert.deepEqual(external, [], "No external runtime requests");
    await screenshot(master, "shared-table-master");
    await screenshot(player, "shared-table-player-mobile");
    pass("desktop/mobile layouts have no horizontal overflow or external requests");
    console.log(`Shared Table QA: ${checks}/${checks} passed`);
} finally {
    master.socket.close(); player.socket.close();
}
