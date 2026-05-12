import { Entity, useModelStore } from "../Model";
import { currentModel, currentProvider } from "../../store/useAiConfigStore";

export type AgentMessageRole = "user" | "assistant";

export interface AgentMessage {
    role: AgentMessageRole;
    content: string;
    /** Wall-clock timestamp when the message was created, for UI sorting / debug. */
    createdAt: number;
}

export interface NpcAgentContext {
    /** The entity this agent is playing. */
    entity: Entity;
    /** Full session text from the Slate editor — gives the NPC scene awareness. */
    sceneText: string;
    /** Other entities currently in the world graph — for relationship awareness. */
    otherEntities: Entity[];
    /** Conversation so far with the human player. Excludes the current turn. */
    history: AgentMessage[];
}

/**
 * Build the system prompt for an NPC agent.
 *
 * The prompt encodes:
 *   - Character card (name, role, kind, traits, stats — never read aloud as numbers).
 *   - Knowledge bullets (what the NPC actually knows).
 *   - Goal (drives subtext — never blurted out).
 *   - Secret (never volunteered, only revealed under leverage).
 *   - Scene + other present entities.
 *   - Rules of engagement (stay in character, no 4th-wall, match player language).
 */
export function buildNpcSystemPrompt(ctx: NpcAgentContext): string {
    const { entity, sceneText, otherEntities } = ctx;

    const traits = entity.properties
        .map((p) => `${p.name} (${p.value}/10)`)
        .join(", ") || "no notable traits";

    const ab = entity.abilities;
    const stats = ab
        ? `STR ${ab.str ?? "-"}, DEX ${ab.dex ?? "-"}, CON ${ab.con ?? "-"}, INT ${ab.int ?? "-"}, WIS ${ab.wis ?? "-"}, CHA ${ab.cha ?? "-"}`
        : "no stat block";

    const knowledgeBullets = entity.knowledge && entity.knowledge.length > 0
        ? entity.knowledge.map((k) => `- ${k}`).join("\n")
        : "- (no specific facts on record — improvise plausibly from your role)";

    const otherPresent = otherEntities
        .filter((e) => e.name !== entity.name)
        .slice(0, 8)
        .map((e) => `- ${e.name}${e.role ? ` (${e.role})` : ""}`)
        .join("\n") || "- (no other named characters in the scene)";

    return [
        `You are playing ${entity.name}, a character in a Dungeons & Dragons 5th Edition campaign.`,
        `You are speaking directly with a player at the table. Stay in character at all times.`,
        ``,
        `CHARACTER:`,
        `- Name: ${entity.name}`,
        `- Role: ${entity.role ?? "unspecified"}`,
        `- Kind: ${entity.kind ?? "unknown"}`,
        `- Traits: ${traits}`,
        `- Mechanics (for grounding only — never read these out as numbers): HP ${entity.hp ?? "-"}, AC ${entity.ac ?? "-"}, CR ${entity.cr ?? "-"}, abilities ${stats}`,
        ``,
        `WHAT YOU KNOW (use only these facts; if asked something outside, react truthfully — puzzled, dismissive, curious — based on your character):`,
        knowledgeBullets,
        ``,
        `YOUR GOAL (DM-visible — drives your subtext; you do NOT state it directly):`,
        entity.goal || "(no explicit goal — improvise from your role)",
        ``,
        `YOUR SECRET (you actively hide this; never volunteer it; reveal only under genuine pressure, persuasion, or leverage):`,
        entity.secret || "(no specific secret)",
        ``,
        `CURRENT SCENE (what is happening around you in the world right now):`,
        sceneText.trim() || "(scene context is empty — improvise from your role and the player's first line)",
        ``,
        `OTHER CHARACTERS PRESENT NEARBY:`,
        otherPresent,
        ``,
        `RULES OF ENGAGEMENT:`,
        `- You are ${entity.name}, not an AI. Never break the fourth wall.`,
        `- Never refer to D&D rules, stat blocks, dice, AC, HP, modifiers, or any game mechanic by name.`,
        `- Respond in 1-3 short paragraphs. Speak the way someone in your role would speak (vocabulary, cadence).`,
        `- Italicise physical actions, gestures, and short asides with single asterisks: *nods*, *pours a drink*, *eyes narrow*.`,
        `- Match the player's language. If they write in Russian, answer in Russian. If they switch — switch with them.`,
        `- Match the tone of the scene (medieval fantasy). No modern slang, brand names, or technology unless it fits the setting.`,
        `- Stay grounded in your KNOWLEDGE list and your character. If the player tries to make you do or say something that contradicts your character, refuse in character.`,
    ].join("\n");
}

/**
 * Build the chat-completions messages array sent to OpenAI.
 * System prompt + prior turns + the new player message (separately, by caller).
 */
export function buildMessages(
    ctx: NpcAgentContext,
    newPlayerMessage: string,
): Array<{ role: "system" | "user" | "assistant"; content: string }> {
    const systemPrompt = buildNpcSystemPrompt(ctx);
    const historyMessages = ctx.history.map((m) => ({ role: m.role, content: m.content }));
    return [
        { role: "system", content: systemPrompt },
        ...historyMessages,
        { role: "user", content: newPlayerMessage },
    ];
}

/**
 * Streaming dialogue runner. Caller passes the conversation history that should
 * be sent to the model (PRIOR turns only — without the new player message and
 * without any UI placeholders) plus the new player message itself.
 *
 * Scene context is read from the global model store at call time.
 */
export async function runNpcDialogue(
    entityId: string,
    priorHistory: AgentMessage[],
    newPlayerMessage: string,
    onPartial: (partial: string) => void,
): Promise<string> {
    const state = useModelStore.getState();
    const entityNode = state.entityNodes.find((n) => n.id === entityId);
    if (!entityNode) {
        throw new Error(`NpcAgent: entity not found in model (id=${entityId})`);
    }

    const otherEntities = state.entityNodes
        .filter((n) => n.id !== entityId)
        .map((n) => n.data as Entity);

    const ctx: NpcAgentContext = {
        entity: entityNode.data as Entity,
        sceneText: state.text,
        otherEntities,
        history: priorHistory,
    };

    const messages = buildMessages(ctx, newPlayerMessage);

    const { text } = await currentProvider().streamChat(messages, {
        model: currentModel(),
        temperature: 0.8,
        onPartial,
    });

    return text;
}
