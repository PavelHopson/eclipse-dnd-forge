import { create } from "zustand";
import { campaignRepository, campaignResourceStorage } from "../model/dnd/campaignStorage";
import {
    MAX_MAP_STORY_PINS,
    MapStoryPin,
    MapStoryPinLibrary,
    emptyMapStoryPinLibrary,
    readMapStoryPinLibrary,
    serializeMapStoryPinLibrary,
} from "../model/dnd/mapStoryPins";

const STORAGE_KEY = "eclipse_map_story_pins_v1";

function browserStorage(): Pick<Storage, "getItem" | "setItem"> | null {
    try {
        return campaignResourceStorage;
    } catch {
        return null;
    }
}

function loadLibrary(): { library: MapStoryPinLibrary; error: string | null } {
    const storage = browserStorage();
    if (!storage) return { library: emptyMapStoryPinLibrary(), error: null };
    try {
        const raw = storage.getItem(STORAGE_KEY);
        return raw
            ? { library: readMapStoryPinLibrary(raw), error: null }
            : { library: emptyMapStoryPinLibrary(), error: null };
    } catch {
        campaignRepository().blockResource(STORAGE_KEY);
        return {
            library: emptyMapStoryPinLibrary(),
            error: "Сохранённые сюжетные метки повреждены и не были загружены.",
        };
    }
}

function persistLibrary(library: MapStoryPinLibrary): string | null {
    const storage = browserStorage();
    if (!storage) return "Браузер запретил локальное сохранение сюжетных меток.";
    try {
        storage.setItem(STORAGE_KEY, serializeMapStoryPinLibrary(library));
        return null;
    } catch {
        return "Не удалось сохранить сюжетные метки. Освободите место в браузере.";
    }
}

interface MapStoryPinState {
    library: MapStoryPinLibrary;
    storageError: string | null;
    savePin: (pin: MapStoryPin) => boolean;
    removePin: (pinId: string) => void;
    removePinsForMap: (mapId: string) => void;
    clearStorageError: () => void;
}

export const useMapStoryPinStore = create<MapStoryPinState>((set, get) => {
    const initial = loadLibrary();

    const commitPins = (pins: MapStoryPin[]): boolean => {
        try {
            const library = readMapStoryPinLibrary(JSON.stringify({
                schemaVersion: get().library.schemaVersion,
                pins,
            }));
            const storageError = persistLibrary(library);
            set(storageError ? { storageError } : { library, storageError: null });
            return storageError === null;
        } catch (reason) {
            set({ storageError: reason instanceof Error ? reason.message : "Не удалось проверить сюжетные метки." });
            return false;
        }
    };

    return {
        library: initial.library,
        storageError: initial.error,
        savePin: (pin) => {
            const current = get().library;
            const existingIndex = current.pins.findIndex((item) => item.id === pin.id);
            if (existingIndex < 0 && current.pins.length >= MAX_MAP_STORY_PINS) {
                set({ storageError: "В кампании уже 128 сюжетных меток. Удалите неактуальную перед добавлением новой." });
                return false;
            }
            const pins = existingIndex < 0
                ? [...current.pins, pin]
                : current.pins.map((item) => item.id === pin.id ? pin : item);
            return commitPins(pins);
        },
        removePin: (pinId) => {
            commitPins(get().library.pins.filter((pin) => pin.id !== pinId));
        },
        removePinsForMap: (mapId) => {
            commitPins(get().library.pins.filter((pin) => pin.mapId !== mapId));
        },
        clearStorageError: () => set({ storageError: null }),
    };
});
