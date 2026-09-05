import { ATLAS_RESOURCE_PREFIX, readCampaignDocument } from "./campaignDocument.ts";
import { readSessionArchive } from "./sessionArchive.ts";
import { readInitiativeState, readWorldEventState } from "./campaignResourceValidation.ts";
import { readLocationMapLibrary } from "./locationMap.ts";
import { readMapStoryPinLibrary } from "./mapStoryPins.ts";
import { readReferenceBoard } from "./referenceBoard.ts";
import { readLivingAtlasDocument } from "./livingAtlas.ts";

/** Import is a new campaign, never an overwrite. Validate every nested resource before creating it. */
export function readCampaignBackup(raw: string) {
    const document = readCampaignDocument(raw);
    for (const [key, resource] of Object.entries(document.resources)) {
        JSON.parse(resource, (name, value) => {
            if (["__proto__", "constructor", "prototype"].includes(name)) throw new Error("Недопустимое поле в резервной копии.");
            return value;
        });
        if (key === "eclipse_dnd_sessions_v1") readSessionArchive(resource);
        else if (key === "eclipse_dnd_world_events_v1") readWorldEventState(resource);
        else if (key === "eclipse_dnd_initiative_v1") readInitiativeState(resource);
        else if (key === "eclipse_location_maps_v1") readLocationMapLibrary(resource);
        else if (key === "eclipse_map_story_pins_v1") readMapStoryPinLibrary(resource);
        else if (key === "eclipse_dnd_reference_board_v1") readReferenceBoard(resource);
        else if (key === "eclivarium_living_atlas_draft_v1" || key.startsWith(ATLAS_RESOURCE_PREFIX)) readLivingAtlasDocument(resource);
        else throw new Error("Неизвестный ресурс кампании.");
    }
    return document;
}
