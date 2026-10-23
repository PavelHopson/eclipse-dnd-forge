import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GiCrown, GiDiceTwentyFacesTwenty, GiFireGem, GiScrollQuill } from "react-icons/gi";
import { IoCheckmarkCircle, IoCopyOutline, IoRefresh, IoWarningOutline } from "react-icons/io5";
import type { D20Mode, SharedTableSnapshot } from "../../model/dnd/sharedTableContract";
import { MANAGED_AI_ENABLED } from "../../model/auth/dndSession";
import {
    appendRemoteEvent,
    createRemoteCampaign,
    createRemoteInvite,
    getRemoteCampaign,
    getRemoteCampaignEvents,
    joinRemoteCampaign,
    remoteCampaignUrl,
    remoteToSharedTable,
} from "../../model/dnd/remoteCampaign";
import "./SharedTablePage.css";

type RoomCredentials = { roomId: string; key: string; expectedRole: "master" | "player" };
type RemoteCredentials = { campaignId: string; expectedRole: "master" | "player"; inviteToken?: string };
type InitiativeEntry = NonNullable<SharedTableSnapshot["initiative"]>[number];

function credentialsFromHash(): RoomCredentials | null {
    const query = window.location.hash.split("?")[1] ?? "";
    const params = new URLSearchParams(query);
    const roomId = params.get("room") ?? "";
    const key = params.get("key") ?? "";
    const expectedRole = params.get("role");
    return /^room-[a-zA-Z0-9_-]{12,80}$/.test(roomId) && key.length >= 32
        && (expectedRole === "master" || expectedRole === "player")
        ? { roomId, key, expectedRole }
        : null;
}

function remoteCredentialsFromHash(): RemoteCredentials | null {
    const query = window.location.hash.split("?")[1] ?? "";
    const params = new URLSearchParams(query);
    const campaignId = params.get("campaignId") ?? "";
    const inviteToken = params.get("invite") ?? "";
    const role = params.get("role");
    return /^campaign-[A-Za-z0-9_-]{20,80}$/.test(campaignId)
        && (role === "master" || role === "player")
        ? { campaignId, expectedRole: role, ...(inviteToken ? { inviteToken } : {}) }
        : null;
}

async function api<T>(path: string, key?: string, init?: RequestInit): Promise<T> {
    const response = await fetch(path, {
        ...init,
        headers: {
            ...(init?.body ? { "Content-Type": "application/json" } : {}),
            ...(key ? { Authorization: `Bearer ${key}` } : {}),
        },
        cache: "no-store",
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(body.error || "Shared Table временно недоступен."), { status: response.status });
    return body as T;
}

function inviteUrl(roomId: string, role: "master" | "player", key: string): string {
    return `${window.location.origin}${window.location.pathname}#/party?room=${encodeURIComponent(roomId)}&role=${role}&key=${encodeURIComponent(key)}`;
}

function sessionCharacterId(): string {
    const existing = sessionStorage.getItem("eclivarium_party_character_id");
    if (existing) return existing;
    const created = `character-${crypto.randomUUID()}`;
    sessionStorage.setItem("eclivarium_party_character_id", created);
    return created;
}

export default function SharedTablePage() {
    const initialCredentials = useMemo(credentialsFromHash, []);
    const initialRemoteCredentials = useMemo(remoteCredentialsFromHash, []);
    const [credentials, setCredentials] = useState<RoomCredentials | null>(initialCredentials);
    const [remoteCredentials, setRemoteCredentials] = useState<RemoteCredentials | null>(initialRemoteCredentials);
    const [room, setRoom] = useState<SharedTableSnapshot | null>(null);
    const [adventureTitle, setAdventureTitle] = useState("Врата над туманной долиной");
    const [character, setCharacter] = useState(() => sessionStorage.getItem("eclivarium_party_character") ?? "");
    const [characterId] = useState(sessionCharacterId);
    const [characterSummary, setCharacterSummary] = useState("");
    const [characterHp, setCharacterHp] = useState("10");
    const [characterInitiative, setCharacterInitiative] = useState("0");
    const [actionText, setActionText] = useState("");
    const [diceExpression, setDiceExpression] = useState("d20");
    const [checkDc, setCheckDc] = useState("10");
    const [checkModifier, setCheckModifier] = useState("0");
    const [checkMode, setCheckMode] = useState<D20Mode>("normal");
    const [sceneTitle, setSceneTitle] = useState("");
    const [sceneDescription, setSceneDescription] = useState("");
    const [initiativeEntries, setInitiativeEntries] = useState<InitiativeEntry[]>([]);
    const [initiativeName, setInitiativeName] = useState("");
    const [initiativeValue, setInitiativeValue] = useState("");
    const [playerInvite, setPlayerInvite] = useState(() => initialCredentials?.expectedRole === "master"
        ? sessionStorage.getItem(`eclivarium_party_invite:${initialCredentials.roomId}`) ?? "" : "");
    const remoteMode = MANAGED_AI_ENABLED || Boolean(remoteCredentials);
    const [loading, setLoading] = useState(Boolean(initialCredentials || initialRemoteCredentials));
    const [saving, setSaving] = useState(false);
    const [offline, setOffline] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [feedback, setFeedback] = useState<string | null>(null);
    const lastRevision = useRef(-1);
    const joinedInvite = useRef(false);

    useEffect(() => {
        const onHashChange = () => {
            setCredentials(credentialsFromHash());
            setRemoteCredentials(remoteCredentialsFromHash());
        };
        window.addEventListener("hashchange", onHashChange);
        return () => window.removeEventListener("hashchange", onHashChange);
    }, []);

    useEffect(() => {
        if (!feedback) return;
        const timer = window.setTimeout(() => setFeedback(null), 4500);
        return () => window.clearTimeout(timer);
    }, [feedback]);

    const applyRoom = useCallback((next: SharedTableSnapshot) => {
        setRoom(next);
        lastRevision.current = next.revision;
        setSceneTitle(next.scene.title);
        setSceneDescription(next.scene.description);
        setOffline(false);
        setLoading(false);
    }, []);

    useEffect(() => {
        if (!room) return;
        if (room.initiative) setInitiativeEntries(room.initiative);
        const ownCharacter = room.characters?.find((entry) => entry.characterId === characterId);
        if (ownCharacter) {
            setCharacter(ownCharacter.name);
            setCharacterSummary(ownCharacter.summary);
            setCharacterHp(String(ownCharacter.hp));
            setCharacterInitiative(String(ownCharacter.initiative));
        }
    }, [characterId, room]);

    const refresh = useCallback(async (silent = false) => {
        if (remoteMode) {
            if (!remoteCredentials) return;
            if (!silent) setLoading(true);
            try {
                if (remoteCredentials.inviteToken && !joinedInvite.current) {
                    const joined = await joinRemoteCampaign(remoteCredentials.inviteToken);
                    joinedInvite.current = true;
                    setRemoteCredentials({ campaignId: joined.campaignId, expectedRole: "player" });
                    applyRoom(remoteToSharedTable(joined));
                } else {
                    const remote = lastRevision.current >= 0
                        ? (await getRemoteCampaignEvents(remoteCredentials.campaignId, lastRevision.current)).snapshot
                        : await getRemoteCampaign(remoteCredentials.campaignId);
                    const expectedRole = remote.role === "owner" || remote.role === "co_dm" ? "master" : "player";
                    if (expectedRole !== remoteCredentials.expectedRole) throw new Error("Роль ссылки не совпадает с правами кампании.");
                    if (remote.revision !== lastRevision.current) applyRoom(remoteToSharedTable(remote));
                    else { setOffline(false); setLoading(false); }
                }
                setError(null);
            } catch (reason) {
                setOffline(true);
                setLoading(false);
                if (!silent) setError(reason instanceof Error ? reason.message : "Не удалось подключиться к кампании.");
            }
            return;
        }
        if (!credentials) return;
        if (!silent) setLoading(true);
        try {
            const result = await api<{ room: SharedTableSnapshot }>(`/api/shared-table/rooms/${credentials.roomId}`, credentials.key);
            if (result.room.role !== credentials.expectedRole) throw new Error("Роль ссылки не совпадает с правами приглашения.");
            if (result.room.revision !== lastRevision.current) applyRoom(result.room);
            else { setOffline(false); setLoading(false); }
            setError(null);
        } catch (reason) {
            setOffline(true);
            setLoading(false);
            if (!silent) setError(reason instanceof Error ? reason.message : "Не удалось подключиться к столу.");
        }
    }, [applyRoom, credentials, remoteCredentials, remoteMode]);

    useEffect(() => {
        if (remoteMode ? !remoteCredentials : !credentials) return;
        void refresh();
        const timer = window.setInterval(() => { if (!document.hidden) void refresh(true); }, 1200);
        const onVisible = () => { if (!document.hidden) void refresh(true); };
        document.addEventListener("visibilitychange", onVisible);
        return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); };
    }, [credentials, remoteCredentials, remoteMode, refresh]);

    const createRoom = async () => {
        if (saving) return;
        setSaving(true); setError(null); setFeedback(null);
        try {
            if (remoteMode) {
                const created = await createRemoteCampaign(adventureTitle);
                const invite = await createRemoteInvite(created.campaignId);
                const nextCredentials = { campaignId: created.campaignId, expectedRole: "master" as const };
                setRemoteCredentials(nextCredentials);
                applyRoom(remoteToSharedTable(created));
                setPlayerInvite(remoteCampaignUrl(created.campaignId, invite.inviteToken));
                window.location.hash = `/party?campaignId=${encodeURIComponent(created.campaignId)}&role=master`;
                setFeedback("Кампания создана на сервере. Отправьте игроку приглашение.");
                return;
            }
            const result = await api<{ room: SharedTableSnapshot; masterKey: string; playerKey: string }>("/api/shared-table/rooms", undefined, {
                method: "POST", body: JSON.stringify({ title: adventureTitle }),
            });
            const nextCredentials = { roomId: result.room.roomId, key: result.masterKey, expectedRole: "master" as const };
            setCredentials(nextCredentials);
            applyRoom(result.room);
            const invite = inviteUrl(result.room.roomId, "player", result.playerKey);
            setPlayerInvite(invite);
            sessionStorage.setItem(`eclivarium_party_invite:${result.room.roomId}`, invite);
            window.location.hash = `/party?room=${encodeURIComponent(result.room.roomId)}&role=master&key=${encodeURIComponent(result.masterKey)}`;
            setFeedback("Приключение открыто. Отправьте игроку ссылку ниже.");
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : "Не удалось открыть приключение.");
        } finally { setSaving(false); }
    };

    const saveScene = async () => {
        if (!room || (!credentials && !remoteCredentials) || room.role !== "master" || saving) return;
        setSaving(true); setError(null); setFeedback(null);
        try {
            if (remoteMode && remoteCredentials) {
                const result = await appendRemoteEvent(remoteCredentials.campaignId, {
                    type: "scene.update",
                    payload: { title: sceneTitle, description: sceneDescription },
                    expectedRevision: room.revision,
                }, `scene-${crypto.randomUUID()}`);
                applyRoom(remoteToSharedTable(result.campaign));
                setFeedback("Сцена обновлена для всех участников.");
                return;
            }
            if (!credentials) return;
            const result = await api<{ room: SharedTableSnapshot }>(`/api/shared-table/rooms/${room.roomId}/scene`, credentials.key, {
                method: "PUT",
                body: JSON.stringify({ title: sceneTitle, description: sceneDescription, baseRevision: room.revision }),
            });
            applyRoom(result.room);
            setFeedback("Сцена обновлена для всех участников.");
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : "Не удалось обновить сцену.");
            await refresh(true);
        } finally { setSaving(false); }
    };

    const submitAction = async () => {
        if (!room || room.role !== "player" || saving || (!credentials && !remoteCredentials)) return;
        setSaving(true); setError(null); setFeedback(null);
        const actionId = `action-${crypto.randomUUID()}`;
        const resolution = diceExpression.startsWith("d20")
            ? { dc: Number(checkDc), modifier: Number(checkModifier), mode: checkMode }
            : undefined;
        if (resolution && (!Number.isSafeInteger(resolution.dc) || resolution.dc < 1 || resolution.dc > 40
            || !Number.isSafeInteger(resolution.modifier) || resolution.modifier < -20 || resolution.modifier > 20)) {
            setError("Проверка d20 должна содержать DC 1–40 и модификатор −20…20.");
            setSaving(false);
            return;
        }
        try {
            if (remoteMode && remoteCredentials) {
                const result = await appendRemoteEvent(remoteCredentials.campaignId, {
                    type: "action.append",
                    payload: { id: actionId, actor: character, text: actionText, diceExpression },
                    expectedRevision: room.revision,
                }, actionId);
                sessionStorage.setItem("eclivarium_party_character", character.trim());
                applyRoom(remoteToSharedTable(result.campaign));
                setActionText("");
                setFeedback("Действие и бросок видны ведущему.");
                return;
            }
            if (!credentials) return;
            const result = await api<{ room: SharedTableSnapshot }>(`/api/shared-table/rooms/${room.roomId}/actions`, credentials.key, {
                method: "POST",
                body: JSON.stringify({ id: actionId, actor: character, text: actionText, diceExpression, ...(resolution ? { resolution } : {}) }),
            });
            sessionStorage.setItem("eclivarium_party_character", character.trim());
            applyRoom(result.room);
            setActionText("");
            setFeedback("Действие и бросок видны ведущему.");
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : "Не удалось отправить действие. Текст сохранён для повтора.");
        } finally { setSaving(false); }
    };

    const saveCharacterSheet = async () => {
        if (!room || room.role !== "player" || (!remoteCredentials && !credentials) || saving) return;
        const hp = Number(characterHp);
        const initiative = Number(characterInitiative);
        if (character.trim().length < 2 || !Number.isSafeInteger(hp) || !Number.isSafeInteger(initiative)
            || hp < 0 || hp > 1000 || initiative < -100 || initiative > 100) {
            setError("Заполните имя, HP и инициативу допустимыми целыми числами.");
            return;
        }
        setSaving(true); setError(null); setFeedback(null);
        try {
            if (remoteMode && remoteCredentials) {
                const result = await appendRemoteEvent(remoteCredentials.campaignId, {
                    type: "character.upsert",
                    payload: { characterId, name: character, summary: characterSummary, hp, initiative },
                    expectedRevision: room.revision,
                }, `character-${characterId}-${crypto.randomUUID()}`);
                applyRoom(remoteToSharedTable(result.campaign));
            } else if (credentials) {
                const result = await api<{ room: SharedTableSnapshot }>(`/api/shared-table/rooms/${room.roomId}/characters`, credentials.key, {
                    method: "PUT",
                    body: JSON.stringify({ characterId, name: character, summary: characterSummary, hp, initiative, baseRevision: room.revision }),
                });
                applyRoom(result.room);
            }
            sessionStorage.setItem("eclivarium_party_character", character.trim());
            setFeedback("Лист персонажа сохранён для партии.");
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : "Не удалось сохранить лист персонажа.");
            await refresh(true);
        } finally { setSaving(false); }
    };

    const addInitiativeEntry = () => {
        const name = initiativeName.trim();
        const value = Number(initiativeValue);
        if (!name || !Number.isSafeInteger(value) || value < -100 || value > 100) return;
        setInitiativeEntries((current) => [...current, {
            id: `initiative-${crypto.randomUUID()}`,
            name,
            value,
            active: current.length === 0,
        }]);
        setInitiativeName("");
        setInitiativeValue("");
    };

    const saveInitiative = async () => {
        if (!room || room.role !== "master" || (!remoteCredentials && !credentials) || saving) return;
        setSaving(true); setError(null); setFeedback(null);
        try {
            if (remoteMode && remoteCredentials) {
                const result = await appendRemoteEvent(remoteCredentials.campaignId, {
                    type: "initiative.set",
                    payload: { entries: initiativeEntries },
                    expectedRevision: room.revision,
                }, `initiative-${crypto.randomUUID()}`);
                applyRoom(remoteToSharedTable(result.campaign));
            } else if (credentials) {
                const result = await api<{ room: SharedTableSnapshot }>(`/api/shared-table/rooms/${room.roomId}/initiative`, credentials.key, {
                    method: "PUT",
                    body: JSON.stringify({ entries: initiativeEntries, baseRevision: room.revision }),
                });
                applyRoom(result.room);
            }
            setFeedback("Инициатива обновлена для всех участников.");
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : "Не удалось сохранить инициативу.");
            await refresh(true);
        } finally { setSaving(false); }
    };

    const copyInvite = async () => {
        try { await navigator.clipboard.writeText(playerInvite); setFeedback("Ссылка игрока скопирована."); }
        catch { setError("Не удалось скопировать автоматически. Выделите ссылку вручную."); }
    };

    if (!credentials && !remoteCredentials) {
        return <main className="shared-table-start">
            <a className="shared-table-back" href="#/">← Кампании</a>
            <section className="shared-table-start__card">
                <span className="shared-table-eyebrow">Живой общий стол</span>
                <h1>Откройте приключение</h1>
                <p>Сцена, броски и журнал действий синхронизируются между ведущим и игроком и сохраняются после повторного входа.</p>
                <label>Название приключения<input value={adventureTitle} maxLength={80} onChange={(event) => setAdventureTitle(event.target.value)} /></label>
                {error && <p className="shared-table-message is-error" role="alert"><IoWarningOutline /> {error}</p>}
                <button className="shared-table-primary" type="button" disabled={saving || adventureTitle.trim().length < 3} onClick={() => void createRoom()}>
                    <GiFireGem /> {saving ? "Открываем…" : "Открыть сцену и получить приглашение"}
                </button>
                <p className="shared-table-local-note">{remoteMode ? "Серверная кампания: вход и права проверяются через Eclipse Chat." : "Локальный playable slice: сервер принимает подключения только с этого компьютера."}</p>
            </section>
        </main>;
    }

    if (loading && !room) return <main className="shared-table-loading" aria-busy="true" aria-live="polite"><GiFireGem /><p>Подключаемся к приключению…</p></main>;

    if (!room) return <main className="shared-table-loading">
        <IoWarningOutline />
        <h1>Не удалось войти</h1>
        <p role="alert">{error || "Проверьте ссылку и запущен ли Shared Table server."}</p>
        <button className="shared-table-primary" type="button" onClick={() => void refresh()}>Повторить подключение</button>
    </main>;

    return <main className="shared-table-shell">
        <header className="shared-table-topbar">
            <div><span className="shared-table-eyebrow">{room.role === "master" ? "Ведущий" : "Игрок"}</span><strong>{room.title}</strong></div>
            <div className={`shared-table-connection ${offline ? "is-offline" : ""}`} role="status">
                {offline ? <IoWarningOutline /> : <IoCheckmarkCircle />} {offline ? "Связь потеряна" : "Стол синхронизирован"}
                {offline && <button type="button" onClick={() => void refresh()}>Повторить</button>}
            </div>
        </header>

        <section className="shared-table-scene" style={{ backgroundImage: `linear-gradient(90deg, rgba(8, 13, 18, .9), rgba(8, 13, 18, .16)), url(${room.scene.background})` }}>
            <div className="shared-table-scene__copy">
                <span>Текущая сцена</span><h1>{room.scene.title}</h1><p>{room.scene.description}</p>
            </div>
        </section>

        <div className="shared-table-grid">
            <section className="shared-table-panel" aria-labelledby="table-actions-title">
                <div className="shared-table-section-title"><div><span>Общий журнал</span><h2 id="table-actions-title">Действия партии</h2></div><IoRefresh aria-hidden="true" /></div>
                <div className="shared-table-log" aria-live="polite">
                    {room.actions.length === 0 ? <div className="shared-table-empty"><GiScrollQuill /><strong>Первый ход ещё не сделан</strong><span>Игрок описывает действие и бросает кубик — результат сразу появляется здесь.</span></div>
                        : [...room.actions].reverse().map((action) => <article key={action.id} className="shared-table-action"><div><strong>{action.actor}</strong><time>{new Date(action.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time></div><p>{action.text}</p><span><GiDiceTwentyFacesTwenty /> {action.dice.expr}: <strong>{action.dice.total}</strong> ({action.dice.rolls.join("+")}{action.dice.modifier > 0 ? `+${action.dice.modifier}` : action.dice.modifier < 0 ? action.dice.modifier : ""})</span>{action.resolution && <div className={`shared-table-resolution is-${action.resolution.outcome}`} data-testid="shared-table-resolution"><strong>{action.resolution.outcome === "critical-success" ? "Критический успех" : action.resolution.outcome === "critical-failure" ? "Критический провал" : action.resolution.success ? "Успех" : "Провал"}</strong><span>DC {action.resolution.dc} · модификатор {action.resolution.modifier >= 0 ? `+${action.resolution.modifier}` : action.resolution.modifier} · итог {action.resolution.total}</span></div>}</article>)}
                </div>
            </section>

            {room.role === "master" ? <aside className="shared-table-panel shared-table-controls">
                <div className="shared-table-section-title"><div><span>Права ведущего</span><h2><GiCrown /> Управление сценой</h2></div></div>
                <label>Название сцены<input value={sceneTitle} maxLength={100} onChange={(event) => setSceneTitle(event.target.value)} /></label>
                <label>Что видят игроки<textarea value={sceneDescription} maxLength={800} onChange={(event) => setSceneDescription(event.target.value)} /></label>
                <button className="shared-table-primary" type="button" disabled={saving || !sceneTitle.trim() || !sceneDescription.trim()} onClick={() => void saveScene()}>{saving ? "Сохраняем…" : "Показать обновлённую сцену"}</button>
                <div className="shared-table-invite"><strong>Ссылка игрока</strong>{playerInvite ? <><input readOnly value={playerInvite} onFocus={(event) => event.currentTarget.select()} aria-label="Ссылка-приглашение игрока" /><button type="button" onClick={() => void copyInvite()}><IoCopyOutline /> Копировать</button></> : <p>Ссылка показана только после создания. Для нового приглашения откройте новое приключение.</p>}</div>
                <div className="shared-table-combat">
                    <div className="shared-table-section-title"><div><span>Состояние боя</span><h2><GiDiceTwentyFacesTwenty /> Инициатива</h2></div></div>
                    <div className="shared-table-initiative-list">
                        {initiativeEntries.length === 0 ? <span className="shared-table-muted">Добавьте участников боя.</span> : initiativeEntries.map((entry) => <label key={entry.id} className="shared-table-initiative-row">
                            <input value={entry.name} maxLength={80} onChange={(event) => setInitiativeEntries((current) => current.map((item) => item.id === entry.id ? { ...item, name: event.target.value } : item))} aria-label={`Участник ${entry.name}`} />
                            <input value={String(entry.value)} type="number" min="-100" max="100" onChange={(event) => setInitiativeEntries((current) => current.map((item) => item.id === entry.id ? { ...item, value: Number(event.target.value) } : item))} aria-label={`Инициатива ${entry.name}`} />
                            <button type="button" className={entry.active ? "is-active" : ""} onClick={() => setInitiativeEntries((current) => current.map((item) => ({ ...item, active: item.id === entry.id })))} aria-label={`Сделать ход ${entry.name}`}>{entry.active ? "Ход" : "Выбрать"}</button>
                        </label>)}
                    </div>
                    <div className="shared-table-initiative-add"><input value={initiativeName} maxLength={80} onChange={(event) => setInitiativeName(event.target.value)} placeholder="Имя участника" aria-label="Имя нового участника" /><input value={initiativeValue} type="number" min="-100" max="100" onChange={(event) => setInitiativeValue(event.target.value)} placeholder="0" aria-label="Инициатива нового участника" /><button type="button" onClick={addInitiativeEntry}>Добавить</button></div>
                    <button className="shared-table-secondary" type="button" disabled={saving} onClick={() => void saveInitiative()}>{saving ? "Сохраняем…" : "Сохранить инициативу"}</button>
                </div>
            </aside> : <aside className="shared-table-panel shared-table-controls">
                <div className="shared-table-section-title"><div><span>Ваш ход</span><h2><GiDiceTwentyFacesTwenty /> Действие и бросок</h2></div></div>
                <label>Имя персонажа<input autoComplete="nickname" value={character} maxLength={40} onChange={(event) => setCharacter(event.target.value)} placeholder="Например: Иара" /></label>
                <label>Что вы делаете<textarea value={actionText} maxLength={240} onChange={(event) => setActionText(event.target.value)} placeholder="Осматриваю руны на каменной арке" /></label>
                <label>Бросок<select value={diceExpression} onChange={(event) => setDiceExpression(event.target.value)}><option value="d20">d20</option><option value="d20+3">d20+3</option><option value="d20+5">d20+5</option><option value="2d6">2d6</option></select></label>
                 {diceExpression.startsWith("d20") && <div className="shared-table-resolution-fields" data-testid="shared-table-resolution-fields"><label>Сложность (DC)<input type="number" min="1" max="40" step="1" value={checkDc} onChange={(event) => setCheckDc(event.target.value)} aria-label="Сложность проверки DC" /></label><label>Модификатор<input type="number" min="-20" max="20" step="1" value={checkModifier} onChange={(event) => setCheckModifier(event.target.value)} aria-label="Модификатор проверки" /></label><label>Режим<select value={checkMode} onChange={(event) => setCheckMode(event.target.value as D20Mode)} aria-label="Режим броска d20"><option value="normal">Обычный</option><option value="advantage">Преимущество</option><option value="disadvantage">Помеха</option></select></label></div>}
                 {remoteMode && diceExpression.startsWith("d20") && <p className="shared-table-muted">Для серверной кампании пока используется обычный бросок без DC; проверка DC доступна в локальном общем столе.</p>}
                <button className="shared-table-primary" type="button" disabled={saving || character.trim().length < 2 || actionText.trim().length < 2} onClick={() => void submitAction()}>{saving ? "Отправляем…" : "Выполнить действие и бросить"}</button>
                <div className="shared-table-combat">
                    <div className="shared-table-section-title"><div><span>Ваш персонаж</span><h2><GiScrollQuill /> Лист персонажа</h2></div></div>
                    <label>Кратко о персонаже<textarea value={characterSummary} maxLength={1000} onChange={(event) => setCharacterSummary(event.target.value)} placeholder="Роль, особенности, текущая цель" /></label>
                    <div className="shared-table-inline-fields"><label>HP<input value={characterHp} type="number" min="0" max="1000" onChange={(event) => setCharacterHp(event.target.value)} /></label><label>Инициатива<input value={characterInitiative} type="number" min="-100" max="100" onChange={(event) => setCharacterInitiative(event.target.value)} /></label></div>
                    <button className="shared-table-secondary" type="button" disabled={saving || character.trim().length < 2} onClick={() => void saveCharacterSheet()}>{saving ? "Сохраняем…" : "Сохранить лист"}</button>
                    {room.initiative.length > 0 && <div className="shared-table-initiative-readonly"><strong>Инициатива партии</strong>{room.initiative.map((entry) => <span key={entry.id} className={entry.active ? "is-active" : ""}>{entry.name}: {entry.value}</span>)}</div>}
                </div>
            </aside>}
        </div>

        {(error || feedback) && <div className={`shared-table-toast ${error ? "is-error" : "is-success"}`} role={error ? "alert" : "status"}>{error ? <IoWarningOutline /> : <IoCheckmarkCircle />}{error || feedback}</div>}
    </main>;
}
