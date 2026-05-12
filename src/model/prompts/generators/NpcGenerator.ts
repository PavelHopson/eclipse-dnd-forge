import { z } from "zod";
import { Entity, EntityKind, EntityNode, useModelStore } from "../../Model";
import { JSONPrompt } from "../utils/JSONPrompt";
import { CreateEntityNode } from "../../../view/entityActionView/EntityNodeComponent";
import { LayoutUtils } from "../../LayoutUtils";

const NPC_KIND_ENUM = z.enum(["npc", "monster"]);

const NPC_SCHEMA = z.object({
    name: z.string(),
    emoji: z.string(),
    kind: NPC_KIND_ENUM,
    role: z.string(),
    properties: z.array(z.object({
        name: z.string(),
        value: z.number(),
    })),
    abilities: z.object({
        str: z.number(),
        dex: z.number(),
        con: z.number(),
        int: z.number(),
        wis: z.number(),
        cha: z.number(),
    }),
    hp: z.number(),
    ac: z.number(),
    cr: z.number(),
    hook: z.string(),
    goal: z.string(),
    secret: z.string(),
    knowledge: z.array(z.string()),
});

export type GeneratedNpc = z.infer<typeof NPC_SCHEMA>;

export interface NpcCriteria {
    race?: string;
    occupation?: string;
    partyLevel?: number;
    location?: string;
    hostility?: "friendly" | "neutral" | "hostile" | "any";
    notes?: string;
}

export function buildNpcPrompt(criteria: NpcCriteria): string {
    const party = typeof criteria.partyLevel === "number" && criteria.partyLevel > 0 ? criteria.partyLevel : 3;
    const hostility = criteria.hostility && criteria.hostility !== "any" ? criteria.hostility : "DM's choice";

    return `You are a Dungeons & Dragons 5th Edition Dungeon Master assistant. ` +
        `Generate a single NPC ready to be dropped into the current scene.\n\n` +
        `Criteria:\n` +
        `- Race / creature type hint: ${criteria.race?.trim() || "any (you pick something interesting)"}\n` +
        `- Role or occupation hint: ${criteria.occupation?.trim() || "any (you pick something that fits the location)"}\n` +
        `- Party level for balance: ${party}\n` +
        `- Current location: ${criteria.location?.trim() || "unspecified"}\n` +
        `- Hostility: ${hostility}\n` +
        `- DM notes: ${criteria.notes?.trim() || "none"}\n\n` +
        `Return ONE NPC with:\n` +
        `- name: a fitting D&D-style proper name (no titles unless they ARE the name)\n` +
        `- emoji: a single emoji that captures the NPC visually (avoid generic 🧙 / 👤 unless they truly fit)\n` +
        `- kind: "npc" if friendly or neutral, "monster" if clearly hostile / a creature\n` +
        `- role: short archetype label, max 4 words, written in D&D terms (e.g. "Halfling Cutpurse", "Frost Giant Skald", "Dwarven Smith of Moradin")\n` +
        `- properties: exactly 3 D&D-flavoured adjective traits on a 1-10 intensity scale. ` +
        `Prefer traits like "cunning", "ferocity", "piety", "greed", "loyalty", "menace", "fear", "scholarship" over generic feelings.\n` +
        `- abilities: STR, DEX, CON, INT, WIS, CHA each 3-20, scaled to the creature type and CR. ` +
        `For a level ${party} party, target a believable distribution rather than max stats.\n` +
        `- hp: integer hit points appropriate for the role and CR\n` +
        `- ac: integer armour class (10-22 range)\n` +
        `- cr: Challenge Rating as a number (fractional allowed: 0.125, 0.25, 0.5, then integers). Calibrate so the NPC is interesting but not an instant TPK against the level-${party} party.\n` +
        `- hook: ONE sentence the DM can read aloud to introduce this NPC into the current scene. ` +
        `Anchor it to "${criteria.location?.trim() || "the current scene"}" if that helps. ` +
        `Make it concrete and actionable, not generic ("introduces themselves" is bad, "is haggling with the innkeeper over the price of a stained map" is good).\n` +
        `- goal: ONE concise sentence describing what this NPC wants right now (motivation that drives subtext during dialogue). This is DM-visible only — never directly stated by the NPC.\n` +
        `- secret: ONE concise sentence describing something this NPC actively hides. Affects reactions in conversation, never volunteered, only revealed under pressure / persuasion / leverage.\n` +
        `- knowledge: 3-5 short factual bullets the NPC knows about the world / scene / other characters. Each bullet is a single concrete fact (a name, a place, a rumour, a habit), not a generalisation. These ground the NPC's answers in concrete detail when the player asks.`;
}

export async function generateNpc(criteria: NpcCriteria): Promise<GeneratedNpc> {
    const prompt = buildNpcPrompt(criteria);
    const result = await new JSONPrompt({ prompt }, NPC_SCHEMA).execute();
    return result.result;
}

/**
 * Generate an NPC and add it to the current model as a new entity node.
 * Returns the generated payload (including the hook), so the caller can show it.
 */
export async function generateNpcIntoScene(
    criteria: NpcCriteria,
    canvasCenter: { x: number; y: number },
): Promise<{ npc: GeneratedNpc; entityNode: EntityNode }> {
    const npc = await generateNpc(criteria);

    const entity: Entity = {
        name: npc.name,
        emoji: npc.emoji,
        properties: npc.properties,
        kind: npc.kind as EntityKind,
        role: npc.role,
        abilities: npc.abilities,
        hp: npc.hp,
        ac: npc.ac,
        cr: npc.cr,
        goal: npc.goal,
        secret: npc.secret,
        knowledge: npc.knowledge,
    };

    const existing = useModelStore.getState().entityNodes;
    const entityNode = CreateEntityNode(entity, existing.length);
    const nextEntities = [...existing, entityNode];
    useModelStore.getState().setEntityNodes(nextEntities);

    LayoutUtils.optimizeNodeLayout(
        "entity",
        nextEntities,
        useModelStore.getState().setEntityNodes,
        canvasCenter,
        120,
        100,
    );

    return { npc, entityNode };
}
