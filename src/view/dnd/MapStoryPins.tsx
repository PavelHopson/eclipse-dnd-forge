import { Button } from "@nextui-org/react";
import { MouseEvent, useState } from "react";
import { IoAddCircleOutline, IoEyeOffOutline, IoEyeOutline, IoSaveOutline, IoTrashOutline } from "react-icons/io5";
import { LocationMapAsset } from "../../model/dnd/locationMap";
import {
    MAX_MAP_STORY_PINS_PER_MAP,
    MapStoryPin,
    MapStoryPinKind,
    MapStoryPinVisibility,
    createMapStoryPin,
} from "../../model/dnd/mapStoryPins";
import { useMapStoryPinStore } from "../../store/useMapStoryPinStore";

interface MapStoryPinsProps {
    map: LocationMapAsset;
}

const fieldStyle = {
    width: "100%",
    minHeight: 36,
    border: "1px solid #d8c9a8",
    borderRadius: 8,
    background: "#fffdf7",
    color: "#2a1a1a",
    padding: "7px 9px",
    font: "inherit",
} as const;

const labelStyle = { display: "grid", gap: 5, color: "#514438", fontWeight: 700 } as const;

const kindMeta: Record<MapStoryPinKind, { emoji: string; label: string; color: string }> = {
    scene: { emoji: "✦", label: "Сцена", color: "#315c72" },
    clue: { emoji: "?", label: "Улика", color: "#6b4f9a" },
    danger: { emoji: "!", label: "Опасность", color: "#9a3434" },
    loot: { emoji: "◆", label: "Находка", color: "#8a6518" },
    portal: { emoji: "↗", label: "Переход", color: "#287052" },
};

function createPinId(): string {
    const randomPart = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID().slice(0, 8)
        : Math.random().toString(36).slice(2, 10);
    return `pin-${Date.now().toString(36)}-${randomPart}`;
}

function PinEditor({ pin, onDone }: { pin: MapStoryPin; onDone: () => void }) {
    const [label, setLabel] = useState(pin.label);
    const [note, setNote] = useState(pin.note);
    const [kind, setKind] = useState<MapStoryPinKind>(pin.kind);
    const [visibility, setVisibility] = useState<MapStoryPinVisibility>(pin.visibility);

    const save = () => {
        const didSave = useMapStoryPinStore.getState().savePin({
            ...pin,
            label: label.trim(),
            note: note.trim(),
            kind,
            visibility,
            updatedAt: Date.now(),
        });
        if (didSave) onDone();
    };

    return (
        <section aria-label={`Редактирование метки ${pin.label}`} style={{ display: "grid", gap: 10, border: "1px solid #d8c9a8", borderRadius: 10, padding: 12, background: "#fffaf0" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 9 }}>
                <label style={{ ...labelStyle, gridColumn: "1 / -1" }} htmlFor={`pin-label-${pin.id}`}>
                    Название
                    <input id={`pin-label-${pin.id}`} value={label} maxLength={60} onChange={(event) => setLabel(event.target.value)} style={fieldStyle} />
                </label>
                <label style={labelStyle} htmlFor={`pin-kind-${pin.id}`}>
                    Тип
                    <select id={`pin-kind-${pin.id}`} value={kind} onChange={(event) => setKind(event.target.value as MapStoryPinKind)} style={fieldStyle}>
                        {Object.entries(kindMeta).map(([value, meta]) => <option key={value} value={value}>{meta.emoji} {meta.label}</option>)}
                    </select>
                </label>
                <label style={labelStyle} htmlFor={`pin-visibility-${pin.id}`}>
                    Видимость
                    <select id={`pin-visibility-${pin.id}`} value={visibility} onChange={(event) => setVisibility(event.target.value as MapStoryPinVisibility)} style={fieldStyle}>
                        <option value="gm">Только мастер</option>
                        <option value="table">Можно показать игрокам</option>
                    </select>
                </label>
                <label style={{ ...labelStyle, gridColumn: "1 / -1" }} htmlFor={`pin-note-${pin.id}`}>
                    Заметка
                    <textarea id={`pin-note-${pin.id}`} value={note} maxLength={280} onChange={(event) => setNote(event.target.value)} style={{ ...fieldStyle, minHeight: 76, resize: "vertical" }} />
                </label>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <Button size="sm" variant="light" color="danger" startContent={<IoTrashOutline />} onClick={() => { useMapStoryPinStore.getState().removePin(pin.id); onDone(); }}>
                    Удалить
                </Button>
                <Button size="sm" color="primary" startContent={<IoSaveOutline />} onClick={save} isDisabled={!label.trim()}>
                    Сохранить изменения
                </Button>
            </div>
        </section>
    );
}

export default function MapStoryPins({ map }: MapStoryPinsProps) {
    const library = useMapStoryPinStore((state) => state.library);
    const storageError = useMapStoryPinStore((state) => state.storageError);
    const [viewMode, setViewMode] = useState<"gm" | "table">("gm");
    const [selectedPinId, setSelectedPinId] = useState("");
    const pins = library.pins.filter((pin) => pin.mapId === map.id);
    const visiblePins = viewMode === "gm" ? pins : pins.filter((pin) => pin.visibility === "table");
    const selectedPin = visiblePins.find((pin) => pin.id === selectedPinId);
    const atLimit = pins.length >= MAX_MAP_STORY_PINS_PER_MAP;
    const canEdit = viewMode === "gm" && map.rightsState !== "blocked";

    const addPin = (x: number, y: number) => {
        if (!canEdit || atLimit) return;
        const pin = createMapStoryPin({
            id: createPinId(),
            mapId: map.id,
            x,
            y,
            label: `Точка ${pins.length + 1}`,
            note: "",
            kind: "scene",
            visibility: "gm",
        });
        if (useMapStoryPinStore.getState().savePin(pin)) setSelectedPinId(pin.id);
    };

    const placePin = (event: MouseEvent<HTMLDivElement>) => {
        if (!canEdit || atLimit) return;
        const rect = event.currentTarget.getBoundingClientRect();
        const x = Math.max(0, Math.min(10000, Math.round(((event.clientX - rect.left) / rect.width) * 10000)));
        const y = Math.max(0, Math.min(10000, Math.round(((event.clientY - rect.top) / rect.height) * 10000)));
        addPin(x, y);
    };

    const gridStyle = map.grid.type === "square" ? {
        backgroundImage: "linear-gradient(to right, rgba(255,255,255,.28) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,.28) 1px, transparent 1px)",
        backgroundSize: `${100 / map.grid.widthCells}% ${100 / map.grid.heightCells}%`,
    } : {};

    return (
        <section aria-label={`Сюжетные метки карты ${map.name}`} style={{ display: "grid", gap: 10, border: "1px solid #c9b894", borderRadius: 12, padding: 12, background: "#f6edda" }}>
            <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div>
                    <strong style={{ display: "block" }}>Сюжетные метки · {map.name}</strong>
                    <span style={{ color: "#6b5c4c", fontSize: 12 }}>{pins.length}/{MAX_MAP_STORY_PINS_PER_MAP} · клик по карте добавляет скрытую GM-метку</span>
                </div>
                <div role="group" aria-label="Режим просмотра меток" style={{ display: "flex", gap: 6 }}>
                    <Button size="sm" variant={viewMode === "gm" ? "solid" : "bordered"} color={viewMode === "gm" ? "primary" : "default"} startContent={<IoEyeOffOutline />} onClick={() => { setViewMode("gm"); setSelectedPinId(""); }}>
                        Мастер
                    </Button>
                    <Button size="sm" variant={viewMode === "table" ? "solid" : "bordered"} color={viewMode === "table" ? "primary" : "default"} startContent={<IoEyeOutline />} onClick={() => { setViewMode("table"); setSelectedPinId(""); }}>
                        Игроки
                    </Button>
                </div>
            </header>

            {map.rightsState === "blocked" && (
                <p role="alert" style={{ margin: 0, padding: "9px 10px", borderRadius: 8, background: "#fee2e2", color: "#991b1b" }}>
                    Карта заблокирована rights gate: новые производные метки нельзя добавлять или редактировать.
                </p>
            )}

            <div
                role="group"
                aria-label={`Интерактивная карта ${map.name}`}
                onClick={placePin}
                style={{ position: "relative", overflow: "hidden", borderRadius: 10, border: "1px solid #6e5b44", background: "#17130f", lineHeight: 0, cursor: canEdit && !atLimit ? "crosshair" : "default" }}
            >
                <img src={map.previewDataUrl} alt={`Карта ${map.name}`} draggable={false} style={{ display: "block", width: "100%", height: "auto", userSelect: "none" }} />
                <span aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none", ...gridStyle }} />
                {visiblePins.map((pin) => {
                    const meta = kindMeta[pin.kind];
                    return (
                        <button
                            key={pin.id}
                            type="button"
                            aria-label={`${meta.label}: ${pin.label}${pin.visibility === "gm" ? ", только мастер" : ""}`}
                            title={pin.label}
                            onClick={(event) => { event.stopPropagation(); setSelectedPinId(pin.id); }}
                            style={{
                                position: "absolute",
                                left: `${pin.x / 100}%`,
                                top: `${pin.y / 100}%`,
                                transform: "translate(-50%, -50%)",
                                width: 36,
                                height: 36,
                                borderRadius: "50%",
                                border: selectedPinId === pin.id ? "3px solid #fff" : "2px solid rgba(255,255,255,.86)",
                                boxShadow: "0 2px 8px rgba(0,0,0,.45)",
                                background: meta.color,
                                color: "#fff",
                                fontSize: 16,
                                fontWeight: 900,
                                lineHeight: 1,
                                cursor: "pointer",
                            }}
                        >
                            {meta.emoji}
                        </button>
                    );
                })}
            </div>

            {canEdit && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ color: "#6b5c4c", fontSize: 12 }}>{atLimit ? "Достигнут лимит 32 метки." : "Для клавиатуры метку можно добавить в центр, затем выбрать её на карте."}</span>
                    <Button size="sm" variant="bordered" startContent={<IoAddCircleOutline />} onClick={() => addPin(5000, 5000)} isDisabled={atLimit}>
                        Метка в центре
                    </Button>
                </div>
            )}

            {viewMode === "table" && (
                <p style={{ margin: 0, color: "#6b5c4c", fontSize: 12 }}>
                    Показаны только table-safe метки. Это локальный preview, а не защита доступа или отдельная игровая сессия.
                </p>
            )}

            {visiblePins.length === 0 && (
                <p style={{ margin: 0, padding: "10px 12px", border: "1px dashed #c9b894", borderRadius: 9, color: "#6b5c4c", background: "#fffdf7" }}>
                    {viewMode === "table" ? "Для игроков пока нет открытых меток." : "Добавьте первую сюжетную точку прямо на карте."}
                </p>
            )}

            {selectedPin && viewMode === "gm" && map.rightsState !== "blocked" && (
                <PinEditor key={selectedPin.id} pin={selectedPin} onDone={() => setSelectedPinId("")} />
            )}
            {selectedPin && viewMode === "table" && (
                <article style={{ border: "1px solid #d8c9a8", borderRadius: 9, padding: 10, background: "#fffdf7" }}>
                    <strong>{kindMeta[selectedPin.kind].emoji} {selectedPin.label}</strong>
                    {selectedPin.note && <p style={{ margin: "5px 0 0", color: "#514438" }}>{selectedPin.note}</p>}
                </article>
            )}

            {storageError && <p role="alert" style={{ margin: 0, padding: "9px 10px", borderRadius: 8, background: "#fee2e2", color: "#991b1b" }}>{storageError}</p>}
        </section>
    );
}
