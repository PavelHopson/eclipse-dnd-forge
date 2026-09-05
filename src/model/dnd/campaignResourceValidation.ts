function record(value: unknown): value is Record<string, any> {
    return !!value && typeof value === "object" && !Array.isArray(value);
}
const finite = (value: unknown) => typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= 1e12;
const timestamp = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 8.64e15;
const text = (value: unknown, max = 10000) => typeof value === "string" && value.length <= max;

export function readWorldEventState(raw: string) {
    const value = JSON.parse(raw);
    if (!record(value) || !Array.isArray(value.events) || value.events.length > 200 ||
        !Array.isArray(value.insertedIds) || value.insertedIds.length > 10000 || !value.insertedIds.every((id: unknown) => text(id, 180)) ||
        !timestamp(value.lastDmAcknowledgedAt) || !timestamp(value.lastAutoTickAt) ||
        !["off", "5min", "15min", "1h", "4h"].includes(value.autoTickInterval)) throw new Error("Журнал мира повреждён.");
    for (const event of value.events) {
        if (!record(event) || !text(event.id, 180) || !text(event.tickId, 180) || !text(event.entityId, 180) ||
            !text(event.entityName, 500) || !text(event.action, 100000) || !timestamp(event.createdAt) ||
            (event.consequence !== undefined && !text(event.consequence, 100000)) ||
            (event.raw !== undefined && !text(event.raw, 100000))) throw new Error("Журнал мира повреждён.");
    }
    return value;
}
export function readInitiativeState(raw: string) {
    const value = JSON.parse(raw);
    if (!record(value) || !Array.isArray(value.entries) || value.entries.length > 2000 ||
        !Number.isSafeInteger(value.activeIndex) || value.activeIndex < 0 || value.activeIndex >= Math.max(1, value.entries.length) ||
        !Number.isSafeInteger(value.round) || value.round < 0 || typeof value.active !== "boolean") throw new Error("Трекер боя повреждён.");
    const ids = new Set();
    for (const entry of value.entries) {
        if (!record(entry) || !text(entry.id, 180) || ids.has(entry.id) || !text(entry.name, 500) || !finite(entry.initiative) ||
            (entry.entityId !== undefined && !text(entry.entityId, 180)) ||
            (entry.hp !== undefined && !finite(entry.hp)) || (entry.notes !== undefined && !text(entry.notes))) throw new Error("Трекер боя повреждён.");
        ids.add(entry.id);
    }
    return value;
}
