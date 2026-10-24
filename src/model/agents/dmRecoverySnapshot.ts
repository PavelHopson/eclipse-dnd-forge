import type { AgentMessage } from "./NpcAgent";

const KEY = "eclivarium_dm_recovery_v1:";
const LIMIT = 1024 * 1024;
type Snapshot = { draft: string; history: AgentMessage[] };
type StoragePort = Pick<Storage, "getItem" | "setItem" | "removeItem">;
function key(id: string) {
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id)) throw new Error("Invalid campaign");
    return KEY + id;
}
export function readDmRecovery(storage: StoragePort, id: string): Snapshot | null {
    const raw = storage.getItem(key(id));
    if (!raw) return null;
    if (raw.length > LIMIT) throw new Error("Recovery snapshot too large");
    const value = JSON.parse(raw);
    if (typeof value.draft !== "string" || !Array.isArray(value.history) ||
        !value.history.every((m: AgentMessage) => m && ["user", "assistant"].includes(m.role) && typeof m.content === "string" && Number.isFinite(m.createdAt))) {
        throw new Error("Invalid recovery snapshot");
    }
    return { draft: value.draft, history: value.history };
}
export function saveDmRecovery(storage: StoragePort, id: string, snapshot: Snapshot) {
    const raw = JSON.stringify(snapshot);
    if (raw.length > LIMIT) throw new Error("Recovery snapshot too large");
    storage.setItem(key(id), raw);
    if (storage.getItem(key(id)) !== raw) throw new Error("Recovery snapshot not saved");
}
export function clearDmRecovery(storage: StoragePort, id: string) { storage.removeItem(key(id)); }
