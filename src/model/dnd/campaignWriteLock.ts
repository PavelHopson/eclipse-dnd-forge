import { campaignRepository } from "./campaignStorage";

let heldFor: string | null = null;
/** Browser-owned lifetime lock: released automatically when this document unloads. */
export async function acquireCampaignWriteLock() {
    const repository = campaignRepository();
    const id = repository.getActive()?.id;
    if (!id) throw new Error("Кампания не выбрана.");
    if (heldFor === id) return;
    if (!navigator.locks) throw new Error("Этот браузер не поддерживает безопасное редактирование кампании.");
    const granted = await new Promise<boolean>((resolve) => {
        void navigator.locks.request(`eclivarium-campaign-writer:${id}`, { mode: "exclusive", ifAvailable: true }, async (lock) => {
            resolve(!!lock);
            if (lock) await new Promise<void>(() => { /* lifetime ownership; browser releases on unload */ });
        }).catch(() => resolve(false));
    });
    if (!granted) throw new Error("Кампания уже редактируется в другой вкладке. Закройте её перед открытием здесь.");
    heldFor = id;
    repository.grantWriterLock(id);
}
