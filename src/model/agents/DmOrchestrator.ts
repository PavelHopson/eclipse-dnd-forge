import { Entity, EntityNode, useModelStore } from "../Model";
import { useAgentStore } from "../../store/useAgentStore";
import { GameLoopEntry, useGameLoopStore } from "../../store/useGameLoopStore";
import { AgentMessage, AgentMessageRole, runNpcDialogue } from "./NpcAgent";
import { runDmTurn } from "./DmAgent";
import { extractNpcQuotes, mirrorDmQuotesToNpcHistories } from "./dmCrossReference";

/**
 * Autonomous play loop — slice 21, core turn.
 *
 * The standalone DmAgentPanel lets a DM monologue. The orchestrator goes one
 * step further: it wires a single player action through the DM agent AND the
 * relevant NPC agents in one turn, so the table effectively plays itself.
 *
 * One turn = one call to `runGameTurn`:
 *   1. record the player's free-text action
 *   2. the DM agent narrates the consequence (streamed)
 *   3. mirror any **Name:** quotes the DM voiced into those NPC chat histories
 *   4. route: pick the NPCs the player addressed by name that the DM did NOT
 *      already voice this beat, and let each one's own agent react in-character
 *   5. return to `awaiting-player`
 *
 * The loop is player-gated: it always ends back at `awaiting-player`, so there
 * is no runaway-conversation risk. The only fan-out cap is `MAX_REACTING_NPCS`.
 *
 * The orchestrator owns `useGameLoopStore` directly (it IS the game loop), but
 * still delegates each individual beat to the existing agent functions
 * (`runDmTurn`, `runNpcDialogue`) — so every provider path (OpenAI / Ollama /
 * Anthropic / Fallback) keeps working unchanged.
 */

/** At most this many NPC agents react in a single turn, to bound fan-out / cost. */
const MAX_REACTING_NPCS = 3;

function errMsg(e: unknown): string {
    if (e && typeof e === "object" && "message" in e && typeof (e as { message?: unknown }).message === "string") {
        return (e as { message: string }).message;
    }
    return "неизвестная ошибка";
}

/** Flatten a beat of DM narration into a single short line for an NPC cue. */
function condense(text: string, max = 600): string {
    const flat = text.replace(/\s+/g, " ").trim();
    return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}

function isWordChar(c: string | undefined): boolean {
    return !!c && /[\p{L}\p{N}]/u.test(c);
}

/**
 * Whole-word(ish) containment check. `\b` is unreliable for Cyrillic names, so
 * we match the substring and require non-word characters on both sides.
 */
function wordIncludes(haystack: string, needle: string): boolean {
    if (!needle) return false;
    let from = 0;
    for (;;) {
        const idx = haystack.indexOf(needle, from);
        if (idx === -1) return false;
        const before = idx === 0 ? "" : haystack[idx - 1];
        const after = idx + needle.length >= haystack.length ? "" : haystack[idx + needle.length];
        if (!isWordChar(before) && !isWordChar(after)) return true;
        from = idx + 1;
    }
}

/** True when the player's action names this entity (full name or first token). */
function mentionsName(lowerInput: string, name: string): boolean {
    const full = name.toLowerCase().trim();
    if (!full) return false;
    if (wordIncludes(lowerInput, full)) return true;
    const first = full.split(/\s+/)[0];
    if (first && first.length >= 3 && first !== full) {
        return wordIncludes(lowerInput, first);
    }
    return false;
}

/**
 * Routing: which NPCs should react in-character this turn?
 *
 * An NPC reacts when the player addressed it by name AND the DM did not already
 * voice it in this beat (no point double-speaking — the DM covered it). Only
 * `npc` / `monster` kinds react; heroes are the players, factions don't speak.
 */
function selectReactingNpcs(
    playerInput: string,
    entityNodes: EntityNode[],
    alreadyVoiced: Set<string>,
): Array<{ id: string; name: string }> {
    const lowerInput = playerInput.toLowerCase();
    const out: Array<{ id: string; name: string }> = [];

    for (const node of entityNodes) {
        const e = node.data as Entity;
        if (e.kind !== "npc" && e.kind !== "monster") continue;
        const name = (e.name ?? "").trim();
        if (!name) continue;
        if (alreadyVoiced.has(name.toLowerCase())) continue;
        if (mentionsName(lowerInput, name)) {
            out.push({ id: node.id, name });
            if (out.length >= MAX_REACTING_NPCS) break;
        }
    }
    return out;
}

/**
 * Rebuild the DM's prior conversation history from the play transcript.
 *
 * Player beats map to `user`, DM + NPC beats map to `assistant` (NPC lines get
 * a `**Name:**` prefix so the DM still knows who spoke). Consecutive same-role
 * entries are merged so the message array stays strictly alternating — some
 * providers reject consecutive same-role messages.
 */
function buildDmHistoryFromLog(log: GameLoopEntry[]): AgentMessage[] {
    const msgs: AgentMessage[] = [];
    for (const e of log) {
        const content = e.content.trim();
        if (!content) continue;
        const role: AgentMessageRole = e.kind === "player" ? "user" : "assistant";
        const rendered = e.kind === "npc" ? `**${e.speaker}:** ${content}` : content;
        const last = msgs[msgs.length - 1];
        if (last && last.role === role) {
            last.content = `${last.content}\n\n${rendered}`;
        } else {
            msgs.push({ role, content: rendered, createdAt: e.createdAt });
        }
    }
    return msgs;
}

/**
 * Run one autonomous play turn. Drives `useGameLoopStore` end-to-end; the panel
 * only needs to render the store reactively and feed player input.
 *
 * Resolves when the turn is fully settled (phase back to `awaiting-player`).
 * Never rejects — agent failures are surfaced as in-fiction fallback lines in
 * the transcript so the loop stays usable.
 */
export async function runGameTurn(playerInput: string): Promise<void> {
    const trimmed = playerInput.trim();
    if (!trimmed) return;

    const gl = useGameLoopStore.getState();
    // Guard: only one turn in flight, and only once the loop has been started.
    if (gl.phase !== "awaiting-player") return;

    // Snapshot the DM's prior history BEFORE we append this turn's player beat —
    // runDmTurn takes prior history and the new player message separately.
    const priorDmHistory = buildDmHistoryFromLog(gl.turnLog);

    gl.appendEntry({ kind: "player", content: trimmed });

    // ---- 1. DM narrates the consequence ----
    gl.setPhase("dm-narrating");
    const dmId = useGameLoopStore.getState().appendEntry({
        kind: "dm",
        speaker: "Мастер Подземелий",
        content: "",
    });
    useGameLoopStore.getState().setActiveStreamId(dmId);

    let dmText = "";
    try {
        dmText = await runDmTurn(priorDmHistory, trimmed, (partial) => {
            useGameLoopStore.getState().updateStreamingEntry(dmId, partial);
        });
    } catch (e) {
        useGameLoopStore.getState().updateStreamingEntry(
            dmId,
            `*Голос рассказчика на мгновение запинается.* (${errMsg(e)})`,
        );
        useGameLoopStore.getState().setActiveStreamId(null);
        useGameLoopStore.getState().setPhase("awaiting-player");
        return;
    }
    useGameLoopStore.getState().setActiveStreamId(null);

    // ---- 2. Mirror DM-voiced quotes into the matching NPC chat histories ----
    const entityNodes = useModelStore.getState().entityNodes;
    const dmQuotes = extractNpcQuotes(dmText, entityNodes);
    mirrorDmQuotesToNpcHistories(dmQuotes);

    // ---- 3. Route: NPCs the player addressed, minus those the DM already voiced ----
    const alreadyVoiced = new Set(dmQuotes.map((q) => q.entityName.toLowerCase()));
    const reacting = selectReactingNpcs(trimmed, entityNodes, alreadyVoiced);

    if (reacting.length > 0) {
        useGameLoopStore.getState().setPhase("npc-reacting");
        // Cue each NPC with the player's action plus a condensed scene beat, so
        // the reaction stays grounded even before beats are promoted to canon.
        const sceneCue = `${trimmed}\n\n[Сцена прямо сейчас: ${condense(dmText)}]`;

        for (const npc of reacting) {
            const npcId = useGameLoopStore.getState().appendEntry({
                kind: "npc",
                speaker: npc.name,
                speakerId: npc.id,
                content: "",
            });
            useGameLoopStore.getState().setActiveStreamId(npcId);

            try {
                const priorHistory = useAgentStore.getState().getHistory(npc.id);
                const reaction = await runNpcDialogue(npc.id, priorHistory, sceneCue, (partial) => {
                    useGameLoopStore.getState().updateStreamingEntry(npcId, partial);
                });
                // Keep the NPC's own chat history continuous (store the clean
                // player input, not the cue) so a later "Talk to" panel resumes.
                useAgentStore.getState().appendUserMessage(npc.id, trimmed);
                useAgentStore.getState().appendAssistantMessage(npc.id, reaction);
            } catch (e) {
                useGameLoopStore.getState().updateStreamingEntry(
                    npcId,
                    `*${npc.name} молчит.* (${errMsg(e)})`,
                );
            }
        }
        useGameLoopStore.getState().setActiveStreamId(null);
    }

    // ---- 4. Back to the player ----
    useGameLoopStore.getState().incrementTurn();
    useGameLoopStore.getState().setPhase("awaiting-player");
}
