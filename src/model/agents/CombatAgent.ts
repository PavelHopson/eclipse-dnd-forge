import { Entity, useModelStore } from "../Model";
import { currentModel, currentProvider } from "../../store/useAiConfigStore";

export interface CombatTacticContext {
    /** The monster proposing a move. */
    monster: Entity;
    /** Full session text — battlefield narrative state. */
    sceneText: string;
    /** Other entities present (heroes, NPCs, other monsters). */
    others: Entity[];
}

/**
 * Tactical reasoning prompt. The agent plays a *DM-side combat advisor* for
 * a single creature: it does not narrate as the monster, it proposes the
 * single next action the monster would take, in one sentence, with tactical
 * motivation grounded in the creature's role + the battlefield.
 *
 * No mechanics references (AC, HP, attack rolls, modifiers) — DM still owns
 * resolution. The agent's job is the WHY and the WHAT.
 */
export function buildCombatSystemPrompt(ctx: CombatTacticContext): string {
    const { monster, sceneText, others } = ctx;

    const traits = monster.properties.map((p) => `${p.name} (${p.value}/10)`).join(", ") || "no notable traits";
    const ab = monster.abilities;
    const stats = ab
        ? `STR ${ab.str ?? "-"}, DEX ${ab.dex ?? "-"}, CON ${ab.con ?? "-"}, INT ${ab.int ?? "-"}, WIS ${ab.wis ?? "-"}, CHA ${ab.cha ?? "-"}`
        : "no stat block";

    const heroes = others.filter((e) => e.kind === "hero");
    const npcs = others.filter((e) => e.kind === "npc");
    const otherMonsters = others.filter((e) => e.kind === "monster");

    const formatLine = (e: Entity) => `- ${e.name}${e.role ? ` (${e.role})` : ""}`;
    const heroBlock = heroes.length > 0 ? heroes.map(formatLine).join("\n") : "- (no heroes listed)";
    const npcBlock = npcs.length > 0 ? npcs.map(formatLine).join("\n") : "- (no NPCs listed)";
    const monsterBlock = otherMonsters.length > 0 ? otherMonsters.map(formatLine).join("\n") : "- (no allied creatures listed)";

    return [
        `You are a tactical combat advisor for a Dungeons & Dragons 5e DM.`,
        `You propose the single next action that ${monster.name} (${monster.role ?? "creature"}) would take this turn.`,
        ``,
        `THE CREATURE YOU ARE ADVISING:`,
        `- Name: ${monster.name}`,
        `- Role: ${monster.role ?? "unspecified"}`,
        `- Kind: ${monster.kind ?? "monster"}`,
        `- Traits: ${traits}`,
        `- Mechanics (do NOT mention these as numbers in your output): HP ${monster.hp ?? "-"}, AC ${monster.ac ?? "-"}, CR ${monster.cr ?? "-"}, abilities ${stats}`,
        `- Goal: ${monster.goal || "(no explicit goal — improvise from role)"}`,
        ``,
        `HEROES IN THE FIGHT (likely targets):`,
        heroBlock,
        ``,
        `NPCS PRESENT:`,
        npcBlock,
        ``,
        `OTHER CREATURES PRESENT:`,
        monsterBlock,
        ``,
        `CURRENT BATTLEFIELD / SCENE:`,
        sceneText.trim() || "(scene context is empty — improvise plausibly)",
        ``,
        `OUTPUT RULES:`,
        `- One sentence, present tense, action-focused. Examples of shape:`,
        `  - "Klarg lunges at the cleric, swinging his morningstar wide to flank past the rogue and pin them against the cave wall."`,
        `  - "Doru retreats into the bell tower's shadow, hissing in his father's voice to lure the paladin away from the holy symbol."`,
        `- Tactically motivated: explain the target choice OR the position OR the trick, in the same sentence.`,
        `- Use the creature's known voice (traits, role). Cowardly creatures retreat; brutes charge the front-line; cunning creatures isolate squishies.`,
        `- DO NOT mention rules, AC, HP, attack bonuses, saving throws, advantage, or any 5e term.`,
        `- DO NOT roll dice or call for rolls — the DM does that. You only propose the WHAT and the WHY.`,
        `- Match the player's language (if they wrote in Russian elsewhere, write in Russian).`,
        `- One sentence. No preamble, no "I suggest...". Just the action.`,
    ].join("\n");
}

/**
 * Suggest one tactical action for the given monster entity. Streams the
 * single-sentence proposal through `onPartial` and returns the final text.
 */
export async function suggestCombatTactic(
    monsterEntityId: string,
    onPartial: (partial: string) => void,
): Promise<string> {
    const state = useModelStore.getState();
    const node = state.entityNodes.find((n) => n.id === monsterEntityId);
    if (!node) throw new Error(`CombatAgent: entity not found (id=${monsterEntityId})`);

    const monster = node.data as Entity;
    const others = state.entityNodes
        .filter((n) => n.id !== monsterEntityId)
        .map((n) => n.data as Entity);

    const systemPrompt = buildCombatSystemPrompt({
        monster,
        sceneText: state.text,
        others,
    });

    // Single-turn structure: system + one user message ("Propose this creature's next move.").
    // The agent's job is reasoning over the world snapshot, not a long dialogue.
    const { text } = await currentProvider().streamChat(
        [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Propose ${monster.name}'s next action this turn.` },
        ],
        {
            model: currentModel(),
            temperature: 0.7,
            onPartial,
        },
    );

    return text;
}
