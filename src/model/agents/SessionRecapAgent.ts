import { currentModel, currentProvider } from "../../store/useAiConfigStore";

/**
 * Generate a 2-4 sentence recap of the session text. Used when ending a
 * session — the recap is archived and surfaced both in the Sessions panel
 * and folded into the DM agent's system prompt as "PREVIOUSLY" context.
 *
 * Plain text streaming, no structured outputs — recap shape doesn't need
 * fields, and we want the model to write in the campaign's natural voice.
 */
export async function generateSessionRecap(sessionText: string, sessionName?: string): Promise<string> {
    const trimmed = sessionText.trim();
    if (!trimmed) return "";

    const sysPrompt = [
        `You are summarising the just-ended chapter of a Dungeons & Dragons campaign for a DM recap log.`,
        ``,
        `RULES:`,
        `- 2-4 sentences. Tight. Past tense.`,
        `- Cover: where the party went, what they accomplished, what's unresolved, who's still owed something.`,
        `- Name NPCs by name when they mattered.`,
        `- Do NOT invent new events. Only recap what is written.`,
        `- Match the language of the session text. If it's in Russian, recap in Russian.`,
        `- Do NOT include a header, label, or "Recap:" prefix. Reply with the recap sentences directly.`,
    ].join("\n");

    const userPrompt = [
        sessionName ? `SESSION: ${sessionName}` : null,
        `SESSION TEXT:`,
        trimmed,
        ``,
        `Write the recap.`,
    ].filter(Boolean).join("\n");

    const { text } = await (await currentProvider()).streamChat(
        [
            { role: "system", content: sysPrompt },
            { role: "user", content: userPrompt },
        ],
        { model: currentModel(), temperature: 0.4 },
    );

    return text.trim();
}
