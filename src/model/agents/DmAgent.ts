import { Entity, Location, openai, useModelStore } from "../Model";
import { AgentMessage } from "./NpcAgent";

/** Special agent key used by `useAgentStore` for the global DM conversation. */
export const DM_AGENT_ID = "__dm__";

export interface DmAgentContext {
    /** Current session text from the Slate editor — canonical narrative state. */
    sceneText: string;
    /** All entities known in the world (heroes, NPCs, monsters, factions). */
    entities: Entity[];
    /** All locations known in the world. */
    locations: Location[];
    /** Conversation so far between the player and the DM. */
    history: AgentMessage[];
}

function formatEntityLine(e: Entity): string {
    const kind = e.kind && e.kind !== "unknown" ? ` [${e.kind}]` : "";
    const role = e.role ? ` — ${e.role}` : "";
    return `- ${e.name}${kind}${role}`;
}

function formatLocationLine(l: Location): string {
    const kind = l.kind && l.kind !== "unknown" ? ` [${l.kind}]` : "";
    const biome = l.biome ? ` — ${l.biome}` : "";
    const danger = typeof l.danger === "number" && l.danger > 0 ? ` (danger ${l.danger}/10)` : "";
    return `- ${l.name}${kind}${biome}${danger}`;
}

/**
 * Assemble the DM system prompt.
 *
 * The DM has a different stance from an NPC:
 *   - It narrates the world, not a single character.
 *   - It voices NPCs through quoted lines, but stays in the narrator role.
 *   - It describes consequences of player actions naturally — no dice talk.
 */
export function buildDmSystemPrompt(ctx: DmAgentContext): string {
    const { sceneText, entities, locations } = ctx;

    const entityBlock = entities.length > 0
        ? entities.map(formatEntityLine).join("\n")
        : "- (no named characters yet — improvise as needed and they will be added later)";

    const locationBlock = locations.length > 0
        ? locations.map(formatLocationLine).join("\n")
        : "- (no named locations yet — improvise as needed)";

    return [
        `You are the Dungeon Master of a Dungeons & Dragons 5th Edition campaign.`,
        `You are speaking directly to the players around a table. Your job is to narrate the world, voice NPCs, drive the plot, and react to player actions naturally.`,
        ``,
        `CURRENT SESSION TEXT (this is canonical — everything that has been written down so far):`,
        sceneText.trim() || "(the campaign is just beginning — set the opening scene)",
        ``,
        `CHARACTERS IN PLAY:`,
        entityBlock,
        ``,
        `KNOWN LOCATIONS:`,
        locationBlock,
        ``,
        `HOW YOU NARRATE:`,
        `- 2-3 short paragraphs per beat. Vivid sensory detail — what the players SEE, HEAR, SMELL. Concrete, not abstract.`,
        `- Italicise environmental descriptions and ambient actions with single asterisks: *Candles gutter in the draft. A horse whinnies in the yard.*`,
        `- When an NPC speaks, format their line as: **NPC Name:** "their words" — and use the NPC's known voice (role, traits, knowledge from the list above).`,
        `- Describe consequences of player actions plausibly. If a player says "I draw my sword", show what happens around them — don't ask them to roll, don't invoke game mechanics.`,
        `- Drive the plot forward, but never railroad. Offer hooks, let players choose. End scene beats with an implicit question ("What do you do?") through situation, not a literal prompt.`,
        ``,
        `STRICT RULES:`,
        `- You are the DM, not an AI assistant. Never break the fourth wall.`,
        `- Never refer to D&D 5e rules, dice, AC, HP, modifiers, saving throws, or any game mechanic by name.`,
        `- Match the player's language. If they write in Russian, narrate in Russian. Switch if they switch mid-conversation.`,
        `- Match the tone of the scene (medieval fantasy). No modern slang, brand names, or technology unless it fits.`,
        `- Stay grounded in the CURRENT SESSION TEXT and the listed CHARACTERS / LOCATIONS. Do not invent canon-breaking facts. New details are fine if they extend, not contradict, what is written.`,
        `- If a player asks something purely meta ("what stats does X have?"), gently steer back into the fiction.`,
    ].join("\n");
}

export function buildDmMessages(
    ctx: DmAgentContext,
    newPlayerMessage: string,
): Array<{ role: "system" | "user" | "assistant"; content: string }> {
    const systemPrompt = buildDmSystemPrompt(ctx);
    const historyMessages = ctx.history.map((m) => ({ role: m.role, content: m.content }));
    return [
        { role: "system", content: systemPrompt },
        ...historyMessages,
        { role: "user", content: newPlayerMessage },
    ];
}

/**
 * Streaming DM turn. Caller supplies the prior history snapshot (without the
 * new player message and without any UI placeholder), the new player message,
 * and a chunk callback. Scene + entity + location context is pulled live from
 * `useModelStore`.
 */
export async function runDmTurn(
    priorHistory: AgentMessage[],
    newPlayerMessage: string,
    onPartial: (partial: string) => void,
): Promise<string> {
    const state = useModelStore.getState();
    const entities = state.entityNodes.map((n) => n.data as Entity);
    const locations = state.locationNodes.map((n) => n.data as Location);

    const ctx: DmAgentContext = {
        sceneText: state.text,
        entities,
        locations,
        history: priorHistory,
    };

    const messages = buildDmMessages(ctx, newPlayerMessage);

    const stream = await openai.chat.completions.create({
        model: "gpt-4o-2024-08-06",
        messages,
        stream: true,
        temperature: 0.85,
    });

    let response = "";
    for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content || "";
        if (delta) {
            response += delta;
            onPartial(response);
        }
    }

    return response;
}
