import { create } from "zustand";
import { AgentMessage } from "../model/agents/NpcAgent";

interface AgentState {
    /** Per-entity conversation history, keyed by `EntityNode.id`. */
    histories: Record<string, AgentMessage[]>;
    /** Per-entity "agent is currently streaming a reply" flag. */
    streaming: Record<string, boolean>;

    getHistory(entityId: string): AgentMessage[];
    isStreaming(entityId: string): boolean;
    appendUserMessage(entityId: string, content: string): void;
    appendAssistantMessage(entityId: string, content: string): void;
    /** Mid-stream — overwrite the last assistant message with the running partial. */
    updateAssistantStream(entityId: string, partial: string): void;
    setStreaming(entityId: string, value: boolean): void;
    clearHistory(entityId: string): void;
    clearAll(): void;
}

export const useAgentStore = create<AgentState>((set, get) => ({
    histories: {},
    streaming: {},

    getHistory: (entityId) => get().histories[entityId] ?? [],
    isStreaming: (entityId) => !!get().streaming[entityId],

    appendUserMessage: (entityId, content) => {
        const prev = get().histories[entityId] ?? [];
        set({
            histories: {
                ...get().histories,
                [entityId]: [...prev, { role: "user", content, createdAt: Date.now() }],
            },
        });
    },

    appendAssistantMessage: (entityId, content) => {
        const prev = get().histories[entityId] ?? [];
        set({
            histories: {
                ...get().histories,
                [entityId]: [...prev, { role: "assistant", content, createdAt: Date.now() }],
            },
        });
    },

    updateAssistantStream: (entityId, partial) => {
        const prev = get().histories[entityId] ?? [];
        // If the last message is an assistant stream, replace it; otherwise append.
        if (prev.length > 0 && prev[prev.length - 1].role === "assistant") {
            const next = prev.slice(0, -1);
            next.push({ role: "assistant", content: partial, createdAt: prev[prev.length - 1].createdAt });
            set({
                histories: { ...get().histories, [entityId]: next },
            });
        } else {
            set({
                histories: {
                    ...get().histories,
                    [entityId]: [...prev, { role: "assistant", content: partial, createdAt: Date.now() }],
                },
            });
        }
    },

    setStreaming: (entityId, value) => {
        set({ streaming: { ...get().streaming, [entityId]: value } });
    },

    clearHistory: (entityId) => {
        const { [entityId]: _omit, ...rest } = get().histories;
        const { [entityId]: _omitStream, ...restStream } = get().streaming;
        set({ histories: rest, streaming: restStream });
    },

    clearAll: () => set({ histories: {}, streaming: {} }),
}));
