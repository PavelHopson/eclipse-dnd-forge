import { Entity, useModelStore } from "../../Model";
import { TextEditPrompt } from "./TextEditPrompt";

export type AbilityKey = "str" | "dex" | "con" | "int" | "wis" | "cha";

/**
 * Narrative-aware mapping for each ability score. We focus on what an OUTSIDE
 * observer would notice when the character acts — that's the angle a rewrite
 * needs to land on.
 */
const ABILITY_NARRATIVE: Record<AbilityKey, { name: string; high: string; mid: string; low: string }> = {
    str: {
        name: "physical strength",
        high: "carries heavy gear without effort, shoves doors open one-handed, lifts what others struggle to drag",
        mid: "handles ordinary weight without comment — not a feat, not a struggle",
        low: "winces under loads, leans on companions for the heavy work, wields lighter gear by necessity",
    },
    dex: {
        name: "agility and reflexes",
        high: "moves with cat-quick precision, recovers from stumbles before they fall, fingers slip into latches without looking",
        mid: "moves competently — not graceful, not clumsy, just steady",
        low: "fumbles small tasks, trips over uneven ground, drops things at bad moments",
    },
    con: {
        name: "stamina and toughness",
        high: "tireless on the road, shrugs off cold and hunger, recovers fast from wounds",
        mid: "endures the day as well as anyone else, no more, no less",
        low: "tires early, pales after small wounds, needs more rest than the rest of the party",
    },
    int: {
        name: "knowledge and reasoning",
        high: "recognises crests, languages, and ancient names without thinking, connects clues mid-sentence",
        mid: "follows the conversation; asks reasonable questions; doesn't volunteer scholarly leaps",
        low: "misses references, asks for plain words, processes slowly when it's complicated",
    },
    wis: {
        name: "perception and intuition",
        high: "reads the room instantly, notices what others miss, senses the mood before anyone speaks",
        mid: "picks up the obvious cues but not the hidden ones",
        low: "misses the warning signs, talks past what others are silently saying, slow to feel the shift in the air",
    },
    cha: {
        name: "presence and social weight",
        high: "draws attention by walking in, voice carries, NPCs lean toward them when they speak",
        mid: "speaks and is heard, but doesn't command the room",
        low: "fades into the background, gets talked over, has to repeat themselves to be acknowledged",
    },
};

function tier(value: number): "high" | "mid" | "low" {
    if (value >= 16) return "high";
    if (value <= 8) return "low";
    return "mid";
}

/**
 * Rewrite the session text so that the named entity acts as someone with the
 * NEW ability score. Skipped when both old and new sit in the same tier
 * (we don't burn a rewrite on cosmetic 14 → 15 changes).
 */
export class ChangeAbilityScorePrompt extends TextEditPrompt {
    entity: Entity;
    ability: AbilityKey;
    previousValue: number;
    newValue: number;

    constructor(entity: Entity, ability: AbilityKey, previousValue: number, newValue: number) {
        super();
        this.entity = entity;
        this.ability = ability;
        this.previousValue = previousValue;
        this.newValue = newValue;
    }

    canBeExecuted(): boolean {
        // Skip when the change is cosmetic (same tier).
        if (tier(this.previousValue) === tier(this.newValue)) return false;
        return super.canBeExecuted();
    }

    getPrompt(): string {
        const spec = ABILITY_NARRATIVE[this.ability];
        const oldTier = tier(this.previousValue);
        const newTier = tier(this.newValue);
        const newDescription = spec[newTier];
        const oldDescription = spec[oldTier];

        return `${useModelStore.getState().text}\n\n` +
            `Slightly rewrite the story so that ${this.entity.name} now acts as someone whose ${spec.name} ${newDescription} ` +
            `(they previously ${oldDescription}). ` +
            `Adjust only the bits of action and dialogue that actually showcase ${this.entity.name}; do NOT touch other characters, plot beats, or world facts. ` +
            `Do NOT mention specific numbers, abilities, dice, AC, HP, or any game mechanic by name. ` +
            `Use vivid, observable detail — what others would notice. Match the existing tone and language.`;
    }
}

export const ABILITY_LABELS: Record<AbilityKey, string> = {
    str: "STR",
    dex: "DEX",
    con: "CON",
    int: "INT",
    wis: "WIS",
    cha: "CHA",
};
