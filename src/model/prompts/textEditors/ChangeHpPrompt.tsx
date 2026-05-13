import { Entity, useModelStore } from "../../Model";
import { TextEditPrompt } from "./TextEditPrompt";

/**
 * Rewrites the current session text to reflect a change in an entity's HP.
 *
 * Semantic mapping:
 *   - HP drops by > 50% of previous → bloody / wounded / staggering
 *   - HP drops to 0                  → unconscious / dying (NOT killed —
 *                                       the DM may want to spare them)
 *   - HP rises significantly         → healed / mended / patched up
 *   - Small fluctuations             → glancing blow / shallow cut
 *
 * The agent is instructed NOT to mention specific numbers — it's a
 * narrative rewrite, not a stat block update.
 */
export class ChangeHpPrompt extends TextEditPrompt {
    entity: Entity;
    previousHp: number;
    newHp: number;
    maxHp: number;

    constructor(entity: Entity, previousHp: number, newHp: number, maxHp?: number) {
        super();
        this.entity = entity;
        this.previousHp = previousHp;
        this.newHp = newHp;
        // If we have no canonical max, treat previous as the high-water mark.
        this.maxHp = maxHp ?? Math.max(previousHp, newHp, 1);
    }

    getPrompt(): string {
        const delta = this.newHp - this.previousHp;
        const ratio = this.newHp / Math.max(1, this.maxHp);

        let severity: string;
        if (this.newHp <= 0) {
            severity = "drops unconscious or dying, falling motionless";
        } else if (delta < 0 && Math.abs(delta) / Math.max(1, this.previousHp) >= 0.5) {
            severity = "is seriously wounded — staggering, bloodied, weakened";
        } else if (delta < 0) {
            severity = "takes a glancing wound — a cut, a bruise, a sharp impact, nothing fatal";
        } else if (delta > 0 && ratio >= 0.9) {
            severity = "is fully healed — wounds knit closed, breathing steady, posture restored";
        } else if (delta > 0) {
            severity = "is partially healed — colour returns, the worst of the bleeding stops";
        } else {
            severity = "remains in the same condition (no narrative change needed)";
        }

        return `${useModelStore.getState().text}\n\n` +
            `Slightly rewrite the story so that ${this.entity.name} ${severity}. ` +
            `Do NOT mention specific numbers (no HP, no AC, no dice). ` +
            `Use vivid sensory detail — what other characters SEE, HEAR. ` +
            `Keep all other facts in the story intact. Match the existing tone and language.`;
    }
}
