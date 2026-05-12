import { EntityNode } from "../Model";
import { useAgentStore } from "../../store/useAgentStore";

/**
 * Parsed quote extracted from a DM narration block.
 * Example match: `**Toblen Stonehill:** *Wipes a mug.* "Aye, three nights..."`
 */
export interface ParsedNpcQuote {
    entityId: string;
    entityName: string;
    line: string;
}

/**
 * Find every `**Name:** ...` quote in a DM-generated text and, if the speaker
 * matches a known entity in the world graph, return it as a parsed quote.
 *
 * Greedy on the trailing content — captures everything up to the next
 * blank line, the next `**Name:**` start, or end-of-string. That keeps
 * multi-sentence NPC speeches together while still segmenting between
 * speakers.
 */
export function extractNpcQuotes(dmText: string, entityNodes: EntityNode[]): ParsedNpcQuote[] {
    if (!dmText) return [];

    // The capture group on the name is non-greedy and stops at the closing **,
    // but we deliberately do not anchor to start-of-line so the parser is
    // tolerant of indentation / leading italic blocks.
    const pattern = /\*\*([^*\n]+?)\*\*:\s*([\s\S]+?)(?=\n\s*\n|\n\s*\*\*[^*\n]+?\*\*:|\s*$)/g;

    const out: ParsedNpcQuote[] = [];
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(dmText)) !== null) {
        const rawName = match[1].trim();
        const rawLine = match[2].trim();
        if (!rawName || !rawLine) continue;

        // Case-insensitive match against the world graph. We compare against
        // exact entity names — for now, partial matches (e.g. "Toblen" matching
        // "Toblen Stonehill") are intentionally not supported, to avoid
        // mirroring the wrong NPC's voice into the chat history.
        const entity = entityNodes.find(
            (n) => (n.data.name as string).toLowerCase() === rawName.toLowerCase(),
        );
        if (!entity) continue;

        out.push({
            entityId: entity.id,
            entityName: entity.data.name,
            line: rawLine,
        });
    }

    return out;
}

/**
 * Mirror DM-narrated NPC quotes into the per-NPC chat histories so a later
 * `Talk to <Name>` panel picks up the context naturally.
 *
 * Each quote becomes an assistant message in that NPC's history. The first
 * such mirror is preceded by a one-time DM-attribution system note so the
 * NPC agent knows the line came from narration, not from a real player
 * exchange.
 */
export function mirrorDmQuotesToNpcHistories(quotes: ParsedNpcQuote[]): void {
    if (quotes.length === 0) return;

    const agentStore = useAgentStore.getState();

    for (const quote of quotes) {
        const existing = agentStore.getHistory(quote.entityId);
        const hasMirrorMarker = existing.some(
            (m) => m.role === "user" && m.content.startsWith("(DM narrated this scene"),
        );

        if (!hasMirrorMarker) {
            // One-time framing message so future replies from this NPC stay
            // consistent with what was just narrated.
            agentStore.appendUserMessage(
                quote.entityId,
                "(DM narrated this scene; the following lines are what you said aloud during it.)",
            );
        }

        agentStore.appendAssistantMessage(quote.entityId, quote.line);
    }
}
