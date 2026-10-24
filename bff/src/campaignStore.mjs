import { createHash, randomBytes, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

export const CAMPAIGN_SCHEMA = "eclipse.campaign.v1";
export const CAMPAIGN_BACKUP_SCHEMA = "eclipse.campaign-backup.v1";
export const MAX_CAMPAIGNS = 10_000;
export const MAX_EVENTS = 5_000;
export const MAX_ACTIONS = 240;

export class CampaignStoreError extends Error {
    constructor(status, code, message) {
        super(message);
        this.status = status;
        this.code = code;
    }
}

const ROLE_ORDER = new Set(["owner", "co_dm", "player", "viewer"]);
const EVENT_TYPES = new Set(["scene.update", "action.append", "action.resolve", "action.check", "initiative.set", "initiative.start", "initiative.advance", "initiative.end", "character.upsert", "gm.note"]);
const SHARED_TABLE_BACKGROUND = "/assets/scenes/dnd-gateway.png";

function fail(status, code, message) {
    throw new CampaignStoreError(status, code, message);
}

function clone(value) {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
}

function hash(value) {
    return createHash("sha256").update(value, "utf8").digest("hex");
}

function cleanText(value, maxLength) {
    if (typeof value !== "string") return "";
    return Array.from(value, (character) => {
        const code = character.codePointAt(0) ?? 0;
        const blocked = code <= 31 || (code >= 127 && code <= 159)
            || (code >= 0x202a && code <= 0x202e) || (code >= 0x2066 && code <= 0x2069);
        return blocked ? " " : character;
    }).join("").replace(/\s+/g, " ").trim().slice(0, maxLength).trim();
}

function exact(value, fields) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const actual = Object.keys(value).sort();
    const expected = [...fields].sort();
    return actual.length === expected.length && actual.every((field, index) => field === expected[index]);
}

function sameHash(left, right) {
    if (!/^[a-f0-9]{64}$/.test(left) || !/^[a-f0-9]{64}$/.test(right)) return false;
    return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

function validCampaignId(value) {
    return typeof value === "string" && /^campaign-[A-Za-z0-9_-]{20,80}$/.test(value);
}

function validDice(expression) {
    const normalized = cleanText(expression, 16).toLowerCase();
    const match = normalized.match(/^(\d{0,2})d(\d{1,4})([+-]\d{1,4})?$/);
    if (!match) fail(400, "invalid_dice", "Используйте бросок вида d20, d20+5 или 2d6.");
    const count = Number(match[1] || 1);
    const sides = Number(match[2]);
    const modifier = Number(match[3] || 0);
    if (count < 1 || count > 20 || sides < 2 || sides > 1000 || Math.abs(modifier) > 1000) {
        fail(400, "invalid_dice", "Формула броска выходит за допустимые границы.");
    }
    const rolls = Array.from({ length: count }, () => randomInt(1, sides + 1));
    return {
        expr: normalized,
        rolls,
        modifier,
        total: rolls.reduce((sum, roll) => sum + roll, modifier),
    };
}

function resolveD20Check(input) {
    if (!exact(input, ["dc", "modifier", "mode"]) || !Number.isSafeInteger(input.dc) || input.dc < 1 || input.dc > 40
        || !Number.isSafeInteger(input.modifier) || input.modifier < -20 || input.modifier > 20
        || (input.mode !== "normal" && input.mode !== "advantage" && input.mode !== "disadvantage")) {
        fail(400, "invalid_resolution", "Проверка d20 должна содержать DC 1–40, модификатор −20…20 и режим броска.");
    }
    const rolls = input.mode === "normal"
        ? [randomInt(1, 21)]
        : [randomInt(1, 21), randomInt(1, 21)];
    const selected = input.mode === "advantage" ? Math.max(...rolls) : input.mode === "disadvantage" ? Math.min(...rolls) : rolls[0];
    const natural = selected;
    const total = selected + input.modifier;
    const outcome = natural === 20 ? "critical-success"
        : natural === 1 ? "critical-failure"
            : total >= input.dc ? "success" : "failure";
    return { dc: input.dc, modifier: input.modifier, mode: input.mode, rolls, selected, total, natural, outcome, success: outcome === "success" || outcome === "critical-success" };
}

function memberFor(campaign, subject) {
    return campaign.members.find((member) => member.subject === subject && !member.revokedAt) ?? null;
}

function roleCanRead(role) {
    return role !== null;
}

function roleCanWriteGame(role) {
    return role === "owner" || role === "co_dm";
}

function roleCanAppendAction(role) {
    return role === "owner" || role === "co_dm" || role === "player";
}

function boundedText(value, maxLength, minimum = 1) {
    return typeof value === "string" && value.length >= minimum && value.length <= maxLength;
}

function diceRecordValid(value) {
    return value && typeof value === "object" && !Array.isArray(value)
        && boundedText(value.expr, 16)
        && /^(?:\d{0,2})d\d{1,4}(?:[+-]\d{1,4})?$/.test(value.expr)
        && Array.isArray(value.rolls) && value.rolls.length >= 1 && value.rolls.length <= 20
        && value.rolls.every((roll) => Number.isSafeInteger(roll) && roll >= 1 && roll <= 1000)
        && Number.isSafeInteger(value.modifier) && Math.abs(value.modifier) <= 1000
        && Number.isSafeInteger(value.total);
}

function actionRecordValid(value) {
    const hasResolution = value && typeof value === "object" && Object.prototype.hasOwnProperty.call(value, "resolution");
    const hasDmReply = value && typeof value === "object" && Object.prototype.hasOwnProperty.call(value, "dmReply");
    const keys = ["id", "actor", "text", "dice", "createdAt"];
    if (hasResolution) keys.push("resolution");
    if (hasDmReply) keys.push("dmReply");
    return exact(value, keys)
        && boundedText(value.id, 80) && /^action-[A-Za-z0-9-]{8,72}$/.test(value.id)
        && boundedText(value.actor, 40, 2) && boundedText(value.text, 240, 2)
        && diceRecordValid(value.dice) && (!hasResolution || d20ResolutionValid(value.resolution))
        && (!hasDmReply || dmReplyValid(value.dmReply))
        && Number.isSafeInteger(value.createdAt) && value.createdAt >= 0;
}

function dmReplyValid(value) {
    return exact(value, ["text", "createdAt"])
        && boundedText(value.text, 1_000, 2)
        && Number.isSafeInteger(value.createdAt) && value.createdAt >= 0;
}

function d20ResolutionValid(value) {
    if (!exact(value, ["dc", "modifier", "mode", "rolls", "selected", "total", "natural", "outcome", "success"])
        || !Number.isSafeInteger(value.dc) || value.dc < 1 || value.dc > 40
        || !Number.isSafeInteger(value.modifier) || value.modifier < -20 || value.modifier > 20
        || (value.mode !== "normal" && value.mode !== "advantage" && value.mode !== "disadvantage")
        || !Array.isArray(value.rolls) || !Number.isSafeInteger(value.selected) || value.selected < 1 || value.selected > 20
        || !Number.isSafeInteger(value.total) || value.total < -19 || value.total > 40
        || !Number.isSafeInteger(value.natural) || value.natural < 1 || value.natural > 20
        || (value.outcome !== "success" && value.outcome !== "failure" && value.outcome !== "critical-success" && value.outcome !== "critical-failure")
        || typeof value.success !== "boolean") return false;
    const expectedRollCount = value.mode === "normal" ? 1 : 2;
    if (value.rolls.length !== expectedRollCount || !value.rolls.every((roll) => Number.isSafeInteger(roll) && roll >= 1 && roll <= 20)) return false;
    const selected = value.mode === "advantage" ? Math.max(...value.rolls) : value.mode === "disadvantage" ? Math.min(...value.rolls) : value.rolls[0];
    const expectedOutcome = value.natural === 20 ? "critical-success"
        : value.natural === 1 ? "critical-failure"
            : value.total >= value.dc ? "success" : "failure";
    return value.selected === selected
        && value.natural === selected
        && value.total === selected + value.modifier
        && value.outcome === expectedOutcome
        && value.success === (expectedOutcome === "success" || expectedOutcome === "critical-success");
}

function initiativeRecordValid(value) {
    return value && typeof value === "object" && !Array.isArray(value)
        && boundedText(value.id, 80) && boundedText(value.name, 80)
        && Number.isSafeInteger(value.value) && value.value >= -100 && value.value <= 100
        && typeof value.active === "boolean";
}

function turnRecordValid(value) {
    return value && typeof value === "object" && !Array.isArray(value)
        && exact(value, ["round", "activeEntryId", "active"])
        && Number.isSafeInteger(value.round) && value.round >= 0 && value.round <= 100_000
        && (value.activeEntryId === null || boundedText(value.activeEntryId, 80))
        && typeof value.active === "boolean"
        && (value.active ? value.round >= 1 && value.activeEntryId !== null : value.round === 0 && value.activeEntryId === null);
}

function deriveTurn(entries, current = { round: 0, activeEntryId: null, active: false }) {
    if (!current.active || entries.length === 0) return { round: 0, activeEntryId: null, active: false };
    const currentEntry = current.activeEntryId ? entries.find((entry) => entry.id === current.activeEntryId) : null;
    const selected = currentEntry ?? entries.find((entry) => entry.active) ?? entries[0];
    return { round: current.round >= 1 ? current.round : 1, activeEntryId: selected.id, active: true };
}

function entriesForTurn(entries, activeEntryId) {
    return entries.map((entry) => ({ ...entry, active: entry.id === activeEntryId }));
}

function characterRecordValid(value) {
    return value && typeof value === "object" && !Array.isArray(value)
        && boundedText(value.characterId, 80) && boundedText(value.name, 80)
        && typeof value.summary === "string" && value.summary.length <= 1_000
        && Number.isSafeInteger(value.hp) && value.hp >= 0 && value.hp <= 1000
        && Number.isSafeInteger(value.initiative) && value.initiative >= -100 && value.initiative <= 100
        && boundedText(value.owner, 128);
}

function privateNoteValid(value) {
    return value && typeof value === "object" && !Array.isArray(value)
        && boundedText(value.text, 2_000) && Number.isSafeInteger(value.createdAt) && value.createdAt >= 0;
}

function eventRecordValid(value, campaignId, expectedRevision) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const keys = new Set(["eventId", "campaignId", "revision", "actor", "type", "publicPayload", "privatePayload", "createdAt"]);
    if (Object.keys(value).some((key) => !keys.has(key))) return false;
    if (!boundedText(value.eventId, 128)
        || value.campaignId !== campaignId
        || value.revision !== expectedRevision
        || !boundedText(value.actor, 128)
        || !EVENT_TYPES.has(value.type)
        || !Number.isSafeInteger(value.createdAt) || value.createdAt < 0) return false;
    if (value.type === "scene.update") {
        if (!value.publicPayload || !boundedText(value.publicPayload.title, 160)
            || !boundedText(value.publicPayload.description, 2_000)) return false;
    } else if (value.type === "action.append") {
        if (!value.publicPayload || !actionRecordValid(value.publicPayload.action)) return false;
    } else if (value.type === "action.resolve") {
        if (!value.publicPayload || !exact(value.publicPayload, ["actionId", "dmReply"])
            || !/^action-[A-Za-z0-9-]{8,72}$/.test(value.publicPayload.actionId)
            || !dmReplyValid(value.publicPayload.dmReply)) return false;
    } else if (value.type === "action.check") {
        if (!value.publicPayload || !exact(value.publicPayload, ["actionId", "resolution"])
            || !/^action-[A-Za-z0-9-]{8,72}$/.test(value.publicPayload.actionId)
            || !d20ResolutionValid(value.publicPayload.resolution)) return false;
    } else if (value.type === "initiative.set") {
        if (!value.publicPayload || !exact(value.publicPayload, ["entries", "turn"])
            || !Array.isArray(value.publicPayload.entries)
            || value.publicPayload.entries.length > 100
            || !value.publicPayload.entries.every(initiativeRecordValid)
            || !turnRecordValid(value.publicPayload.turn)) return false;
    } else if (value.type === "initiative.start" || value.type === "initiative.advance" || value.type === "initiative.end") {
        if (!value.publicPayload || !exact(value.publicPayload, ["entries", "turn"])
            || !Array.isArray(value.publicPayload.entries)
            || value.publicPayload.entries.length > 100
            || !value.publicPayload.entries.every(initiativeRecordValid)
            || !turnRecordValid(value.publicPayload.turn)) return false;
    } else if (value.type === "character.upsert") {
        if (!value.publicPayload || !characterRecordValid(value.publicPayload.character)
            || !value.privatePayload || !boundedText(value.privatePayload.owner, 128)) return false;
    } else if (value.type === "gm.note") {
        if (value.publicPayload !== undefined
            || !value.privatePayload || !privateNoteValid({ ...value.privatePayload, createdAt: value.createdAt })) return false;
    }
    return true;
}

function campaignRecordValid(candidate) {
    const memberSubjects = new Set();
    const actionIds = new Set();
    const initiativeIds = new Set();
    const characterIds = new Set();
    const eventIds = new Set();
    const idempotencyKeys = new Set();
    const valid = candidate && candidate.schemaVersion === CAMPAIGN_SCHEMA
        && validCampaignId(candidate.campaignId)
        && typeof candidate.title === "string" && candidate.title.length >= 3 && candidate.title.length <= 120
        && typeof candidate.ownerId === "string" && candidate.ownerId.length >= 1 && candidate.ownerId.length <= 128
        && Array.isArray(candidate.members) && candidate.members.length >= 1 && candidate.members.length <= 200
        && candidate.members.every((member) => member && typeof member.subject === "string"
            && typeof member.displayName === "string" && ROLE_ORDER.has(member.role)
            && Number.isSafeInteger(member.joinedAt) && member.joinedAt >= 0
            && (!member.revokedAt || Number.isSafeInteger(member.revokedAt)))
        && candidate.members.some((member) => member.subject === candidate.ownerId && member.role === "owner" && !member.revokedAt)
        && candidate.scene && typeof candidate.scene.title === "string" && candidate.scene.title.length <= 160
        && typeof candidate.scene.description === "string" && candidate.scene.description.length <= 2_000
        && candidate.scene.background === SHARED_TABLE_BACKGROUND
        && Array.isArray(candidate.actions) && candidate.actions.length <= MAX_ACTIONS
        && candidate.actions.every((action) => actionRecordValid(action) && !actionIds.has(action.id) && actionIds.add(action.id))
        && Array.isArray(candidate.initiative) && candidate.initiative.length <= 100
        && candidate.initiative.every((entry) => initiativeRecordValid(entry) && !initiativeIds.has(entry.id) && initiativeIds.add(entry.id))
        && turnRecordValid(candidate.turn)
        && (candidate.turn.activeEntryId === null || candidate.initiative.some((entry) => entry.id === candidate.turn.activeEntryId))
        && (!candidate.turn.active || candidate.initiative.filter((entry) => entry.active).length === 1)
        && Array.isArray(candidate.characters) && candidate.characters.length <= 200
        && candidate.characters.every((character) => characterRecordValid(character)
            && !characterIds.has(`${character.owner}:${character.characterId}`)
            && characterIds.add(`${character.owner}:${character.characterId}`))
        && Array.isArray(candidate.privateNotes) && candidate.privateNotes.length <= 200
        && candidate.privateNotes.every(privateNoteValid)
        && Array.isArray(candidate.events) && candidate.events.length <= MAX_EVENTS
        && candidate.events.length === candidate.revision
        && candidate.events.every((event, index) => eventRecordValid(event, candidate.campaignId, index + 1)
            && !eventIds.has(event.eventId) && eventIds.add(event.eventId))
        && Number.isSafeInteger(candidate.revision) && candidate.revision >= 0
        && Number.isSafeInteger(candidate.updatedAt) && candidate.updatedAt >= 0
        && Array.isArray(candidate.invites) && candidate.invites.length <= 200
        && candidate.invites.every((invite) => invite && /^[a-f0-9]{64}$/.test(invite.tokenHash)
            && (invite.role === "player" || invite.role === "viewer") && Number.isSafeInteger(invite.expiresAt)
            && Number.isSafeInteger(invite.uses) && invite.uses >= 0 && Number.isSafeInteger(invite.maxUses)
            && invite.maxUses >= 1 && invite.uses <= invite.maxUses)
        && Array.isArray(candidate.idempotency) && candidate.idempotency.length <= MAX_EVENTS
        && candidate.idempotency.every((entry) => entry && boundedText(entry.subject, 128)
            && boundedText(entry.key, 128) && /^[a-f0-9]{64}$/.test(entry.requestHash)
            && boundedText(entry.eventId, 128) && eventIds.has(entry.eventId)
            && !idempotencyKeys.has(`${entry.subject}:${entry.key}`)
            && idempotencyKeys.add(`${entry.subject}:${entry.key}`));
    if (!valid) return false;
    for (const event of candidate.events) {
        if ((event.type === "action.resolve" || event.type === "action.check")
            && !actionIds.has(event.publicPayload.actionId)) return false;
    }
    for (const member of candidate.members) {
        if (!boundedText(member.subject, 128) || !boundedText(member.displayName, 64) || memberSubjects.has(member.subject)) return false;
        memberSubjects.add(member.subject);
    }
    return true;
}

function storeFileValid(candidate) {
    return candidate && candidate.schemaVersion === CAMPAIGN_SCHEMA
        && Array.isArray(candidate.campaigns) && candidate.campaigns.length <= MAX_CAMPAIGNS
        && candidate.campaigns.every(campaignRecordValid);
}

function publicCharacter(character) {
    return {
        characterId: character.characterId,
        name: character.name,
        summary: character.summary,
        hp: character.hp,
        initiative: character.initiative,
    };
}

function projection(campaign, member, includePrivate = false) {
    const result = {
        schemaVersion: CAMPAIGN_SCHEMA,
        campaignId: campaign.campaignId,
        title: campaign.title,
        revision: campaign.revision,
        updatedAt: campaign.updatedAt,
        role: member.role,
        scene: clone(campaign.scene),
        actions: clone(campaign.actions),
        initiative: clone(campaign.initiative),
        turn: clone(campaign.turn),
        characters: campaign.characters.map(publicCharacter),
    };
    if (includePrivate) {
        result.members = campaign.members
            .filter((candidate) => !candidate.revokedAt)
            .map(({ displayName, role, joinedAt }) => ({ displayName, role, joinedAt }));
        result.privateNotes = clone(campaign.privateNotes);
    }
    return result;
}

function publicEvent(event, includePrivate) {
    const result = {
        eventId: event.eventId,
        campaignId: event.campaignId,
        revision: event.revision,
        type: event.type,
        createdAt: event.createdAt,
        payload: clone(event.publicPayload),
    };
    if (includePrivate && event.privatePayload !== undefined) result.privatePayload = clone(event.privatePayload);
    return result;
}

export class CampaignStore {
    constructor({ filePath, clock = () => Date.now(), tokenBytes = () => randomBytes(32) } = {}) {
        this.filePath = filePath ? resolve(filePath) : undefined;
        this.clock = clock;
        this.tokenBytes = tokenBytes;
        this.campaigns = new Map();
        this.locks = new Map();
    }

    async init() {
        if (!this.filePath || !existsSync(this.filePath)) return;
        let parsed;
        try {
            parsed = JSON.parse(await readFile(this.filePath, "utf8"));
        } catch {
            fail(503, "campaign_storage_corrupt", "Campaign storage is damaged and was not overwritten.");
        }
        if (!storeFileValid(parsed)) fail(503, "campaign_storage_corrupt", "Campaign storage is damaged and was not overwritten.");
        parsed.campaigns.forEach((campaign) => this.campaigns.set(campaign.campaignId, campaign));
    }

    async persist() {
        if (!this.filePath) return;
        await mkdir(dirname(this.filePath), { recursive: true });
        const temporary = `${this.filePath}.${process.pid}.tmp`;
        await writeFile(temporary, JSON.stringify({ schemaVersion: CAMPAIGN_SCHEMA, campaigns: [...this.campaigns.values()] }, null, 2), {
            encoding: "utf8",
            mode: 0o600,
        });
        await rename(temporary, this.filePath);
    }

    async withLock(campaignId, task) {
        const previous = this.locks.get(campaignId) ?? Promise.resolve();
        const current = previous.then(task, task);
        const queued = current.catch(() => undefined);
        this.locks.set(campaignId, queued);
        try {
            return await current;
        } finally {
            if (this.locks.get(campaignId) === queued) this.locks.delete(campaignId);
        }
    }

    find(campaignId) {
        if (!validCampaignId(campaignId)) fail(404, "campaign_not_found", "Кампания не найдена.");
        const campaign = this.campaigns.get(campaignId);
        if (!campaign) fail(404, "campaign_not_found", "Кампания не найдена.");
        return campaign;
    }

    member(campaignId, subject, required = null) {
        const campaign = this.find(campaignId);
        const member = memberFor(campaign, subject);
        if (!roleCanRead(member?.role ?? null)) fail(404, "campaign_not_found", "Кампания не найдена.");
        if (required && member.role !== required) fail(403, "campaign_forbidden", "Недостаточно прав для этой кампании.");
        return { campaign, member };
    }

    async create(subject, displayName, title) {
        const cleanTitle = cleanText(title, 120);
        if (cleanTitle.length < 3) fail(400, "invalid_title", "Название кампании должно содержать минимум 3 символа.");
        if (this.campaigns.size >= MAX_CAMPAIGNS) fail(409, "campaign_limit", "Достигнут лимит кампаний.");
        const campaignId = `campaign-${this.tokenBytes(16).toString("base64url")}`;
        const now = this.clock();
        const campaign = {
            schemaVersion: CAMPAIGN_SCHEMA,
            campaignId,
            title: cleanTitle,
            ownerId: subject,
            members: [{ subject, displayName: cleanText(displayName, 64) || "Ведущий", role: "owner", joinedAt: now }],
            scene: {
                title: "Новая сцена",
                description: "Ведущий ещё не открыл сцену для игроков.",
                background: "/assets/scenes/dnd-gateway.png",
            },
            actions: [],
            initiative: [],
            turn: { round: 0, activeEntryId: null, active: false },
            characters: [],
            privateNotes: [],
            events: [],
            revision: 0,
            updatedAt: now,
            invites: [],
            idempotency: [],
        };
        this.campaigns.set(campaignId, campaign);
        await this.persist();
        return projection(campaign, campaign.members[0], true);
    }

    list(subject) {
        return [...this.campaigns.values()]
            .map((campaign) => {
                const member = memberFor(campaign, subject);
                return member ? {
                    campaignId: campaign.campaignId,
                    title: campaign.title,
                    role: member.role,
                    revision: campaign.revision,
                    updatedAt: campaign.updatedAt,
                } : null;
            })
            .filter(Boolean)
            .sort((left, right) => right.updatedAt - left.updatedAt);
    }

    get(campaignId, subject) {
        const { campaign, member } = this.member(campaignId, subject);
        return projection(campaign, member, member.role === "owner" || member.role === "co_dm");
    }

    async createInvite(campaignId, subject, role = "player", expiresInSeconds = 86_400) {
        const { campaign, member } = this.member(campaignId, subject);
        if (member.role !== "owner" && member.role !== "co_dm") fail(403, "campaign_forbidden", "Только ведущий может выдавать приглашения.");
        if (role !== "player" && role !== "viewer") fail(400, "invalid_role", "Можно пригласить только игрока или наблюдателя.");
        const expires = Math.min(Math.max(Number(expiresInSeconds) || 86_400, 300), 7 * 86_400);
        const token = `invite-${this.tokenBytes(32).toString("base64url")}`;
        campaign.invites.push({ tokenHash: hash(token), role, expiresAt: this.clock() + expires * 1000, uses: 0, maxUses: 1 });
        await this.persist();
        return { inviteToken: token, expiresAt: campaign.invites.at(-1).expiresAt, role };
    }

    async redeemInvite(subject, displayName, token) {
        if (typeof token !== "string" || token.length < 32 || token.length > 256) fail(400, "invalid_invite", "Приглашение недействительно.");
        const tokenHash = hash(token);
        const match = [...this.campaigns.values()]
            .flatMap((campaign) => campaign.invites.map((invite) => ({ campaign, invite })))
            .find(({ invite }) => sameHash(invite.tokenHash, tokenHash));
        if (!match || match.invite.revokedAt || match.invite.expiresAt <= this.clock() || match.invite.uses >= match.invite.maxUses) {
            fail(401, "invite_invalid", "Приглашение недействительно или уже использовано.");
        }
        const existing = memberFor(match.campaign, subject);
        if (!existing) {
            match.campaign.members.push({
                subject,
                displayName: cleanText(displayName, 64) || "Игрок",
                role: match.invite.role,
                joinedAt: this.clock(),
            });
        }
        match.invite.uses += 1;
        match.invite.revokedAt = this.clock();
        await this.persist();
        return projection(match.campaign, memberFor(match.campaign, subject), false);
    }

    async appendEvent({ campaignId, subject, type, payload, expectedRevision, idempotencyKey }) {
        return this.withLock(campaignId, async () => {
            const { campaign, member } = this.member(campaignId, subject);
            if (!EVENT_TYPES.has(type)) fail(400, "invalid_event_type", "Тип игрового события не разрешён.");
            if (typeof idempotencyKey !== "string" || !/^[A-Za-z0-9._:-]{8,128}$/.test(idempotencyKey)) {
                fail(400, "invalid_idempotency_key", "Нужен корректный Idempotency-Key.");
            }
            if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) {
                fail(400, "invalid_revision", "Нужна актуальная revision кампании.");
            }
            const requestHash = hash(JSON.stringify({ type, payload, expectedRevision }));
            const previous = campaign.idempotency.find((entry) => entry.subject === subject && entry.key === idempotencyKey);
            if (previous) {
                if (previous.requestHash !== requestHash) fail(409, "idempotency_conflict", "Этот Idempotency-Key уже использован для другого события.");
                const replay = campaign.events.find((event) => event.eventId === previous.eventId);
                return { replayed: true, event: publicEvent(replay, member.role !== "player"), campaign: projection(campaign, member, member.role !== "player") };
            }
            if (expectedRevision !== campaign.revision) fail(409, "stale_revision", "Состояние кампании уже изменилось. Загрузите свежую версию.");

            const clean = this.validateEvent(type, payload, member.role, subject, campaign);
            const now = this.clock();
            const event = {
                eventId: randomUUID(),
                campaignId,
                revision: campaign.revision + 1,
                actor: subject,
                type,
                publicPayload: clean.publicPayload,
                privatePayload: clean.privatePayload,
                createdAt: now,
            };
            this.applyEvent(campaign, event, clean);
            campaign.events.push(event);
            campaign.idempotency.push({ subject, key: idempotencyKey, requestHash, eventId: event.eventId });
            campaign.idempotency = campaign.idempotency.slice(-MAX_EVENTS);
            campaign.updatedAt = now;
            await this.persist();
            return { replayed: false, event: publicEvent(event, member.role !== "player"), campaign: projection(campaign, member, member.role !== "player") };
        });
    }

    validateEvent(type, payload, role, subject, campaign) {
        if (!payload || typeof payload !== "object" || Array.isArray(payload)) fail(400, "invalid_event_payload", "Некорректное игровое событие.");
        if (type === "scene.update") {
            if (!roleCanWriteGame(role) || !exact(payload, ["title", "description"])) fail(403, "campaign_forbidden", "Сцену может менять только ведущий.");
            const title = cleanText(payload.title, 160);
            const description = cleanText(payload.description, 2_000);
            if (!title || !description) fail(400, "invalid_scene", "Сцена должна содержать заголовок и описание.");
            return { publicPayload: { title, description }, privatePayload: undefined };
        }
        if (type === "action.append") {
            const hasResolution = Object.prototype.hasOwnProperty.call(payload, "resolution");
            if (!roleCanAppendAction(role) || !exact(payload, hasResolution ? ["id", "actor", "text", "diceExpression", "resolution"] : ["id", "actor", "text", "diceExpression"])) fail(403, "campaign_forbidden", "Недостаточно прав для действия игрока.");
            if (hasResolution && !roleCanWriteGame(role)) fail(403, "campaign_forbidden", "Проверку с DC может добавить только ведущий.");
            const id = cleanText(payload.id, 80);
            const actor = cleanText(payload.actor, 40);
            const text = cleanText(payload.text, 240);
            if (!/^action-[A-Za-z0-9-]{8,72}$/.test(id) || actor.length < 2 || text.length < 2) fail(400, "invalid_action", "Укажите персонажа и действие.");
            if (campaign.actions.some((action) => action.id === id)) fail(409, "action_exists", "Это действие уже существует.");
            const diceExpression = cleanText(payload.diceExpression, 16).toLowerCase();
            if (hasResolution) {
                if (diceExpression !== "d20") fail(400, "invalid_resolution", "Проверка d20 должна использовать формулу d20 без встроенного модификатора.");
                const resolution = resolveD20Check(payload.resolution);
                return {
                    publicPayload: {
                        action: { id, actor, text, dice: { expr: diceExpression, rolls: resolution.rolls, modifier: resolution.modifier, total: resolution.total }, resolution, createdAt: this.clock() },
                    },
                    privatePayload: undefined,
                };
            }
            return { publicPayload: { action: { id, actor, text, dice: validDice(payload.diceExpression), createdAt: this.clock() } }, privatePayload: undefined };
        }
        if (type === "action.resolve") {
            if (!roleCanWriteGame(role) || !exact(payload, ["actionId", "text"])) fail(403, "campaign_forbidden", "Ответ на действие может добавить только ведущий.");
            const actionId = cleanText(payload.actionId, 80);
            const text = cleanText(payload.text, 1_000);
            if (!/^action-[A-Za-z0-9-]{8,72}$/.test(actionId) || text.length < 2) fail(400, "invalid_action_resolution", "Ответ ведущего должен содержать действие и текст.");
            const action = campaign.actions.find((entry) => entry.id === actionId);
            if (!action) fail(404, "action_not_found", "Действие не найдено.");
            if (action.dmReply) fail(409, "action_already_resolved", "На это действие уже есть ответ.");
            return { publicPayload: { actionId, dmReply: { text, createdAt: this.clock() } }, privatePayload: undefined };
        }
        if (type === "action.check") {
            if (!roleCanWriteGame(role) || !exact(payload, ["actionId", "dc", "modifier", "mode"])) fail(403, "campaign_forbidden", "Проверку может провести только ведущий.");
            const actionId = cleanText(payload.actionId, 80);
            if (!/^action-[A-Za-z0-9-]{8,72}$/.test(actionId)) fail(400, "invalid_action_check", "Некорректное действие для проверки.");
            const action = campaign.actions.find((entry) => entry.id === actionId);
            if (!action) fail(404, "action_not_found", "Действие не найдено.");
            if (action.dice.expr !== "d20") fail(409, "action_not_d20", "Для этого действия нет проверки d20.");
            if (action.resolution) fail(409, "action_already_checked", "Проверка для этого действия уже проведена.");
            const resolution = resolveD20Check({ dc: payload.dc, modifier: payload.modifier, mode: payload.mode });
            return { publicPayload: { actionId, resolution }, privatePayload: undefined };
        }
        if (type === "initiative.set") {
            if (!roleCanWriteGame(role) || !Array.isArray(payload.entries) || payload.entries.length > 100) fail(403, "campaign_forbidden", "Инициативу может менять только ведущий.");
            const entries = payload.entries.map((entry) => {
                if (!entry || !exact(entry, ["id", "name", "value", "active"]) || typeof entry.id !== "string"
                    || typeof entry.name !== "string" || !Number.isSafeInteger(entry.value) || typeof entry.active !== "boolean") {
                    fail(400, "invalid_initiative", "Некорректная шкала инициативы.");
                }
                const id = cleanText(entry.id, 80);
                const name = cleanText(entry.name, 80);
                if (!/^initiative-[A-Za-z0-9-]{8,72}$/.test(id) || !name) fail(400, "invalid_initiative", "Укажите уникальный id и имя участника.");
                return { id, name, value: Math.max(-100, Math.min(100, entry.value)), active: entry.active };
            });
            const turn = deriveTurn(entries, campaign.turn);
            return { publicPayload: { entries: entriesForTurn(entries, turn.activeEntryId), turn }, privatePayload: undefined };
        }
        if (type === "initiative.start") {
            if (!roleCanWriteGame(role) || !exact(payload, [])) fail(403, "campaign_forbidden", "Бой может начать только ведущий.");
            if (campaign.initiative.length === 0) fail(409, "initiative_empty", "Добавьте участников инициативы перед началом боя.");
            const turn = { round: 1, activeEntryId: (campaign.initiative.find((entry) => entry.active) ?? campaign.initiative[0]).id, active: true };
            return { publicPayload: { entries: entriesForTurn(campaign.initiative, turn.activeEntryId), turn }, privatePayload: undefined };
        }
        if (type === "initiative.advance") {
            if (!roleCanWriteGame(role) || !exact(payload, [])) fail(403, "campaign_forbidden", "Ход может менять только ведущий.");
            if (!campaign.turn.active || campaign.initiative.length === 0) fail(409, "combat_not_active", "Сначала сохраните инициативу и начните бой.");
            const currentIndex = campaign.initiative.findIndex((entry) => entry.id === campaign.turn.activeEntryId);
            if (currentIndex < 0) fail(409, "turn_state_invalid", "Текущий участник хода не найден.");
            const nextIndex = (currentIndex + 1) % campaign.initiative.length;
            const round = nextIndex === 0 ? campaign.turn.round + 1 : campaign.turn.round;
            const activeEntryId = campaign.initiative[nextIndex].id;
            const turn = { round, activeEntryId, active: true };
            return { publicPayload: { entries: entriesForTurn(campaign.initiative, activeEntryId), turn }, privatePayload: undefined };
        }
        if (type === "initiative.end") {
            if (!roleCanWriteGame(role) || !exact(payload, [])) fail(403, "campaign_forbidden", "Бой может завершить только ведущий.");
            const turn = { round: 0, activeEntryId: null, active: false };
            return { publicPayload: { entries: entriesForTurn(campaign.initiative, null), turn }, privatePayload: undefined };
        }
        if (type === "character.upsert") {
            if (role !== "player" || !exact(payload, ["characterId", "name", "summary", "hp", "initiative"])) fail(403, "campaign_forbidden", "Персонажа может менять только игрок.");
            const characterId = cleanText(payload.characterId, 80);
            const name = cleanText(payload.name, 80);
            const summary = cleanText(payload.summary, 1_000);
            if (!characterId || !name || !Number.isSafeInteger(payload.hp) || !Number.isSafeInteger(payload.initiative)) fail(400, "invalid_character", "Некорректный лист персонажа.");
            return { publicPayload: { character: { characterId, name, summary, hp: Math.max(0, Math.min(1000, payload.hp)), initiative: Math.max(-100, Math.min(100, payload.initiative)), owner: subject } }, privatePayload: { owner: subject } };
        }
        if (type === "gm.note") {
            if (!roleCanWriteGame(role) || !exact(payload, ["text"])) fail(403, "campaign_forbidden", "Заметку мастера может менять только ведущий.");
            const text = cleanText(payload.text, 2_000);
            if (!text) fail(400, "invalid_note", "Заметка не может быть пустой.");
            return { publicPayload: undefined, privatePayload: { text } };
        }
        fail(400, "invalid_event_type", "Тип игрового события не разрешён.");
    }

    applyEvent(campaign, event, clean) {
        campaign.revision = event.revision;
        if (event.type === "scene.update") campaign.scene = { ...campaign.scene, ...clean.publicPayload };
        if (event.type === "action.append") {
            campaign.actions = [...campaign.actions, clean.publicPayload.action].slice(-MAX_ACTIONS);
        }
        if (event.type === "action.resolve") {
            const action = campaign.actions.find((entry) => entry.id === clean.publicPayload.actionId);
            if (action) action.dmReply = clean.publicPayload.dmReply;
        }
        if (event.type === "action.check") {
            const action = campaign.actions.find((entry) => entry.id === clean.publicPayload.actionId);
            if (action) {
                action.resolution = clean.publicPayload.resolution;
                action.dice = {
                    expr: "d20",
                    rolls: clean.publicPayload.resolution.rolls,
                    modifier: clean.publicPayload.resolution.modifier,
                    total: clean.publicPayload.resolution.total,
                };
            }
        }
        if (event.type === "initiative.set" || event.type === "initiative.start" || event.type === "initiative.advance" || event.type === "initiative.end") {
            campaign.initiative = clean.publicPayload.entries;
            campaign.turn = clean.publicPayload.turn;
        }
        if (event.type === "character.upsert") {
            const character = clean.publicPayload.character;
            const previous = campaign.characters.findIndex((entry) => entry.characterId === character.characterId && entry.owner === character.owner);
            if (previous >= 0) campaign.characters[previous] = character;
            else campaign.characters.push(character);
        }
        if (event.type === "gm.note") campaign.privateNotes = [...campaign.privateNotes, { ...clean.privatePayload, createdAt: event.createdAt }].slice(-200);
    }

    events(campaignId, subject, afterRevision = 0) {
        const { campaign, member } = this.member(campaignId, subject);
        if (!Number.isSafeInteger(afterRevision) || afterRevision < 0) fail(400, "invalid_revision", "Некорректный cursor.");
        if (afterRevision > campaign.revision) fail(409, "future_revision", "Cursor новее состояния кампании.");
        const visible = campaign.events
            .filter((event) => event.revision > afterRevision)
            .map((event) => publicEvent(event, member.role !== "player"));
        return { campaignId, afterRevision, revision: campaign.revision, events: visible, snapshot: projection(campaign, member, member.role !== "player") };
    }

    backup(campaignId, subject) {
        const { campaign, member } = this.member(campaignId, subject);
        if (member.role !== "owner") fail(403, "campaign_forbidden", "Только владелец может делать backup.");
        const payload = {
            schemaVersion: CAMPAIGN_BACKUP_SCHEMA,
            sourceCampaignId: campaign.campaignId,
            exportedAt: this.clock(),
            campaign: clone({ ...campaign, invites: [], idempotency: [] }),
        };
        const checksum = hash(JSON.stringify(payload));
        return { ...payload, checksum };
    }

    async restore(subject, displayName, backup) {
        if (!backup || backup.schemaVersion !== CAMPAIGN_BACKUP_SCHEMA || typeof backup.checksum !== "string" || !backup.campaign) {
            fail(400, "invalid_backup", "Backup кампании имеет неверный формат.");
        }
        const payload = { schemaVersion: backup.schemaVersion, sourceCampaignId: backup.sourceCampaignId, exportedAt: backup.exportedAt, campaign: backup.campaign };
        if (hash(JSON.stringify(payload)) !== backup.checksum || !campaignRecordValid(backup.campaign)) fail(400, "invalid_backup", "Backup повреждён или не прошёл проверку.");
        const source = clone(backup.campaign);
        const now = this.clock();
        const campaignId = `campaign-${this.tokenBytes(16).toString("base64url")}`;
        const restored = {
            ...source,
            campaignId,
            ownerId: subject,
            title: `${cleanText(source.title, 112)} — копия`,
            members: [{ subject, displayName: cleanText(displayName, 64) || "Ведущий", role: "owner", joinedAt: now }],
            invites: [],
            idempotency: [],
            events: [],
            revision: 0,
            updatedAt: now,
        };
        restored.characters = restored.characters.map(({ owner: _owner, ...character }) => character);
        this.campaigns.set(campaignId, restored);
        await this.persist();
        return projection(restored, restored.members[0], true);
    }
}

export async function createCampaignStore(options = {}) {
    const store = new CampaignStore(options);
    await store.init();
    return store;
}
