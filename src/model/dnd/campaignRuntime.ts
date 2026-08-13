import { useModelStore } from "../Model";
import type { CampaignTemplate } from "./campaignTemplates";
import { CreateEntityNode } from "../../view/entityActionView/EntityNodeComponent";
import { CreateLocatioNode } from "../../view/locationView/LocationNodeComponent";
import { VisualRefresher } from "../prompts/textExtractors/VisualRefresher";
import { useStudyStore } from "../../study/StudyModel";
import { useAiConfigStore } from "../../store/useAiConfigStore";

export function startCampaignFromTemplate(template: CampaignTemplate): void {
    const model = useModelStore.getState();
    model.reset();
    useStudyStore.getState().reset();

    // The legacy OpenAI client is only loaded with the campaign workspace.
    // Sync its in-memory key here instead of pulling the SDK into the launcher.
    model.setOpenAIKey(useAiConfigStore.getState().openaiApiKey);

    const text = template.text;
    model.setTextState([{ children: [{ text }] }], true, false);
    model.setIsStale(false);

    const entityNodes = template.seed.entities.map((entity, index) => CreateEntityNode(entity, index));
    const locationNodes = template.seed.locations.map((location, index) => CreateLocatioNode(location, index));
    model.setEntityNodes(entityNodes);
    model.setLocationNodes(locationNodes);
    model.setActionEdges([]);

    const refresher = VisualRefresher.getInstance();
    refresher.previousText = useModelStore.getState().text;
    refresher.onUpdate();
}