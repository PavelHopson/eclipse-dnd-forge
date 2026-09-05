import { Button } from "@nextui-org/react";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { campaignRepository } from "../../model/dnd/campaignStorage";
import { MAX_CAMPAIGN_BYTES } from "../../model/dnd/campaignDocument";
import { downloadCampaignFile } from "./campaignDownload";
import "./CampaignLibrary.css";

export default function CampaignLibraryPanel() {
    const [campaigns, setCampaigns] = useState<ReturnType<ReturnType<typeof campaignRepository>["list"]>>([]);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(true);
    const [notice, setNotice] = useState("");
    const input = useRef<HTMLInputElement>(null);
    useEffect(() => {
        try {
            const repo = campaignRepository();
            try { repo.migrateLegacy(); }
            catch (reason) { setError(reason instanceof Error ? reason.message : "Прежние данные не перенесены; исходники сохранены."); }
            setCampaigns(repo.list());
        }
        catch (reason) { setError(reason instanceof Error ? reason.message : "Локальное хранилище недоступно."); }
        finally { setBusy(false); }
    }, []);
    const open = (id: string) => {
        try {
            setBusy(true); campaignRepository().activate(id);
            window.location.hash = "/free-form"; window.location.reload();
        } catch (reason) { setError(reason instanceof Error ? reason.message : "Кампания не открыта."); setBusy(false); }
    };
    const restore = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]; event.target.value = "";
        if (!file) return;
        setBusy(true); setError(null); setNotice("");
        try {
            if (file.size > MAX_CAMPAIGN_BYTES) throw new Error("Резервная копия больше безопасного лимита 12 МБ.");
            const { readCampaignBackup } = await import("../../model/dnd/campaignBackup");
            const doc = readCampaignBackup(await file.text());
            const repo = campaignRepository();
            repo.create(`${doc.name.slice(0, 150)} (копия)`, doc.world, doc.resources);
            setCampaigns(repo.list()); setNotice("Копия восстановлена как отдельная кампания. Исходный мир не изменён.");
        } catch (reason) { setError(reason instanceof Error ? reason.message : "Не удалось проверить резервную копию."); }
        finally { setBusy(false); }
    };
    return <section className="campaign-library" aria-label="Сохранённые кампании" aria-busy={busy}>
        <div className="campaign-library__heading"><h2>Мои кампании</h2>
            <Button size="sm" variant="bordered" isDisabled={busy} onClick={() => input.current?.click()}>Восстановить из файла</Button>
            <input ref={input} type="file" accept=".json,application/json" hidden onChange={(event) => void restore(event)} aria-label="Резервная копия кампании" />
        </div>
        {busy && <p role="status">Открываем сохранённые миры…</p>}
        {error && <p role="alert">{error}</p>}
        {notice && <p role="status">{notice}</p>}
        {!busy && campaigns.length === 0 && <p>Сохранённых миров пока нет. Создайте кампанию ниже или восстановите её из файла.</p>}
        {campaigns.map((campaign) => <div className="campaign-library__row" key={campaign.id}>
            <span><strong>{campaign.name}</strong>{campaign.updatedAt > 0 && <small>{new Date(campaign.updatedAt).toLocaleString("ru-RU")}</small>}</span>
            <div className="campaign-library__actions">
                <Button size="sm" variant="bordered" isDisabled={busy} onClick={() => {
                    try { downloadCampaignFile(campaignRepository().exportStored(campaign.id), campaign.id); }
                    catch { setError("Не удалось прочитать исходный файл кампании."); }
                }}>Копия для мастера</Button>
                <Button size="sm" color="primary" isDisabled={busy || campaign.damaged} onClick={() => open(campaign.id)} aria-label={`Открыть кампанию ${campaign.name}`}>Открыть</Button>
            </div>
        </div>)}
        {campaigns.length > 0 && <small>Копия содержит весь мир и секреты мастера. Не передавайте её игрокам.</small>}
    </section>;
}
