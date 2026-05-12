import { Descendant, Transforms } from "slate";
import { useModelStore } from "../Model";
import { globalEditor } from "../../view/TextEditor";

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

/**
 * Insert a chunk of text at the current Slate cursor position, wrapped in
 * blank lines so it reads as its own paragraph. Falls back to append-at-end
 * if there is no live editor selection (e.g. the editor has not yet been
 * focused).
 *
 * The Slate editor in this codebase normalises to a single root paragraph
 * with embedded \n separators (see `globalEditor.normalizeNode` in
 * TextEditor.tsx), so "new paragraph" is really "newline + text + newline"
 * inside the same paragraph node. Transforms.insertText handles that.
 *
 * Slate's onChange fires after the transform → setTextState propagates the
 * new state into the model (undo/redo and visual-refresh staleness both
 * keep working).
 */
export function insertTextAtCursor(text: string): void {
    const trimmed = text.trim();
    if (!trimmed) return;

    if (!globalEditor.selection) {
        appendParagraphToSession(trimmed);
        return;
    }

    Transforms.insertText(globalEditor, `\n\n${trimmed}\n`, { at: globalEditor.selection });
}

/**
 * Like `appendNpcQuoteToSession`, but at the cursor. Falls back to append.
 */
export function insertNpcQuoteAtCursor(speakerName: string, text: string): void {
    const trimmed = text.trim();
    if (!trimmed) return;
    insertTextAtCursor(`**${speakerName}:** ${trimmed}`);
}
