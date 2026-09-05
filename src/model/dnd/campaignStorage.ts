import { CAMPAIGN_SCHEMA, RESOURCE_KEYS, emptyCampaignWorld, isCampaignId, isResourceKey, readCampaignDocument, type CampaignDocument, type CampaignWorld } from "./campaignDocument.ts";

export const CAMPAIGN_PREFIX = "eclivarium_campaign_v1:";
export const ACTIVE_CAMPAIGN_KEY = "eclivarium_active_campaign_v1";
export interface CampaignStoragePort {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    readonly length: number;
    key(index: number): string | null;
}
type Status = { name: string; state: "saved" | "pending" | "error"; error: string | null };

/** One atomic storage write per document. A tab may only write the revision it loaded. */
export class CampaignRepository {
    private document: CampaignDocument | null = null;
    private expectedRaw: string | null = null;
    private blocked = new Set<string>();
    private dirty = false;
    private writerRequired = false;
    private writerId: string | null = null;
    private listeners = new Set<() => void>();
    private status: Status = { name: "Кампания", state: "saved", error: null };
    private storage: CampaignStoragePort;
    private tab: Pick<CampaignStoragePort, "getItem" | "setItem">;
    constructor(storage: CampaignStoragePort, tab: Pick<CampaignStoragePort, "getItem" | "setItem">) {
        this.storage = storage; this.tab = tab;
    }

    subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
    getStatus = () => this.status;
    requireWriterLock() { this.writerRequired = true; }
    grantWriterLock(id: string) { this.writerId = id; }
    private notify(error: string | null = this.status.error) {
        if (!error && this.blocked.size) error = "Часть сохранённых данных повреждена. Исходник оставлен без изменений; скачайте резервную копию для восстановления.";
        this.status = { name: this.document?.name ?? "Кампания", state: error ? "error" : this.dirty ? "pending" : "saved", error };
        this.listeners.forEach((listener) => listener());
    }
    reportError(error: unknown) {
        this.notify(error instanceof Error ? error.message : "Не удалось сохранить кампанию. Скачайте резервную копию.");
    }
    markPending() { this.dirty = true; this.notify(); }
    getActive(): CampaignDocument | null {
        if (this.document) return this.document;
        const id = this.tab.getItem(ACTIVE_CAMPAIGN_KEY) ?? this.storage.getItem(ACTIVE_CAMPAIGN_KEY);
        if (!id) return null;
        if (!isCampaignId(id)) throw new Error("Некорректная ссылка на кампанию. Выберите сохранённый мир в списке.");
        this.load(id);
        return this.document;
    }
    private load(id: string) {
        const raw = this.storage.getItem(CAMPAIGN_PREFIX + id);
        if (!raw) throw new Error("Сохранённая кампания не найдена. Исходные данные не перезаписаны.");
        const document = readCampaignDocument(raw);
        if (document.id !== id) throw new Error("Идентификатор сохранённой кампании не совпадает.");
        this.document = document; this.expectedRaw = raw; this.blocked.clear(); this.dirty = false; this.notify(null);
    }
    list(): Array<{ id: string; name: string; updatedAt: number; damaged: boolean }> {
        const result = [];
        for (let i = 0; i < this.storage.length; i++) {
            const key = this.storage.key(i);
            if (!key?.startsWith(CAMPAIGN_PREFIX)) continue;
            const id = key.slice(CAMPAIGN_PREFIX.length);
            if (!isCampaignId(id)) continue;
            try {
                const doc = readCampaignDocument(this.storage.getItem(key)!);
                result.push({ id, name: doc.name, updatedAt: doc.updatedAt, damaged: false });
            } catch { result.push({ id, name: "Повреждённая кампания — исходник сохранён", updatedAt: 0, damaged: true }); }
        }
        return result.sort((a, b) => b.updatedAt - a.updatedAt);
    }
    create(name: string, world: CampaignWorld, resources: Record<string, string> = {}, id = `campaign-${crypto.randomUUID()}`): string {
        if (this.list().length >= 50) throw new Error("Достигнут лимит 50 кампаний в этом браузере. Сохранённые миры не удалены.");
        const doc = readCampaignDocument(JSON.stringify({ schemaVersion: CAMPAIGN_SCHEMA, id, name, revision: 0, updatedAt: Date.now(), world, resources }));
        if (this.storage.getItem(CAMPAIGN_PREFIX + id) !== null) throw new Error("Кампания с таким идентификатором уже существует.");
        this.write(CAMPAIGN_PREFIX + id, JSON.stringify(doc));
        return id;
    }
    activate(id: string) {
        // Validate before changing either pointer. Reload the workspace immediately after activation.
        const raw = this.storage.getItem(CAMPAIGN_PREFIX + id);
        if (!isCampaignId(id) || !raw || readCampaignDocument(raw).id !== id) throw new Error("Не удалось открыть кампанию.");
        this.tab.setItem(ACTIVE_CAMPAIGN_KEY, id);
        try { this.storage.setItem(ACTIVE_CAMPAIGN_KEY, id); } catch { /* tab pointer remains durable for reload */ }
        this.load(id);
    }
    migrateLegacy(): void {
        if (this.storage.getItem(CAMPAIGN_PREFIX + "legacy") !== null) return;
        const resources: Record<string, string> = {};
        for (const key of RESOURCE_KEYS) { const raw = this.storage.getItem(key); if (raw !== null) resources[key] = raw; }
        if (Object.keys(resources).length) this.create("Прежние локальные данные", emptyCampaignWorld(), resources, "legacy");
        // Original keys are deliberately retained, including malformed data. Never infer their campaign.
    }
    prepare(): void {
        // A failed legacy copy must not prevent reopening an already saved world.
        if (this.getActive()) return;
        this.migrateLegacy();
        if (!this.getActive()) {
            const legacy = this.storage.getItem(CAMPAIGN_PREFIX + "legacy");
            this.activate(legacy ? "legacy" : this.create("Моя кампания", emptyCampaignWorld()));
        }
    }
    private write(key: string, value: string) {
        try { this.storage.setItem(key, value); }
        catch { throw new Error("Не удалось записать данные в браузер. Текущий текст сохранён в памяти; скачайте резервную копию и освободите место."); }
    }
    private commit(next: CampaignDocument) {
        const doc = this.getActive();
        if (!doc || doc.id !== next.id) throw new Error("Кампания ещё не открыта.");
        if (this.writerRequired && this.writerId !== doc.id) throw new Error("Эта вкладка не владеет правом записи кампании. Откройте мир заново.");
        if (this.storage.getItem(CAMPAIGN_PREFIX + doc.id) !== this.expectedRaw) {
            throw new Error("Эта кампания изменена в другой вкладке. Скачайте свою копию перед перезагрузкой; чужие изменения не перезаписаны.");
        }
        const validated = readCampaignDocument(JSON.stringify({ ...next, revision: doc.revision + 1, updatedAt: Date.now() }));
        const raw = JSON.stringify(validated);
        this.write(CAMPAIGN_PREFIX + doc.id, raw);
        this.document = validated; this.expectedRaw = raw; this.notify(null);
    }
    saveWorld(world: CampaignWorld): boolean {
        try {
            const doc = this.getActive(); if (!doc) throw new Error("Сначала откройте кампанию.");
            this.commit({ ...doc, world }); this.dirty = false; this.notify(null); return true;
        } catch (error) { this.dirty = true; this.reportError(error); return false; }
    }
    readResource(key: string): string | null {
        if (!isResourceKey(key)) throw new Error("Неизвестный ресурс кампании.");
        return this.getActive()?.resources[key] ?? null;
    }
    blockResource(key: string) {
        this.blocked.add(key);
        this.reportError(new Error("Часть сохранённых данных повреждена. Исходник оставлен без изменений; скачайте резервную копию для восстановления."));
    }
    writeResource(key: string, value: string) {
        try {
            if (!isResourceKey(key) || this.blocked.has(key)) throw new Error("Этот ресурс нельзя перезаписать: сначала восстановите его из резервной копии.");
            const doc = this.getActive(); if (!doc) throw new Error("Сначала откройте кампанию.");
            this.commit({ ...doc, resources: { ...doc.resources, [key]: value } });
        } catch (error) { this.reportError(error); throw error; }
    }
    exportRaw(world?: CampaignWorld): string {
        const doc = this.getActive(); if (!doc) throw new Error("Нет открытой кампании.");
        return JSON.stringify({ ...doc, ...(world ? { world } : {}) }, null, 2);
    }
    exportStored(id: string): string {
        if (!isCampaignId(id)) throw new Error("Неизвестная кампания.");
        const raw = this.storage.getItem(CAMPAIGN_PREFIX + id); if (!raw) throw new Error("Кампания не найдена.");
        return raw;
    }
}

let repository: CampaignRepository | undefined;
export function campaignRepository(): CampaignRepository {
    if (!repository) {
        repository = new CampaignRepository(localStorage, sessionStorage);
        repository.requireWriterLock();
    }
    return repository;
}
export const campaignResourceStorage = {
    getItem: (key: string) => campaignRepository().readResource(key),
    setItem: (key: string, value: string) => campaignRepository().writeResource(key, value),
};
