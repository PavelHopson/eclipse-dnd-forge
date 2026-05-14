import { Entity, useModelStore } from "../Model";
import { currentModel, currentProvider } from "../../store/useAiConfigStore";

export interface WorldTickEvent {
    id: string;
    tickId: string;
    entityId: string;
    entityName: string;
    action: string;
    consequence?: string;
    /** Truthy if the model refused to emit valid JSON; we keep the raw text for debugging. */
    raw?: string;
    createdAt: number;
}

export interface WorldTickContext {
    entity: Entity;
    sceneText: string;
    others: Entity[];
}

/**
 * The simulation-tick prompt. The agent plays a DM-side world simulator for
 * ONE entity at a time. It must output a JSON object — no prose around it —
 * with `action` (what they did off-screen) and optional `consequence` (a
 * surfaceable side-effect the DM can use later).
 *
 * We deliberately avoid OpenAI-specific structured outputs so the same code
 * path runs on Ollama and Anthropic Claude through `currentProvider()`.
 * Parsing is forgiving: a malformed reply yields a `raw`-only event that
 * the UI surfaces as "parse failed — investigate" rather than crashing the
 * whole tick.
 */
export function buildWorldTickSystemPrompt(ctx: WorldTickContext): string {
    const { entity, sceneText, others } = ctx;

    const traits = entity.properties.map((p) => `${p.name} (${p.value}/10)`).join(", ") || "no notable traits";
    const knowledgeBullets = entity.knowledge && entity.knowledge.length > 0
        ? entity.knowledge.map((k) => `- ${k}`).join("\n")
        : "- (no specific facts on record)";
    const otherList = others
        .filter((e) => e.name !== entity.name)
        .slice(0, 12)
        .map((e) => `- ${e.name}${e.role ? ` (${e.role})` : ""}`)
        .join("\n") || "- (no other named characters in the world)";

    return [
        `You are running an off-screen world-simulation tick for ${entity.name} in a Dungeons & Dragons 5e campaign.`,
        ``,
        `THE CHARACTER YOU ARE SIMULATING:`,
        `- Name: ${entity.name}`,
        `- Role: ${entity.role ?? "unspecified"}`,
        `- Kind: ${entity.kind ?? "unknown"}`,
        `- Traits: ${traits}`,
        `- Goal: ${entity.goal || "(no explicit goal — improvise from role)"}`,
        `- Secret: ${entity.secret || "(none)"}`,
        ``,
        `WHAT THEY KNOW:`,
        knowledgeBullets,
        ``,
        `WORLD SNAPSHOT (current canonical session text):`,
        sceneText.trim() || "(world is just being set up)",
        ``,
        `OTHER NAMED ENTITIES IN THE WORLD:`,
        otherList,
        ``,
        `YOUR JOB:`,
        `Output a SINGLE JSON object — nothing before, nothing after — with these fields:`,
        `  "action":      one short sentence describing what this character did off-screen during the last period (a night, a day, a week — whatever fits the pacing). It MUST advance their goal by one concrete step OR be a plausible character-consistent side-action. No multi-day arcs.`,
        `  "consequence": optional one short sentence describing a surfaceable side-effect the DM can show players later — a rumour, a sighting, a missing item, a new NPC contact, a fresh track. Omit the field entirely if there is nothing the players could plausibly notice.`,
        ``,
        `Examples for tone (do NOT copy them verbatim):`,
        `  {"action":"Toblen paid five gold to the Redbrand he caught in his stable, hoping to keep them away from his daughter.","consequence":"A traveller saw the exchange — rumours are spreading in Thundertree about Toblen's arrangement."}`,
        `  {"action":"Cragmaw goblin scouts dragged a fresh captive deeper into the hideout, leaving heavy tracks on the Triboar Trail.","consequence":"A torn merchant cloak with a noble crest was lost in the drag — anyone on the trail this morning would spot it."}`,
        `  {"action":"Strahd sent a single dire wolf to circle the village of Barovia at dusk, watching Ireena's window.","consequence":"Paw prints too large for an ordinary wolf in the eastern garden."}`,
        ``,
        `RULES:`,
        `- One concrete action. Stay in character voice and stat block (a cleric of Moradin does not steal; a panicked merchant does not assault anyone).`,
        `- No game-mechanic mentions (no rolls, AC, HP, modifiers).`,
        `- The reply MUST be valid JSON parsable by JSON.parse — no markdown fences, no commentary.`,
        `- Match the campaign's language: if scene text is in Russian, write the action and consequence in Russian.`,
    ].join("\n");
}

interface RawTickReply {
    action?: string;
    consequence?: string;
}

/** Best-effort JSON parser. Strips markdown fences if the model still wraps them. */
function tryParseJson(text: string): RawTickReply | null {
    if (!text) return null;
    const stripped = text
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/```\s*$/i, "")
        .trim();
    try {
        const parsed = JSON.parse(stripped);
        if (typeof parsed === "object" && parsed !== null) return parsed as RawTickReply;
    } catch {
        // fall through
    }
    // Fallback: try to extract the first {...} block in case there is prose around it.
    const match = stripped.match(/\{[\s\S]*\}/);
    if (match) {
        try {
            return JSON.parse(match[0]) as RawTickReply;
        } catch {
            return null;
        }
    }
    return null;
}

/** Run a tick for a single entity. Throws only on hard provider failure. */
export async function tickEntity(entity: Entity, entityId: string, tickId: string): Promise<WorldTickEvent> {
    const state = useModelStore.getState();
    const others = state.entityNodes.map((n) => n.data as Entity);

    const systemPrompt = buildWorldTickSystemPrompt({
        entity,
        sceneText: state.text,
        others,
    });

    const { text } = await currentProvider().streamChat(
        [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Simulate one off-screen tick for ${entity.name}.` },
        ],
        {
            model: currentModel(),
            temperature: 0.85,
        },
    );

    const parsed = tryParseJson(text);

    return {
        id: `${tickId}-${entityId}`,
        tickId,
        entityId,
        entityName: entity.name,
        action: parsed?.action?.trim() || "",
        consequence: parsed?.consequence?.trim() || undefined,
        raw: parsed?.action ? undefined : text,
        createdAt: Date.now(),
    };
}

/**
 * Iterate over every entity that has a `goal` field set and run a tick for
 * each. Caller passes `onEventCommitted` so the UI can stream events into
 * its log as they finish (rather than waiting for the whole batch).
 *
 * Concurrency is hard-capped at 3 simultaneous requests to avoid rate-limit
 * cascades on any provider.
 */
export async function runWorldTick(options: {
    onEventCommitted: (event: WorldTickEvent) => void;
    /** Optional caller-supplied tickId. Lets the UI pin the tickId in its
     *  store synchronously before the first event arrives. */
    tickId?: string;
}): Promise<{ tickId: string; events: WorldTickEvent[] }> {
    const tickId = options.tickId ?? `tick-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const state = useModelStore.getState();

    // Only entities with a `goal` are candidates — heroes (PCs) deliberately
    // do not get auto-simulated, even if they have a goal stub.
    const candidates = state.entityNodes.filter((n) => {
        const data = n.data as Entity;
        return (data.kind === "npc" || data.kind === "monster" || data.kind === "faction")
            && typeof data.goal === "string"
            && data.goal.length > 0;
    });

    const events: WorldTickEvent[] = [];
    const queue = [...candidates];
    const concurrency = 3;

    async function worker() {
        while (queue.length > 0) {
            const node = queue.shift();
            if (!node) break;
            try {
                const event = await tickEntity(node.data as Entity, node.id, tickId);
                events.push(event);
                options.onEventCommitted(event);
            } catch (e: any) {
                const failureEvent: WorldTickEvent = {
                    id: `${tickId}-${node.id}-error`,
                    tickId,
                    entityId: node.id,
                    entityName: (node.data as Entity).name,
                    action: "",
                    raw: `(тик не удался: ${e?.message ?? "неизвестная ошибка"})`,
                    createdAt: Date.now(),
                };
                events.push(failureEvent);
                options.onEventCommitted(failureEvent);
            }
        }
    }

    await Promise.all(Array.from({ length: Math.min(concurrency, candidates.length) }, () => worker()));

    return { tickId, events };
}
