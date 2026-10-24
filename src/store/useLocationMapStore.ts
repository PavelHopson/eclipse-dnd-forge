import { create } from "zustand";
import { campaignRepository, campaignResourceStorage } from "../model/dnd/campaignStorage";
import { emptyMapStoryPinLibrary, readMapStoryPinLibrary, serializeMapStoryPinLibrary } from "../model/dnd/mapStoryPins";
import { useMapStoryPinStore } from "./useMapStoryPinStore";
import {
    LocationMapAsset,
    LocationMapLibrary,
    MAX_LOCATION_MAPS,
    emptyLocationMapLibrary,
    readLocationMapLibrary,
    serializeLocationMapLibrary,
} from "../model/dnd/locationMap";

const STORAGE_KEY = "eclipse_location_maps_v1";

function browserStorage(): Pick<Storage, "getItem" | "setItem"> | null {
    try {
        return campaignResourceStorage;
    } catch {
        return null;
    }
}

function loadLibrary(): { library: LocationMapLibrary; error: string | null } {
    const storage = browserStorage();
    if (!storage) return { library: emptyLocationMapLibrary(), error: null };
    try {
        const raw = storage.getItem(STORAGE_KEY);
        return raw
            ? { library: readLocationMapLibrary(raw), error: null }
            : { library: emptyLocationMapLibrary(), error: null };
    } catch {
        campaignRepository().blockResource(STORAGE_KEY);
        return {
            library: emptyLocationMapLibrary(),
            error: "Сохранённые карты повреждены и не были загружены.",
        };
    }
}

function persistLibrary(library: LocationMapLibrary): string | null {
    const storage = browserStorage();
    if (!storage) return "Браузер запретил локальное сохранение. Карты останутся только до закрытия вкладки.";
    try {
        storage.setItem(STORAGE_KEY, serializeLocationMapLibrary(library));
        return null;
    } catch {
        return "Не удалось сохранить preview. Удалите неактуальную карту или освободите место в браузере.";
    }
}

interface LocationMapState {
    library: LocationMapLibrary;
    storageError: string | null;
    saveMap: (map: LocationMapAsset) => boolean;
    removeMap: (mapId: string) => boolean;
    clearStorageError: () => void;
}

export const useLocationMapStore = create<LocationMapState>((set, get) => {
    const initial = loadLibrary();
    return {
        library: initial.library,
        storageError: initial.error,
        saveMap: (map) => {
            const current = get().library;
            const existingIndex = current.maps.findIndex((item) => item.id === map.id);
            if (existingIndex < 0 && current.maps.length >= MAX_LOCATION_MAPS) {
                set({ storageError: "В библиотеке уже 8 карт. Удалите неактуальную карту перед добавлением новой." });
                return false;
            }
            const maps = existingIndex < 0
                ? [...current.maps, map]
                : current.maps.map((item) => item.id === map.id ? map : item);
            try {
                const library = readLocationMapLibrary(JSON.stringify({ ...current, maps }));
                const storageError = persistLibrary(library);
                set(storageError ? { storageError } : { library, storageError: null });
                return storageError === null;
            } catch (reason) {
                set({ storageError: reason instanceof Error ? reason.message : "Не удалось проверить карту." });
                return false;
            }
        },
        removeMap: (mapId) => {
            try {
                const repo = campaignRepository();
                const mapsRaw = repo.readResource(STORAGE_KEY);
                const pinsKey = "eclipse_map_story_pins_v1";
                const pinsRaw = repo.readResource(pinsKey);
                // Read both durable resources, never replace a damaged library with an empty store.
                const maps = mapsRaw === null ? emptyLocationMapLibrary() : readLocationMapLibrary(mapsRaw);
                const pins = pinsRaw === null ? emptyMapStoryPinLibrary() : readMapStoryPinLibrary(pinsRaw);
                const library = { ...maps, maps: maps.maps.filter((map) => map.id !== mapId) };
                const pinLibrary = { ...pins, pins: pins.pins.filter((pin) => pin.mapId !== mapId) };
                repo.writeResources({
                    [STORAGE_KEY]: serializeLocationMapLibrary(library),
                    [pinsKey]: serializeMapStoryPinLibrary(pinLibrary),
                });
                // No optimistic removal or compensating second write after a failed commit.
                useMapStoryPinStore.setState({ library: pinLibrary, storageError: null });
                set({ library, storageError: null });
                return true;
            } catch {
                set({ storageError: "Не удалось удалить карту и её метки. Данные не изменены. Повторите удаление после устранения ошибки хранения." });
                return false;
            }
        },
        clearStorageError: () => set({ storageError: null }),
    };
});
