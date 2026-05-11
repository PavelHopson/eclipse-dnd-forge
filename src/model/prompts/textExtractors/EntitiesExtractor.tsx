import { z } from "zod";
import { CreateEntityNode } from "../../../view/entityActionView/EntityNodeComponent";
import { LayoutUtils } from "../../LayoutUtils";
import { Entity, EntityKind, EntityNode, useModelStore } from "../../Model";
import { JSONPrompt } from "../utils/JSONPrompt";

const ENTITY_KIND_ENUM = z.enum(["hero", "npc", "monster", "faction", "unknown"]);

const ENTITY_SCHEMA = z.object({
    entities: z.array(z.object({
        name: z.string(),
        emoji: z.string(),
        kind: ENTITY_KIND_ENUM,
        role: z.string(),
        properties: z.array(z.object({
            name: z.string(),
            value: z.number()
        }))
    }))
});


export function extractedEntitiesToNodeEntities(extractedData: z.infer<typeof ENTITY_SCHEMA>) : EntityNode[] {
    return extractedData.entities.map((entity, index) => {
        const e: Entity = {
            name: entity.name,
            emoji: entity.emoji,
            properties: entity.properties,
            kind: entity.kind as EntityKind,
            role: entity.role,
        };
        return CreateEntityNode(e, index);
    });
}


export function EntitiesExtractor(text : string, center: {x: number, y: number}) : Promise<EntityNode[]> {
    const prompt = text +
    `\n\nYou are extracting entities from a Dungeons & Dragons campaign log or session notes. ` +
    `Identify every named character, creature, faction, or significant being in the passage. ` +
    `For each entity, extract:\n` +
    `- 'name': the entity's name as written\n` +
    `- 'emoji': a single emoji that visually represents the entity (avoid reusing the same emoji across entities)\n` +
    `- 'kind': one of "hero" (player character), "npc" (non-player character ally / neutral / quest-giver), "monster" (hostile creature or named villain), "faction" (organisation, cult, guild, party), or "unknown" if it truly cannot be classified\n` +
    `- 'role': a short label, max 4 words, describing the entity's role or archetype in D&D terms (e.g. "Half-elf Ranger", "Innkeeper of Phandalin", "Vampire Spawn", "Zhentarim Cell")\n` +
    `- 'properties': up to 3 adjective-style traits on a 1-10 intensity scale. Prefer D&D-flavoured traits like "cunning", "ferocity", "piety", "fear", "menace", "loyalty" over generic emotion words.\n\n` +
    `If a player party is mentioned only as a group ("the party", "the adventurers"), treat it as one entity of kind "hero". Skip incidental scenery references that are not characters.`


    const entityExtractor = new JSONPrompt({ prompt:  prompt}, ENTITY_SCHEMA)
    useModelStore.getState().setEntityNodes([]);

    entityExtractor.onPartialResponse = (partialResult) => {
        const newEntities = extractedEntitiesToNodeEntities(partialResult.result);
        const oldEntities = useModelStore.getState().entityNodes;

        // Reuse the position of the entities that already existed
        const entities = newEntities.map((newEntity) => {
            const oldEntity = oldEntities.find(e => e.data.name === newEntity.data.name);
            if (oldEntity && oldEntity.position) newEntity.position = oldEntity.position;
            if (oldEntity && oldEntity.measured) newEntity.measured = oldEntity.measured;

            return newEntity;
        });
        
        useModelStore.getState().setEntityNodes(entities);
        LayoutUtils.optimizeNodeLayout("entity", entities, useModelStore.getState().setEntityNodes, {x: center.x, y: center.y}, 120);
    }

    return new Promise((resolve, reject) => {
        entityExtractor.execute().then((result) => {
            console.log("Extracted entities:", result.result.entities);
            resolve(useModelStore.getState().entityNodes);
    })
    });
}