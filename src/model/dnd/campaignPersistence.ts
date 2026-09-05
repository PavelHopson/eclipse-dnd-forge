import { useModelStore } from "../Model";
import { useHistoryModelStore } from "../HistoryModel";
import { globalEditor } from "../../view/TextEditor";
import { VisualRefresher } from "../prompts/textExtractors/VisualRefresher";
import { useAiConfigStore } from "../../store/useAiConfigStore";
import { captureCampaignWorld } from "./campaignDocument";
import { campaignRepository } from "./campaignStorage";

let started = false;
let pending = false;
let timer: ReturnType<typeof setTimeout> | undefined;

export function flushCampaign(force = false): boolean {
    if (force) pending = true;
    if (timer) clearTimeout(timer);
    timer = undefined;
    if (!pending) return campaignRepository().getStatus().state !== "error";
    try {
        const saved = campaignRepository().saveWorld(captureCampaignWorld(useModelStore.getState()));
        if (saved) pending = false;
        return saved;
    } catch (error) { campaignRepository().reportError(error); return false; }
}

/** Called by the free-form loader before mounting Slate. Never used by study routes. */
export function restoreCampaignWorkspace() {
    if (started) return;
    const repository = campaignRepository();
    const doc = repository.getActive();
    if (!doc) throw new Error("Сначала выберите кампанию.");
    const world = captureCampaignWorld(doc.world);
    const model = useModelStore.getState();
    model.reset();
    useHistoryModelStore.getState().reset();
    model.setOpenAIKey(useAiConfigStore.getState().openaiApiKey);
    model.setEntityNodes(world.entityNodes);
    model.setLocationNodes(world.locationNodes);
    model.setTextState(world.textState, false, false);
    model.setActionEdges(world.actionEdges);
    model.setIsStale(world.isStale);
    globalEditor.children = world.textState;
    globalEditor.selection = null;
    globalEditor.operations = [];
    useHistoryModelStore.getState().addHistoryNode(useModelStore.getState());
    VisualRefresher.getInstance().previousText = useModelStore.getState().text;
    started = true;
    useModelStore.subscribe((next, previous) => {
        if (next.textState === previous.textState && next.entityNodes === previous.entityNodes &&
            next.locationNodes === previous.locationNodes && next.actionEdges === previous.actionEdges && next.isStale === previous.isStale) return;
        pending = true; repository.markPending();
        if (timer) clearTimeout(timer);
        timer = setTimeout(flushCampaign, 350);
    });
    window.addEventListener("pagehide", () => { flushCampaign(); });
    window.addEventListener("beforeunload", (event) => {
        if (!flushCampaign()) { event.preventDefault(); event.returnValue = ""; }
    });
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flushCampaign(); });
    window.addEventListener("hashchange", () => {
        if (window.location.hash.startsWith("#/free-form")) return;
        if (!flushCampaign()) { window.location.hash = "/free-form"; return; }
        // Native Back must also tear down old agents/stores before the launcher can create a new world.
        window.location.reload();
    });
}
