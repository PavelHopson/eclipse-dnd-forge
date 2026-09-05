import { create } from "zustand";
import { campaignRepository, campaignResourceStorage } from "../model/dnd/campaignStorage";
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
            const library = readLocationMapLibrary(JSON.stringify({
                ...get().library,
                maps: get().library.maps.filter((map) => map.id !== mapId),
            }));
            const storageError = persistLibrary(library);
            set(storageError ? { storageError } : { library, storageError: null });
            return storageError === null;
        },
        clearStorageError: () => set({ storageError: null }),
    };
});
