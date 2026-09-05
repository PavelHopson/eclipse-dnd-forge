import { Button } from "@nextui-org/react";
import { MouseEvent, useState } from "react";
import { IoAddCircleOutline, IoDownloadOutline, IoEyeOffOutline, IoEyeOutline, IoSaveOutline, IoTrashOutline } from "react-icons/io5";
import { LocationMapAsset } from "../../model/dnd/locationMap";
import { MapPlayerHandoutPlan, prepareMapPlayerHandout } from "../../model/dnd/mapPlayerHandout";
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

const kindMeta: Record<MapStoryPinKind, { emoji: string; label: string; color: string }> = {
    scene: { emoji: "✦", label: "Сцена", color: "#315c72" },
    clue: { emoji: "?", label: "Улика", color: "#6b4f9a" },
    danger: { emoji: "!", label: "Опасность", color: "#9a3434" },
    loot: { emoji: "◆", label: "Находка", color: "#8a6518" },
    portal: { emoji: "↗", label: "Переход", color: "#287052" },
};

const handoutSymbol: Record<MapStoryPinKind, string> = {
    scene: "✦",
    clue: "?",
    danger: "!",
    loot: "◆",
    portal: "↗",
};

async function renderPlayerHandout(plan: Extract<MapPlayerHandoutPlan, { state: "ready" }>): Promise<Blob> {
    const image = new Image();
    image.decoding = "async";
    image.src = plan.previewDataUrl;
    await image.decode();

    const ratio = Math.min(1, 1800 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Браузер не смог подготовить player handout.");

    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    if (plan.grid.type === "square") {
        context.save();
        context.strokeStyle = "rgba(255, 255, 255, 0.26)";
        context.lineWidth = Math.max(0.5, Math.min(canvas.width, canvas.height) / 1200);
        for (let column = 0; column <= plan.grid.widthCells; column += 1) {
            const x = (column / plan.grid.widthCells) * canvas.width;
            context.beginPath();
            context.moveTo(x, 0);
            context.lineTo(x, canvas.height);
            context.stroke();
        }
        for (let row = 0; row <= plan.grid.heightCells; row += 1) {
            const y = (row / plan.grid.heightCells) * canvas.height;
            context.beginPath();
            context.moveTo(0, y);
            context.lineTo(canvas.width, y);
            context.stroke();
        }
        context.restore();
    }

    const markerRadius = Math.max(12, Math.min(24, Math.min(canvas.width, canvas.height) * 0.025));
    const fontSize = Math.max(13, Math.round(markerRadius * 0.9));
    context.font = `700 ${fontSize}px sans-serif`;
    context.textBaseline = "middle";
    for (const pin of plan.pins) {
        const x = (pin.x / 10000) * canvas.width;
        const y = (pin.y / 10000) * canvas.height;
        context.beginPath();
        context.arc(x, y, markerRadius, 0, Math.PI * 2);
        context.fillStyle = kindMeta[pin.kind].color;
        context.fill();
        context.lineWidth = 2;
        context.strokeStyle = "#ffffff";
        context.stroke();
        context.fillStyle = "#ffffff";
        context.textAlign = "center";
        context.fillText(handoutSymbol[pin.kind], x, y + 1);

        const padding = 6;
        const maxLabelWidth = canvas.width * 0.34;
        const labelWidth = Math.min(context.measureText(pin.label).width, maxLabelWidth);
        const labelX = Math.min(canvas.width - labelWidth - padding * 2, x + markerRadius + 5);
        const labelY = Math.max(fontSize, Math.min(canvas.height - fontSize, y));
        context.fillStyle = "rgba(23, 19, 15, 0.82)";
        context.fillRect(labelX, labelY - fontSize, labelWidth + padding * 2, fontSize * 2);
        context.fillStyle = "#ffffff";
        context.textAlign = "left";
        context.fillText(pin.label, labelX + padding, labelY, maxLabelWidth);
    }

    return await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Не удалось создать PNG handout.")), "image/png");
    });
}

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
        <section aria-label={`Редактирование метки ${pin.label}`} className="map-pin-editor">
            <div className="map-pin-editor-grid">
                <label className="map-field map-field-wide" htmlFor={`pin-label-${pin.id}`}>
                    Название
                    <input id={`pin-label-${pin.id}`} value={label} maxLength={60} onChange={(event) => setLabel(event.target.value)} />
                </label>
                <label className="map-field" htmlFor={`pin-kind-${pin.id}`}>
                    Тип
                    <select id={`pin-kind-${pin.id}`} value={kind} onChange={(event) => setKind(event.target.value as MapStoryPinKind)}>
                        {Object.entries(kindMeta).map(([value, meta]) => <option key={value} value={value}>{meta.emoji} {meta.label}</option>)}
                    </select>
                </label>
                <label className="map-field" htmlFor={`pin-visibility-${pin.id}`}>
                    Видимость
                    <select id={`pin-visibility-${pin.id}`} value={visibility} onChange={(event) => setVisibility(event.target.value as MapStoryPinVisibility)}>
                        <option value="gm">Только мастер</option>
                        <option value="table">Можно показать игрокам</option>
                    </select>
                </label>
                <label className="map-field map-field-wide" htmlFor={`pin-note-${pin.id}`}>
                    Заметка
                    <textarea id={`pin-note-${pin.id}`} value={note} maxLength={280} onChange={(event) => setNote(event.target.value)} />
                </label>
            </div>
            <div className="map-pin-editor-actions">
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
    const [isExporting, setIsExporting] = useState(false);
    const [exportError, setExportError] = useState<string | null>(null);
    const [exportFeedback, setExportFeedback] = useState<string | null>(null);
    const pins = library.pins.filter((pin) => pin.mapId === map.id);
    const visiblePins = viewMode === "gm" ? pins : pins.filter((pin) => pin.visibility === "table");
    const selectedPin = visiblePins.find((pin) => pin.id === selectedPinId);
    const atLimit = pins.length >= MAX_MAP_STORY_PINS_PER_MAP;
    const canEdit = viewMode === "gm" && map.rightsState !== "blocked";
    const handoutPlan = prepareMapPlayerHandout(map, pins);

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

    const exportPlayerHandout = async () => {
        if (handoutPlan.state !== "ready") return;
        setIsExporting(true);
        setExportError(null);
        setExportFeedback(null);
        try {
            const blob = await renderPlayerHandout(handoutPlan);
            const objectUrl = URL.createObjectURL(blob);
            const anchor = document.createElement("a");
            anchor.href = objectUrl;
            anchor.download = handoutPlan.fileName;
            anchor.rel = "noopener";
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
            setExportFeedback(`PNG сохранён без GM-меток и заметок: ${handoutPlan.fileName}`);
        } catch (reason) {
            setExportError(reason instanceof Error ? reason.message : "Не удалось создать player handout.");
        } finally {
            setIsExporting(false);
        }
    };

    const gridStyle = map.grid.type === "square" ? {
        backgroundImage: "linear-gradient(to right, rgba(255,255,255,.28) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,.28) 1px, transparent 1px)",
        backgroundSize: `${100 / map.grid.widthCells}% ${100 / map.grid.heightCells}%`,
    } : {};

    return (
        <section aria-label={`Сюжетные метки карты ${map.name}`} className="map-story-workspace">
            <header className="map-story-header">
                <div>
                    <strong>Сюжетные метки · {map.name}</strong>
                    <span>{pins.length}/{MAX_MAP_STORY_PINS_PER_MAP} · клик по карте добавляет скрытую GM-метку</span>
                </div>
                <div role="group" aria-label="Режим просмотра меток" className="map-story-view-switch">
                    <Button size="sm" variant={viewMode === "gm" ? "solid" : "bordered"} color={viewMode === "gm" ? "primary" : "default"} startContent={<IoEyeOffOutline />} onClick={() => { setViewMode("gm"); setSelectedPinId(""); }}>
                        Мастер
                    </Button>
                    <Button size="sm" variant={viewMode === "table" ? "solid" : "bordered"} color={viewMode === "table" ? "primary" : "default"} startContent={<IoEyeOutline />} onClick={() => { setViewMode("table"); setSelectedPinId(""); }}>
                        Игроки
                    </Button>
                </div>
            </header>

            {map.rightsState === "blocked" && (
                <p role="alert" className="map-message is-error">
                    Карта заблокирована проверкой прав: новые производные метки нельзя добавлять или редактировать.
                </p>
            )}

            <div
                role="group"
                aria-label={`Интерактивная карта ${map.name}`}
                onClick={placePin}
                className="map-story-board"
                style={{ cursor: canEdit && !atLimit ? "crosshair" : "default" }}
            >
                <img src={map.previewDataUrl} alt={`Карта ${map.name}`} draggable={false} />
                <span className="map-story-grid" aria-hidden="true" style={gridStyle} />
                {visiblePins.map((pin) => {
                    const meta = kindMeta[pin.kind];
                    return (
                        <button
                            key={pin.id}
                            type="button"
                            aria-label={`${meta.label}: ${pin.label}${pin.visibility === "gm" ? ", только мастер" : ""}`}
                            title={pin.label}
                            onClick={(event) => { event.stopPropagation(); setSelectedPinId(pin.id); }}
                            className={`map-story-marker${selectedPinId === pin.id ? " is-selected" : ""}`}
                            style={{
                                left: `${pin.x / 100}%`,
                                top: `${pin.y / 100}%`,
                                background: meta.color,
                            }}
                        >
                            {meta.emoji}
                        </button>
                    );
                })}
            </div>

            {canEdit && (
                <div className="map-story-controls">
                    <span>{atLimit ? "Достигнут лимит 32 метки." : "Для клавиатуры метку можно добавить в центр, затем выбрать её на карте."}</span>
                    <Button size="sm" variant="bordered" startContent={<IoAddCircleOutline />} onClick={() => addPin(5000, 5000)} isDisabled={atLimit}>
                        Метка в центре
                    </Button>
                </div>
            )}

            {viewMode === "table" && (
                <div className="map-player-export">
                    <p>
                        Показаны только метки, разрешённые для игроков. Это локальный предпросмотр, а не защита доступа или отдельная игровая сессия.
                    </p>
                    {handoutPlan.state === "ready" ? (
                        <Button color="primary" startContent={isExporting ? undefined : <IoDownloadOutline />} isLoading={isExporting} onClick={() => void exportPlayerHandout()}>
                            Скачать PNG для игроков
                        </Button>
                    ) : (
                        <p role="status" className={`map-message ${handoutPlan.reason === "rights-blocked" ? "is-error" : "is-review"}`}>
                            Экспорт закрыт: {handoutPlan.reason === "rights-blocked" ? "карта заблокирована проверкой прав" : "права карты требуют ручной проверки"}.
                        </p>
                    )}
                    {exportError && <p role="alert" className="map-message is-error">{exportError}</p>}
                    {exportFeedback && <p aria-live="polite" className="map-message is-success">{exportFeedback}</p>}
                </div>
            )}

            {visiblePins.length === 0 && (
                <p className="map-empty-state">
                    {viewMode === "table" ? "Для игроков пока нет открытых меток." : "Добавьте первую сюжетную точку прямо на карте."}
                </p>
            )}

            {selectedPin && viewMode === "gm" && map.rightsState !== "blocked" && (
                <PinEditor key={selectedPin.id} pin={selectedPin} onDone={() => setSelectedPinId("")} />
            )}
            {selectedPin && viewMode === "table" && (
                <article className="map-pin-editor map-table-pin-preview">
                    <strong>{kindMeta[selectedPin.kind].emoji} {selectedPin.label}</strong>
                    {selectedPin.note && <p>{selectedPin.note}</p>}
                </article>
            )}

            {storageError && <p role="alert" className="map-message is-error">{storageError}</p>}
        </section>
    );
}
