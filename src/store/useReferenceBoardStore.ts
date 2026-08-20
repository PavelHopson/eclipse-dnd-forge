import { create } from "zustand";
import {
    MAX_REFERENCE_ASSETS,
    ReferenceAsset,
    ReferenceBoard,
    ReferenceProjectBible,
    emptyReferenceBoard,
    readReferenceBoard,
    serializeReferenceBoard,
} from "../model/dnd/referenceBoard";

const STORAGE_KEY = "eclipse_dnd_reference_board_v1";

function browserStorage(): Storage | null {
    try {
        return typeof localStorage === "undefined" ? null : localStorage;
    } catch {
        return null;
    }
}

function loadBoard(): { board: ReferenceBoard; error: string | null } {
    const storage = browserStorage();
    if (!storage) return { board: emptyReferenceBoard(), error: null };
    try {
        const raw = storage.getItem(STORAGE_KEY);
        return raw
            ? { board: readReferenceBoard(raw), error: null }
            : { board: emptyReferenceBoard(), error: null };
    } catch {
        return {
            board: emptyReferenceBoard(),
            error: "Сохранённая доска повреждена и не была загружена. Экспортируйте данные до повторного сохранения, если нужна ручная диагностика.",
        };
    }
}

function persistBoard(board: ReferenceBoard): string | null {
    const storage = browserStorage();
    if (!storage) return "Браузер запретил локальное сохранение. Доска останется только до закрытия вкладки.";
    try {
        storage.setItem(STORAGE_KEY, serializeReferenceBoard(board));
        return null;
    } catch {
        return "Не удалось сохранить доску. Удалите тяжёлые preview или освободите место в браузере.";
    }
}

interface ReferenceBoardState {
    board: ReferenceBoard;
    storageError: string | null;
    saveBible: (bible: Omit<ReferenceProjectBible, "updatedAt">) => void;
    saveAsset: (asset: ReferenceAsset) => boolean;
    removeAsset: (assetId: string) => void;
    clearStorageError: () => void;
}

export const useReferenceBoardStore = create<ReferenceBoardState>((set, get) => {
    const initial = loadBoard();
    return {
        board: initial.board,
        storageError: initial.error,
        saveBible: (bible) => {
            const board: ReferenceBoard = {
                ...get().board,
                bible: { ...bible, updatedAt: Date.now() },
            };
            const validated = readReferenceBoard(JSON.stringify(board));
            set({ board: validated, storageError: persistBoard(validated) });
        },
        saveAsset: (asset) => {
            const current = get().board;
            const existingIndex = current.assets.findIndex((item) => item.id === asset.id);
            if (existingIndex < 0 && current.assets.length >= MAX_REFERENCE_ASSETS) {
                set({ storageError: "На доске уже 24 референса. Удалите неактуальный asset перед добавлением нового." });
                return false;
            }
            const assets = existingIndex < 0
                ? [...current.assets, asset]
                : current.assets.map((item) => item.id === asset.id ? asset : item);
            try {
                const board = readReferenceBoard(JSON.stringify({ ...current, assets }));
                set({ board, storageError: persistBoard(board) });
                return true;
            } catch (reason) {
                set({ storageError: reason instanceof Error ? reason.message : "Не удалось проверить reference asset." });
                return false;
            }
        },
        removeAsset: (assetId) => {
            const board = {
                ...get().board,
                assets: get().board.assets.filter((asset) => asset.id !== assetId),
            };
            set({ board, storageError: persistBoard(board) });
        },
        clearStorageError: () => set({ storageError: null }),
    };
});
