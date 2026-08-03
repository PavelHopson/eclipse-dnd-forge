import { MarkerType } from "@xyflow/react";
import { z } from "zod";
import { CreateEntityNode } from "../../../view/entityActionView/EntityNodeComponent";
import { CreateLocatioNode } from "../../../view/locationView/LocationNodeComponent";
import { ActionEdge, EntityNode, LocationNode, useModelStore } from "../../Model";
import { PromptResult } from "../utils/BasePrompt";
import { JSONExtractorPrompt } from "./JSONExtractorPrompt";


const SCHEMA = z.object({
    actions: z.array(z.object({
        name: z.string(),
        source: z.string(),
        target: z.string(),
        location: z.string()
    }))
});

export function CreateActionEdge(action: z.infer<typeof SCHEMA>["actions"][0], passage: string, source: EntityNode, target: EntityNode): ActionEdge {
    return {
        id: "action-" + source.id + "-" + action.name + "-" + target.id,
        type: "actionEdge",
        label: action.name,
        sourceHandle: action.source === action.target ? "l" : "b",
        targetHandle: action.source === action.target ? "r" : "t",
        animated: true,
        markerEnd: { type: MarkerType.ArrowClosed, width: 25, height: 25},
        source: source.id,
        target: target.id,
        data: { name: action.name, passage: passage, sourceLocation: action.location, targetLocation: action.location }
    }
}

export function extractedActionsToEdgeActions(extractedData: z.infer<typeof SCHEMA>, passage: string, entities: EntityNode[]) : ActionEdge[] {
    const edges: ActionEdge[] = [];

        // Turn the entities into a dictionary to make it easy to fetch
        const entitiesDict: {[key: string]: EntityNode} = {};
        entities.forEach((entity) => {
            entitiesDict[entity.data.name.toLowerCase()] = entity;
        });

        extractedData.actions.forEach((action) => {
            if (action.source.toLowerCase() in entitiesDict && action.target.toLowerCase() in entitiesDict) {
                const sourceEntity = entitiesDict[action.source.toLowerCase()];
                const targetEntity = entitiesDict[action.target.toLowerCase()];
                edges.push(CreateActionEdge(action, passage, sourceEntity, targetEntity));
            }
        });

        return edges;
}

export function extractedActionsToLocations(extractedData: z.infer<typeof SCHEMA>) : LocationNode[] {
    const locations = [...new Set(extractedData.actions.map((action) => action.location))];

    return locations.map((location, index) => CreateLocatioNode({name: location, emoji: ""}, index));
}

export class SentenceActionsExtractor extends JSONExtractorPrompt<z.infer<typeof SCHEMA>> {
    textBefore: string;
    textToExtract: string;
    textAfter: string;
    entities: EntityNode[];
    onUpdate: (() => void) | null = null;

    constructor(entities: EntityNode[], textBefore: string, textToExtract: string, textAfter: string) {
        super();
        this.entities = entities;
        this.textBefore = textBefore;
        this.textToExtract = textToExtract;
        this.textAfter = textAfter;
    }

    getPrompt(): string {
        const entitiesStr = this.entities.map(e => e.data.name).join(", ");
        const locationsStr = useModelStore.getState().locationNodes.map(e => e.data.name).join(", ");
        return (this.textBefore.length === 0 ? "" : `BEFORE: ${this.textBefore}\n\n`) + //AFTER: ${this.textAfter}\n\n` +
        `TEXT: ${this.textToExtract}\n\n` + 
        `Extract the actions done by the characters in TEXT and only the actions in TEXT. Do not extract the actions from BEFORE. ` +
        `Only consider actions that are happening exactly at the moment of TEXT, ignore memories etc. ` +
        `If there are no actions fulfilling these criterias in TEXT, then return an empty array. ` +
        `Source and target should be characters from this list: ${entitiesStr}. ` +
        `Here are some possible locations but there might be others: ${locationsStr}. ` +
        `If an action is done by a character to itself, then the source and target character should be the same. ` +        
        `For each action, extract the 'name' of the action (no more than 2 words), ` +
        `the source character (the character doing the action) and the target character (the character targetted by the action)`+
        `, and the location of the action (you can use 'unknown' if the location cannot be inferred from the text).`
    }

    getJSONSchema(): z.ZodType<z.infer<typeof SCHEMA>> {
        return SCHEMA;
    }

    onPartialResult(partialResult: PromptResult<z.infer<typeof SCHEMA>>): void {
        const actionEdges = useModelStore.getState().actionEdges;
        const entities = useModelStore.getState().entityNodes;
        const locations = useModelStore.getState().locationNodes;

        // Remove some actions that we probably do not care about / are mistakes
        partialResult.result.actions = partialResult.result.actions.filter((action) => {
            if (action.source === "unknown") return false;

            // Sometimes the action being extracted comes from "BEFORE" instead of from "TEXT"
            const words = action.name.toLowerCase().split(" ");
            const isInBefore = words.some((word) => this.textBefore.toLowerCase().includes(word));
            const isInText = words.some((word) => this.textToExtract.toLowerCase().includes(word));
            if (!isInText && isInBefore) {
                console.log("Ignoring action because it does not seem to be from the passage: ", {action: action, passage: this.textToExtract});
                return false; // Definitely not an action from TEXT
            }
            return true;
        });

        // Clean up some common issues with the extracted data
        partialResult.result.actions = partialResult.result.actions.map((action) => {
            return {
                name: action.name.trim(),
                source: action.source.trim(),
                target:["unknown", "itself", "himself", "herself", "themselves", "it", "he", "she", "they", action.location.toLowerCase()].includes(action.target.toLowerCase()) ? action.source.trim() : action.target.trim(),
                location: action.location.trim()
            }
        });

        // First, only consider the new actions
        const newActions = partialResult.result.actions.filter((action) => {
            if (action.name === "" || action.source === "" || action.target === "" || action.location === "") return false;

            for (const existingAction of actionEdges) {
                if (existingAction.data!.name === action.name) {
                    const sourceEntity = entities.find((entity) => entity.id === existingAction.source);
                    const targetEntity = entities.find((entity) => entity.id === existingAction.target);
                    if (sourceEntity && sourceEntity.data.name.toLowerCase() === action.source.toLowerCase() &&
                     targetEntity && targetEntity.data.name.toLowerCase() === action.target.toLowerCase()) {
                        return false;
                    }
                }
            }
            return true;
        });


        if (newActions.length > 0) {
            // Are new entities being introduced?
            const newEntities = newActions.map((action) => action.source).concat(newActions.map((action) => action.target)).filter((entityName) => !entities.find((entity) => entity.data.name.toLowerCase() === entityName.toLowerCase()));
            newEntities.forEach((entityName) => { 
                const newEntity = CreateEntityNode({name: entityName, emoji: "", properties: []}, entities.length);
                entities.push(newEntity);
                console.log("New entity: ", entityName, "because of actions: ", newActions);
                //TODO: Get an emoji as well as some properties for that new entity
            });
            if (newEntities.length > 0) useModelStore.getState().setEntityNodes(entities);

            // Are new locations being introduced?
            const locationsMentioned = newActions.map((action) => action.location);
            const newLocations = locationsMentioned.filter((locationName) => !locations.find((location) => location.data.name.toLowerCase() === locationName.toLowerCase()));
            newLocations.forEach((locationName) => {
                const newLocation = CreateLocatioNode({name: locationName, emoji: ""}, locations.length);
                locations.push(newLocation);
            });
            if (newLocations.length > 0) useModelStore.getState().setLocationNodes(locations);

            // Finally we set the actions
            const newActionEdges = extractedActionsToEdgeActions({actions: newActions}, this.textToExtract, useModelStore.getState().entityNodes);
            const allActions = [...actionEdges, ...newActionEdges];

            const text = this.textBefore + this.textToExtract + this.textAfter;

            // Sort the actions based on their position in the text
            allActions.sort((a, b) => {
                return text.indexOf(a.data!.passage) - text.indexOf(b.data!.passage);
            });


            useModelStore.getState().setActionEdges(allActions);

            if (this.onUpdate) this.onUpdate();
        }
    }

}
