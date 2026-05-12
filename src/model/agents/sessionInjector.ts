import { Descendant } from "slate";
import { useModelStore } from "../Model";

/**
 * Append a chunk of text to the current Slate-backed session text as a new
 * paragraph. Used by the "Insert into session" buttons across the AI agent
 * panels (NPC dialogue replies, DM narration, NPC generator hooks).
 *
 * The text is added at the end. Slate's editor and history both update via
 * the existing `setTextState` path, so this naturally participates in
 * undo/redo and the visual refresher's "stale" tracking.
 */
export function appendParagraphToSession(text: string): void {
    const trimmed = text.trim();
    if (!trimmed) return;

    const current = useModelStore.getState().textState;
    const newParagraph: Descendant = { children: [{ text: trimmed }] } as any;
    const next: Descendant[] = [...current, newParagraph];

    useModelStore.getState().setTextState(next, true, true);
}

/**
 * Append a quoted NPC reply, prefixed with the speaker's name in bold-style
 * markdown so it reads naturally inside the session text once promoted.
 *
 * Example output paragraph:
 *   **Toblen Stonehill:** *Pours an ale.* "Aye, three nights ago a streak of fire..."
 */
export function appendNpcQuoteToSession(speakerName: string, text: string): void {
    const trimmed = text.trim();
    if (!trimmed) return;
    appendParagraphToSession(`**${speakerName}:** ${trimmed}`);
}
