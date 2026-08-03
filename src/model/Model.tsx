import { Edge, Node } from '@xyflow/react';
import * as Diff from 'diff';
import OpenAI from 'openai';
import { Descendant, Node as SlateNode } from 'slate';
import { create } from 'zustand';
import { shallow } from 'zustand/shallow';
import { useStudyStore } from '../study/StudyModel';
import { globalEditor } from '../view/TextEditor';
import { useHistoryModelStore } from './HistoryModel';
import { SlateUtils } from './SlateUtils';
import { TextActionMatch, TextUtils } from './TextUtils';

const hashSplitted = window.location.hash.split("?");
const search = hashSplitted[hashSplitted.length-1]
const params = new URLSearchParams(search);
const key = params.get('k');

let openaiKey = ""
if (!key) {
    if ("VITE_OPENAI_API_KEY" in import.meta.env) {
        openaiKey = import.meta.env.VITE_OPENAI_API_KEY;
    } /*else {
        throw new Error("No key provided in the URL parameters");
    }*/
} else {
    openaiKey = atob(key)
}

export const openai = new OpenAI({
    apiKey: openaiKey,
    dangerouslyAllowBrowser: true
});

export interface EntityProperty {
    name: string
    value: number
}

export type EntityKind = "hero" | "npc" | "monster" | "faction" | "unknown";

export interface AbilityScores {
    str?: number
    dex?: number
    con?: number
    int?: number
    wis?: number
    cha?: number
}

export type Entity = {
    name: string
    emoji: string
    properties: EntityProperty[]
    kind?: EntityKind
    role?: string
    abilities?: AbilityScores
    hp?: number
    ac?: number
    cr?: number
    // Agent layer (Living NPCs slice) — all optional, additive on top of the
    // visual graph entity. None of these are exposed in dialogue as raw text;
    // the NpcAgent uses them to shape voice, knowledge, subtext.
    goal?: string          // What this entity wants — drives subtext, never blurted out
    secret?: string        // What this entity hides — never directly revealed
    knowledge?: string[]   // Concrete facts the entity is aware of about the world / scene
}
export type EntityNode = Node<Entity>;

export type Action = {
    name: string
    sourceLocation: string
    targetLocation: string
    passage: string
}
export type ActionEdge = Edge<Action>;

export type LocationKind = "dungeon" | "town" | "wild" | "plane" | "stronghold" | "unknown";

export type Location = {
    name: string
    emoji: string
    kind?: LocationKind
    biome?: string
    danger?: number
}
export type LocationNode = Node<Location>;

const hardcodedText = `Session 1 — The Stonefang Pass

The party arrived at the gates of Phandalin just before dusk. Thalia, a half-elf ranger, scouted the treeline while Bren, a dwarven cleric of Moradin, addressed the worried townsfolk gathered at the Stonehill Inn. Mira, a tiefling rogue, slipped into the market crowd to listen for rumors about the missing caravan.

In the Stonehill common room, the innkeeper Toblen told them that goblin raiders had been seen near the Triboar Trail. A merchant named Linan Swift offered fifty gold pieces for the rescue of his guard captain, Sildar, who had been taken alive into Cragmaw Hideout — a cave warren somewhere in the Neverwinter Wood.

At first light the party rode north. Two miles up the trail they found a dead horse pierced by black-fletched arrows. Thalia spotted goblin tracks leading off into the undergrowth. Mira readied her shortbow. Bren raised the symbol of Moradin and whispered a prayer for the road ahead.`

/**
 * Model
 **/
export interface ModelState {
    entityNodes: EntityNode[];
    locationNodes: LocationNode[];
    actionEdges: ActionEdge[];
    textState: Descendant[];
    text: string;
    suggestModeUntilTimestamp: number;
    selectedNodes: string[];
    selectedEdges: string[];
    textActionMatches: TextActionMatch[];
    isStale: boolean;
    isReadOnly: boolean;

    highlightedActionsSegment: { start: number, end: number } | null;
    filteredActionsSegment: { start: number, end: number } | null;

    highlightedEntities: string[];
}

interface ModelAction {
    reset: () => void;
    getFilteredEntityNodes: (actionFilter: { start: number, end: number } | null) => EntityNode[];
    getFilteredActionEdges: (actionFilter: { start: number, end: number } | null) => ActionEdge[];
    getFilteredLocationNodes: (actionFilter: { start: number, end: number } | null) => LocationNode[];
    setEntityNodes: (nodes: EntityNode[]) => void;
    setActionEdges: (edges: ActionEdge[]) => void;
    setLocationNodes: (nodes: LocationNode[]) => void;
    setTextState: (textState: Descendant[], updateEditor?: boolean, addHistoryNode?: boolean) => void;
    suggestNextTextChanges: () => void;
    acceptSuggestions: () => void;
    rejectSuggestions: () => void;
    isTextSuggested: () => boolean;
    setSelectedNodes: (nodes: string[]) => void;
    setSelectedEdges: (edges: string[]) => void;
    setHighlightedActionsSegment: (startActionId: number | null, endActionId: number | null) => void;
    setFilteredActionsSegment: (startActionId: number | null, endActionId: number | null) => void;
    setHighlightedEntities: (entities: string[]) => void;

    setIsStale: (isStale: boolean) => void;
    setOpenAIKey: (key: string) => void
    setIsReadOnly: (isReadOnly: boolean) => void;
}


function getInitialState() {
    const initialTextState = [
        {
            children: [{
                text: hardcodedText }]
        },
    ]

    const text = SlateUtils.stateToText(initialTextState);

    const initialState: ModelState = {
        entityNodes: [],
        actionEdges: [],
        locationNodes: [],
        suggestModeUntilTimestamp: 0,
        selectedNodes: [],
        selectedEdges: [],
        isStale: true,
        highlightedActionsSegment: null,
        filteredActionsSegment: null,
        highlightedEntities: [],
        textActionMatches: [],
        textState: initialTextState,
        text: text,
        isReadOnly: false
    }

    return initialState;
}

export const useModelStore = create<ModelState & ModelAction>()((set, get) => ({
    ...getInitialState(),
    reset: () => set({ ...getInitialState() }),
    getFilteredEntityNodes: (actionFilter: { start: number, end: number } | null) => {
        if (actionFilter === null || actionFilter.start === 0 && actionFilter.end === get().actionEdges.length - 1) {
            return get().entityNodes;
        }
        // Filter to only keep the nodes that are not filtered out
        const filteredIds = get().getFilteredActionEdges(actionFilter).map((edge) => [edge.source, edge.target]).flat();
        return get().entityNodes.filter((node) => filteredIds.includes(node.id));
    },
    getFilteredActionEdges: (actionFilter: { start: number, end: number } | null) => {
        const startIdx = actionFilter !== null ? Math.min(get().actionEdges.length, actionFilter.start) : 0;
        const endIdx = actionFilter !== null ? Math.min(get().actionEdges.length, actionFilter.end + 1) : get().actionEdges.length;

        return get().actionEdges.slice(startIdx, endIdx);
    },
    getFilteredLocationNodes: (actionFilter: { start: number, end: number } | null) => {
        // Filter to only keep the nodes that are not filtered out
        const filteredLocations = get().getFilteredActionEdges(actionFilter).map((edge) => [edge.data!.sourceLocation, edge.data!.targetLocation]).flat();
        return get().locationNodes.filter((node) => filteredLocations.includes(node.data.name));
    },
    setEntityNodes: (nodes) => {
        set({ entityNodes: nodes })
    },
    setLocationNodes: (nodes) => {
        set({ locationNodes: nodes })
    },
    setActionEdges: (edges) =>  {
        // Find the position of the actions in the text
        const textActionMatches = TextUtils.matchActionsToText(edges.map((edge) => edge.data!), get().text);
        set({ actionEdges: edges, textActionMatches: textActionMatches });
    },
    setTextState: (textState, updateEditor = true, addHistoryNode = true) => {
        const text = SlateUtils.stateToText(textState);
        const isTextDifferent = get().text !== text;

        if (isTextDifferent && get().suggestModeUntilTimestamp > Date.now()) {
            // We are in suggestion mode, we should mark the changes as suggestions
            // Calculate the differences and create the marks
            const differences = Diff.diffWordsWithSpace(get().text, text);
            // Construct the new state that highlights the differences
            const newState: Descendant[] = [];

            for (const difference of differences) {
                if (difference.removed) {
                    newState.push({ text: difference.value, removed: true } as any);
                } else if (difference.added) {
                    newState.push({ text: difference.value, added: true } as any);
                } else {
                    // No modification to this word, it stays the same
                    newState.push({ text: difference.value } as any);
                }
            }

            textState = [{ children: newState, type: "paragraph" } as any];
        }
        
        if (isTextDifferent) {
            // Update the text and the position of the actions in the text (at least do it as best it can)
            const textActionMatches = TextUtils.matchActionsToText(get().actionEdges.map((edge) => edge.data!), text);
            set({ textState: textState, text: text, textActionMatches: textActionMatches, isStale: true });

            if (addHistoryNode) useHistoryModelStore.getState().addHistoryNode(get());
        } else {
            // Only update the state because this one might still be different even if invisibly so
            set({ textState: textState });
        }
        
        if (updateEditor) {
            globalEditor.children = textState
            globalEditor.onChange();
        }
    },
    /**
     * All modifications done to the text in the next 200ms (arbitrary) will be marked as suggestions
     */
    suggestNextTextChanges: () => {
        set({ suggestModeUntilTimestamp: Date.now() + 200 });
    },
    acceptSuggestions: () => {
        let newState = (JSON.parse(JSON.stringify(get().textState))[0] as any)
        newState.children = newState.children.filter((node: any) => node.removed === undefined);
        newState.children = newState.children.map((node: any) => ({ text: node.text }));
        set({ textState: [newState]});
        globalEditor.children = [newState]
        globalEditor.onChange();
    },
    rejectSuggestions: () => {
        let newState = (JSON.parse(JSON.stringify(get().textState))[0] as any)
        newState.children = newState.children.filter((node: any) => node.added === undefined);
        newState.children = newState.children.map((node: any) => ({ text: node.text }));
        set({ textState: [newState]});
        globalEditor.children = [newState]
        globalEditor.onChange();
    },
    isTextSuggested: () => {
        return (get().textState[0] as any).children.some((node: any) => node.removed !== undefined || node.added !== undefined);
    },
    getText: () => {
        return get().textState.map((node: any) => SlateNode.string({ children: node.children.filter((c: any) => c.removed === undefined) })).join("\n");
    },
    setSelectedNodes: (nodes) => {
        if (!shallow(get().selectedNodes, nodes)) {
            set({ selectedNodes: nodes });
        }
    },
    setSelectedEdges: (edges) => {
        if (!shallow(get().selectedEdges, edges)) {
            // Make sure the right edge is selected in the list of edges
            const allEdges = get().actionEdges;
            let modified = false;
            for (const edge of allEdges) {
                edge.selected = false;
                if (edges.includes(edge.id) && !edge.selected) {
                    modified = true;
                    edge.selected = true;
                }
            }
            if (modified) set({ actionEdges: allEdges });
            useStudyStore.getState().logEvent("EDGES_SELECTED", { edges });
            set({ selectedEdges: edges });
        }
    },
    setHighlightedActionsSegment: (startActionId, endActionId) => {
        if (get().highlightedActionsSegment?.start !== startActionId || get().highlightedActionsSegment?.end !== endActionId) {
            set({ highlightedActionsSegment: startActionId !== null && endActionId !== null ? { start: startActionId, end: endActionId } : null });
        }
    },
    setFilteredActionsSegment: (startActionId, endActionId) => {
         // Only modify if different (zustand is not clever enough to do this by itself)
         if (get().filteredActionsSegment?.start !== startActionId || get().filteredActionsSegment?.end !== endActionId) {
            set({ filteredActionsSegment: startActionId !== null && endActionId !== null ? { start: startActionId, end: endActionId } : null });
         }
    },
    setHighlightedEntities: (entities) => {
        set({ highlightedEntities: entities });
    },
    setIsStale: (isStale) => {
        set({ isStale: isStale });
    },
    setOpenAIKey: (key) => {
        openai.apiKey = key;
      },
    setIsReadOnly: (isReadOnly) => {
        set({ isReadOnly: isReadOnly });
    }
}))

