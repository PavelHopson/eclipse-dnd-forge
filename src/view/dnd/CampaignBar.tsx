import { Button } from "@nextui-org/react";
import { useState, useSyncExternalStore } from "react";
import { campaignRepository } from "../../model/dnd/campaignStorage";
import { captureCampaignWorld } from "../../model/dnd/campaignDocument";
import { flushCampaign } from "../../model/dnd/campaignPersistence";
import { useModelStore } from "../../model/Model";
import { downloadCampaignFile } from "./campaignDownload";
import "./CampaignLibrary.css";

export default function CampaignBar() {
    const repo = campaignRepository();
    const status = useSyncExternalStore(repo.subscribe, repo.getStatus);
    const [downloadError, setDownloadError] = useState<string | null>(null);
    return <header className="campaign-bar" data-undo-scope="local" onKeyDown={(event) => event.stopPropagation()}>
        <div className="campaign-bar__identity"><strong>{status.name}</strong>
            <span role="status" aria-live="polite">{status.state === "saved" ? "Сохранено в этом браузере" : status.state === "pending" ? "Сохраняем…" : "Не сохранено"}</span>
        </div>
        <div className="campaign-library__actions">
            {status.state === "error" && <Button size="sm" variant="bordered" onClick={() => flushCampaign(true)}>Повторить сохранение</Button>}
            <Button size="sm" variant="bordered" onClick={() => {
                try {
                    const doc = repo.getActive(); if (!doc) return;
                    downloadCampaignFile(repo.exportRaw(captureCampaignWorld(useModelStore.getState())), doc.id); setDownloadError(null);
                } catch { setDownloadError("Копия не создана. Скопируйте текущий текст перед закрытием вкладки."); }
            }}>Копия для мастера</Button>
            <Button size="sm" variant="bordered" onClick={() => {
                if (!flushCampaign()) return;
                window.location.hash = "/"; window.location.reload();
            }}>Кампании</Button>
        </div>
        {(status.error || downloadError) && <p role="alert" className="campaign-bar__error">{downloadError || status.error}</p>}
    </header>;
}
