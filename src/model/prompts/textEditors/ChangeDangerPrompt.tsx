import { Location, useModelStore } from "../../Model";
import { TextEditPrompt } from "./TextEditPrompt";

/**
 * Rewrites the current session text to reflect a change in a location's
 * danger rating. The semantic ladder (1-10):
 *   1-3   peaceful, ordinary, safe — taverns, villages, friendly camps
 *   4-6   uneasy, contested — bandit roads, haunted forests by day
 *   7-9   actively dangerous — lairs, war zones, cursed sites
 *   10    deadly — dragon's hoard, demon-lord's throne, planar tear
 *
 * The agent rewrites atmospheric / sensory details around the location to
 * match the new tier — without inventing new plot events.
 */
export class ChangeDangerPrompt extends TextEditPrompt {
    location: Location;
    previousDanger: number;
    newDanger: number;

    constructor(location: Location, previousDanger: number, newDanger: number) {
        super();
        this.location = location;
        this.previousDanger = previousDanger;
        this.newDanger = newDanger;
    }

    getPrompt(): string {
        const tier = (d: number): string => {
            if (d <= 3) return "peaceful and ordinary — warmth, daily life, safe sounds";
            if (d <= 6) return "uneasy and contested — wary glances, signs of past violence, an underlying tension";
            if (d <= 9) return "actively dangerous — visible threat, predator signs, the air heavy with menace";
            return "deadly — unmistakable signs of catastrophe, primal fear, an instinct to flee";
        };

        const from = tier(this.previousDanger);
        const to = tier(this.newDanger);

        return `${useModelStore.getState().text}\n\n` +
            `Slightly rewrite the story so that ${this.location.name} now feels ${to} (it was previously ${from}). ` +
            `Adjust only the sensory and atmospheric description of ${this.location.name} and what the characters notice there. ` +
            `Do NOT invent new plot events, new NPCs, or new combat. ` +
            `Do NOT mention specific danger numbers, dice, or game mechanics. ` +
            `Keep all character facts and story beats intact. Match the existing tone and language.`;
    }
}
