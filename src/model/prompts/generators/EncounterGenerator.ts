import { z } from "zod";
import { Entity, EntityKind, EntityNode, Location, useModelStore } from "../../Model";
import { CreateEntityNode } from "../../../view/entityActionView/EntityNodeComponent";
import { LayoutUtils } from "../../LayoutUtils";
import { currentModel, currentProvider } from "../../../store/useAiConfigStore";

const COMBAT_ROLE_ENUM = z.enum(["brute", "skirmisher", "controller", "support", "leader", "minion"]);

const ENCOUNTER_MONSTER_SCHEMA = z.object({
    name: z.string(),
    emoji: z.string(),
    role: z.string(),
    combatRole: COMBAT_ROLE_ENUM,
    count: z.number(),
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
    goal: z.string(),
    knowledge: z.array(z.string()),
});

const ENCOUNTER_SCHEMA = z.object({
    monsters: z.array(ENCOUNTER_MONSTER_SCHEMA),
    twist: z.string(),
    xpBudgetEstimate: z.number(),
});

export type GeneratedEncounter = z.infer<typeof ENCOUNTER_SCHEMA>;

export type EncounterDifficulty = "easy" | "medium" | "hard" | "deadly";

export interface EncounterCriteria {
    location: Location;
    partyLevel: number;
    partySize: number;
    difficulty: EncounterDifficulty;
    notes?: string;
}

/** DMG XP-budget table (per character) — kept as plain data for the prompt. */
const XP_BUDGET_PER_CHARACTER: Record<EncounterDifficulty, Record<number, number>> = {
    easy:   {1:25, 2:50, 3:75, 4:125, 5:250, 6:300, 7:350, 8:450, 9:550, 10:600, 11:800, 12:1000, 13:1100, 14:1250, 15:1400, 16:1600, 17:2000, 18:2100, 19:2400, 20:2800},
    medium: {1:50, 2:100, 3:150, 4:250, 5:500, 6:600, 7:750, 8:900, 9:1100, 10:1200, 11:1600, 12:2000, 13:2200, 14:2500, 15:2800, 16:3200, 17:3900, 18:4200, 19:4900, 20:5700},
    hard:   {1:75, 2:150, 3:225, 4:375, 5:750, 6:900, 7:1100, 8:1400, 9:1600, 10:1900, 11:2400, 12:3000, 13:3400, 14:3800, 15:4300, 16:4800, 17:5900, 18:6300, 19:7300, 20:8500},
    deadly: {1:100, 2:200, 3:400, 4:500, 5:1100, 6:1400, 7:1700, 8:2100, 9:2400, 10:2800, 11:3600, 12:4500, 13:5100, 14:5700, 15:6400, 16:7200, 17:8800, 18:9500, 19:10900, 20:12700},
};

export function calcXpBudget(partyLevel: number, partySize: number, difficulty: EncounterDifficulty): number {
    const level = Math.max(1, Math.min(20, Math.round(partyLevel)));
    const perChar = XP_BUDGET_PER_CHARACTER[difficulty][level] ?? 50;
    return perChar * Math.max(1, partySize);
}

export function buildEncounterPrompt(criteria: EncounterCriteria): string {
    const budget = calcXpBudget(criteria.partyLevel, criteria.partySize, criteria.difficulty);
    const loc = criteria.location;

    return [
        `You are a Dungeons & Dragons 5e DM assistant. Generate a CR-balanced encounter for the party at the named location.`,
        ``,
        `LOCATION:`,
        `- Name: ${loc.name}`,
        `- Kind: ${loc.kind ?? "unknown"}`,
        `- Biome: ${loc.biome ?? "unspecified"}`,
        `- Danger rating: ${loc.danger ?? "unset"} / 10`,
        ``,
        `PARTY:`,
        `- ${criteria.partySize} characters of level ${criteria.partyLevel}`,
        `- Difficulty target: ${criteria.difficulty}`,
        `- Approximate XP budget (DMG 2014): ${budget}`,
        ``,
        `DM NOTES: ${criteria.notes?.trim() || "(none)"}`,
        ``,
        `REQUIREMENTS:`,
        `- 1-4 monster GROUPS. Each group is one creature type with a count (1 brute is fine; 6 minions is also fine).`,
        `- Total CR weight should plausibly hit the XP budget for the target difficulty. Don't overshoot deadly into TPK.`,
        `- Each group has a clear combatRole: brute (front-line damage), skirmisher (mobility / harass), controller (status / debuff), support (heal / buff allies), leader (commands others), minion (low-HP swarm).`,
        `- One concrete environmental TWIST grounded in the location's biome and danger — terrain, hazard, lighting, sound, weather, or an interactable object. NOT just "they ambush from cover".`,
        `- For each monster group also fill: short role label (e.g. "Cragmaw Goblin Sharpshooter"), single emoji, 6 ability scores (3-20), hp / ac / cr scaled to creature type + party level, a short goal sentence (what they want in THIS fight), 3-4 knowledge bullets (what they know about the area or their target).`,
        `- xpBudgetEstimate: your honest estimate of the total XP value across all groups (so the DM can sanity-check against the target budget above).`,
        `- Match the campaign's language: if biome/role descriptions are in Russian elsewhere, write the goal/knowledge in Russian too.`,
        ``,
        `Return the JSON object directly conforming to the schema.`,
    ].join("\n");
}

/** Generate the encounter without yet committing to the model. */
export async function generateEncounter(criteria: EncounterCriteria): Promise<GeneratedEncounter> {
    const prompt = buildEncounterPrompt(criteria);
    return currentProvider().generateStructured(
        [{ role: "user", content: prompt }],
        { schema: ENCOUNTER_SCHEMA, schemaName: "encounter" },
        { model: currentModel(), temperature: 0.7 },
    );
}

/**
 * Generate an encounter and spawn its monsters as new entity nodes anchored
 * around the chosen location. Returns the encounter payload so the caller
 * can render the twist + XP estimate in UI.
 */
export async function generateEncounterIntoScene(
    criteria: EncounterCriteria,
    canvasCenter: { x: number; y: number },
): Promise<{ encounter: GeneratedEncounter; spawned: EntityNode[] }> {
    const encounter = await generateEncounter(criteria);

    const existing = useModelStore.getState().entityNodes;
    const spawned: EntityNode[] = [];

    let index = existing.length;
    for (const group of encounter.monsters) {
        const safeCount = Math.max(1, Math.min(20, Math.round(group.count || 1)));
        for (let i = 0; i < safeCount; i++) {
            // Append " #N" suffix only when there is more than one of the same name
            // so the entity-graph stays readable.
            const name = safeCount === 1 ? group.name : `${group.name} #${i + 1}`;
            const entity: Entity = {
                name,
                emoji: group.emoji,
                properties: [
                    { name: "ferocity", value: 5 },
                    { name: group.combatRole, value: 8 },
                ],
                kind: "monster" as EntityKind,
                role: group.role,
                abilities: group.abilities,
                hp: group.hp,
                ac: group.ac,
                cr: group.cr,
                goal: group.goal,
                knowledge: group.knowledge,
            };
            spawned.push(CreateEntityNode(entity, index++));
        }
    }

    const nextEntities = [...existing, ...spawned];
    useModelStore.getState().setEntityNodes(nextEntities);
    LayoutUtils.optimizeNodeLayout(
        "entity",
        nextEntities,
        useModelStore.getState().setEntityNodes,
        canvasCenter,
        120,
        100,
    );

    return { encounter, spawned };
}
