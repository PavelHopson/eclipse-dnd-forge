import { Button } from "@nextui-org/react";
import { ChangeEvent, KeyboardEvent, PointerEvent as ReactPointerEvent, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { IoArrowRedoOutline, IoArrowUndoOutline, IoClose, IoExitOutline, IoDownloadOutline, IoTrashOutline, IoHandLeftOutline, IoSquareOutline, IoRemoveOutline, IoMoveOutline, IoExpandOutline, IoSettingsOutline, IoArrowUpOutline, IoArrowDownOutline, IoArrowBackOutline, IoArrowForwardOutline } from "react-icons/io5";
import { campaignRepository, campaignResourceStorage } from "../../model/dnd/campaignStorage";
import {
    AtlasLayer,
    atlasLayers, atlasVisibleShapes, atlasEditableShapes, shapeLayerId, BASE_ATLAS_LAYER_ID,
    LivingAtlasDocument,
    LivingAtlasShape,
    LivingAtlasTool,
    MAX_LIVING_ATLAS_FILE_BYTES,
    MAX_LIVING_ATLAS_SHAPES,
    createEmptyLivingAtlasDocument,
    createLivingAtlasId,
    readLivingAtlasDocument,
    safeLivingAtlasFileStem,
    serializeLivingAtlasDocument,
} from "../../model/dnd/livingAtlas";

import AtlasFloorLayer from "./AtlasFloorLayer";
import AtlasLayerPanel from "./AtlasLayerPanel";
import { AtlasResizeFields, AtlasResizeHandles } from "./AtlasResizeControls";
import { resizeAtlasShape, selectAtlasRectangle, selectionBounds, transferAtlasSelection, translateAtlasSelection } from "../../model/dnd/atlasEditing";
import type { AtlasResizeHandle } from "../../model/dnd/atlasEditing";
import { ATLAS_CELL_SIZE as CELL_SIZE, atlasWallWidth } from "../../model/dnd/atlasGeometry";
import type { IconType } from "react-icons";
const HISTORY_LIMIT = 50;
const DRAFT_STORAGE_KEY = "eclivarium_living_atlas_draft_v1";

interface LivingAtlasEditorProps {
    locationId: string;
    initialName: string;
    initialDocument?: LivingAtlasDocument;
    mapId?: string;
    savedDocumentIds?: string[];
    onClose: () => void;
    onUsePreview: (result: { previewDataUrl: string; name: string; fileName: string; widthCells: number; heightCells: number; document: LivingAtlasDocument }) => void;
}

type GridPoint = { x: number; y: number };
type PointerSession =
    | { mode: "pan"; clientX: number; clientY: number; left: number; top: number; pointerId: number }
    | { mode: "draw"; start: GridPoint; current: GridPoint; pointerId: number }
    | { mode: "move"; ids: string[]; start: GridPoint; current: GridPoint; pointerId: number }
    | { mode: "marquee"; start: GridPoint; current: GridPoint; baseIds: string[]; pointerId: number }
    | { mode: "resize"; shapeId: string; handle: AtlasResizeHandle; current: GridPoint; pointerId: number };

const toolMeta: Array<{ tool: LivingAtlasTool; icon: IconType; label: string; hint: string }> = [
    { tool: "select", icon: IoMoveOutline, label: "Выбор", hint: "Выберите и переместите объект" },
    { tool: "room", icon: IoSquareOutline, label: "Комната", hint: "Протяните прямоугольник" },
    { tool: "corridor", icon: IoRemoveOutline, label: "Коридор", hint: "Соедините комнаты проходом" },
    { tool: "wall", icon: IoRemoveOutline, label: "Стена", hint: "Проведите линию стены" },
    { tool: "door", icon: IoExitOutline, label: "Дверь", hint: "Поставьте дверь на стену" },
    { tool: "pan", icon: IoHandLeftOutline, label: "Сдвиг", hint: "Перетащите холст" },
];

const shapeLabels: Record<LivingAtlasShape["kind"], string> = {
    room: "Комната", corridor: "Коридор", wall: "Стена", door: "Дверь",
};

function loadLocalDraft(initialName: string, storageKey: string, initialDocument?: LivingAtlasDocument, savedDocumentIds: string[] = []): LivingAtlasDocument {
    try {
        const raw = campaignResourceStorage.getItem(storageKey);
        const draft = raw ? readLivingAtlasDocument(raw) : undefined;
        if (draft && (initialDocument ? draft.updatedAt > initialDocument.updatedAt : !savedDocumentIds.includes(draft.id))) return draft;
        return initialDocument ?? createEmptyLivingAtlasDocument(initialName || "Новая карта");
    } catch {
        campaignRepository().blockResource(storageKey);
        return initialDocument ?? createEmptyLivingAtlasDocument(initialName || "Новая карта");
    }
}

function clamp(value: number, minimum: number, maximum: number): number {
    return Math.max(minimum, Math.min(maximum, value));
}

function pointFromPointer(svg: SVGSVGElement, clientX: number, clientY: number, atlas: LivingAtlasDocument): GridPoint {
    const rect = svg.getBoundingClientRect();
    return {
        x: clamp(Math.round(((clientX - rect.left) / rect.width) * atlas.widthCells), 0, atlas.widthCells),
        y: clamp(Math.round(((clientY - rect.top) / rect.height) * atlas.heightCells), 0, atlas.heightCells),
    };
}

function createShape(tool: Exclude<LivingAtlasTool, "select" | "pan">, start: GridPoint, end: GridPoint, width: number, rotation: 0 | 90, atlas: LivingAtlasDocument): LivingAtlasShape | null {
    if (tool === "door") return { id: createLivingAtlasId("door"), kind: "door", x: end.x, y: end.y, rotation };
    if (tool === "room") {
        const x = Math.min(Math.min(start.x, end.x), atlas.widthCells - 1);
        const y = Math.min(Math.min(start.y, end.y), atlas.heightCells - 1);
        return {
            id: createLivingAtlasId("room"), kind: "room", x, y,
            width: Math.min(Math.max(1, Math.abs(end.x - start.x)), atlas.widthCells - x),
            height: Math.min(Math.max(1, Math.abs(end.y - start.y)), atlas.heightCells - y),
        };
    }
    if (start.x === end.x && start.y === end.y) return null;
    return { id: createLivingAtlasId(tool), kind: tool, x1: start.x, y1: start.y, x2: end.x, y2: end.y, width: tool === "corridor" ? width : 1 };
}

function downloadBlob(blob: Blob, fileName: string) {
    const url = URL.createObjectURL(blob);
    const anchor = window.document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.rel = "noopener";
    window.document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function dataUrlToBlob(dataUrl: string): Blob {
    const [header, payload = ""] = dataUrl.split(",", 2);
    const mime = /^data:([^;]+);base64$/.exec(header)?.[1];
    if (!mime) throw new Error("Не удалось проверить экспортированное изображение.");
    const bytes = Uint8Array.from(atob(payload), (character) => character.charCodeAt(0));
    return new Blob([bytes], { type: mime });
}

async function rasterizeAtlas(svg: SVGSVGElement, atlas: LivingAtlasDocument, mime: "image/png" | "image/webp", maxSide: number): Promise<string> {
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.querySelectorAll("[data-ui-only='true']").forEach((node) => node.remove());
    clone.setAttribute("width", String(atlas.widthCells * CELL_SIZE));
    clone.setAttribute("height", String(atlas.heightCells * CELL_SIZE));
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const source = new XMLSerializer().serializeToString(clone);
    const url = URL.createObjectURL(new Blob([source], { type: "image/svg+xml" }));
    try {
        const image = new Image();
        image.decoding = "async";
        image.src = url;
        await image.decode();
        const baseWidth = atlas.widthCells * CELL_SIZE;
        const baseHeight = atlas.heightCells * CELL_SIZE;
        const ratio = Math.min(1, maxSide / Math.max(baseWidth, baseHeight));
        const canvas = window.document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(baseWidth * ratio));
        canvas.height = Math.max(1, Math.round(baseHeight * ratio));
        const context = canvas.getContext("2d", { alpha: false });
        if (!context) throw new Error("Браузер не смог подготовить изображение карты.");
        context.fillStyle = "#f4efdf";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL(mime, mime === "image/webp" ? 0.82 : undefined);
    } finally {
        URL.revokeObjectURL(url);
    }
}

/** Transparent hit targets are UI-only: exported geometry is rendered once by AtlasFloorLayer. */
function ShapeView({ shape, selected, onPointerDown }: {
    shape: LivingAtlasShape; selected: boolean; onPointerDown: (event: ReactPointerEvent<SVGElement>) => void;
}) {
    const stroke = selected ? "#2f7fe5" : "transparent";
    if (shape.kind === "room") return <rect data-ui-only="true" className="atlas-shape" data-shape-id={shape.id} x={shape.x * CELL_SIZE} y={shape.y * CELL_SIZE}
        width={shape.width * CELL_SIZE} height={shape.height * CELL_SIZE} fill="transparent" stroke={stroke} strokeWidth="4" strokeDasharray="8 5" onPointerDown={onPointerDown} />;
    if (shape.kind === "door") return <rect data-ui-only="true" className="atlas-shape" data-shape-id={shape.id}
        transform={`translate(${shape.x * CELL_SIZE} ${shape.y * CELL_SIZE}) rotate(${shape.rotation})`}
        x="-23" y="-15" width="46" height="30" fill="transparent" stroke={stroke} strokeWidth="3" onPointerDown={onPointerDown} />;
    return <g data-ui-only="true" className="atlas-shape" data-shape-id={shape.id} onPointerDown={onPointerDown}>
        <line x1={shape.x1 * CELL_SIZE} y1={shape.y1 * CELL_SIZE} x2={shape.x2 * CELL_SIZE} y2={shape.y2 * CELL_SIZE}
            stroke="transparent" strokeWidth={shape.kind === "corridor" ? shape.width * CELL_SIZE + 10 : Math.max(16, atlasWallWidth(shape.width))} />
        {selected && <line x1={shape.x1 * CELL_SIZE} y1={shape.y1 * CELL_SIZE} x2={shape.x2 * CELL_SIZE} y2={shape.y2 * CELL_SIZE}
            stroke={stroke} strokeWidth="4" strokeDasharray="8 5" />}
    </g>;
}

export default function LivingAtlasEditor({ locationId, initialName, initialDocument, mapId, savedDocumentIds, onClose, onUsePreview }: LivingAtlasEditorProps) {
    const storageKey = `${DRAFT_STORAGE_KEY}:${mapId ?? locationId}`;
    const editorRef = useRef<HTMLElement>(null);
    const [atlas, setAtlas] = useState(() => loadLocalDraft(initialName, storageKey, initialDocument, savedDocumentIds));
    const [past, setPast] = useState<LivingAtlasDocument[]>([]);
    const [future, setFuture] = useState<LivingAtlasDocument[]>([]);
    const [tool, setTool] = useState<LivingAtlasTool>("room");
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [multiSelect, setMultiSelect] = useState(false);
    const [activeLayerId, setActiveLayerId] = useState(BASE_ATLAS_LAYER_ID);
    const [pointerSession, setPointerSession] = useState<PointerSession | null>(null);
    const [zoom, setZoom] = useState(0.8);
    const [corridorWidth, setCorridorWidth] = useState(2);
    const [doorRotation, setDoorRotation] = useState<0 | 90>(0);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isExporting, setIsExporting] = useState(false);
    const [isReading, setIsReading] = useState(false);
    const [storageFailed, setStorageFailed] = useState(false);
    const [inspectorOpen, setInspectorOpen] = useState(() => window.innerWidth > 900);
    const scrollRef = useRef<HTMLDivElement>(null);
    const geometryId = useId().replace(/:/g, "");
    const fitToView = useCallback(() => {
        const viewport = scrollRef.current;
        if (!viewport) return;
        setZoom(clamp(Math.min((viewport.clientWidth - 48) / (atlas.widthCells * CELL_SIZE), (viewport.clientHeight - 48) / (atlas.heightCells * CELL_SIZE), 1), 0.08, 2));
        viewport.scrollTo({ left: 0, top: 0 });
    }, [atlas.widthCells, atlas.heightCells]);
    const svgRef = useRef<SVGSVGElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        try {
            campaignResourceStorage.setItem(storageKey, serializeLivingAtlasDocument(atlas));
            setStorageFailed(false);
        } catch {
            setStorageFailed(true);
        }
    }, [atlas, storageKey]);

    const commit = (next: LivingAtlasDocument) => {
        try {
            const checked = readLivingAtlasDocument(JSON.stringify(next));
            setPast((items) => [...items.slice(-(HISTORY_LIMIT - 1)), atlas]);
            setAtlas(checked);
            setFuture([]);
            setError(null);
            return true;
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : "Не удалось проверить изменение карты.");
            return false;
        }
    };

    const undo = () => {
        setPointerSession(null);
        const previous = past[past.length - 1];
        if (!previous) return;
        setPast((items) => items.slice(0, -1));
        setFuture((items) => [atlas, ...items].slice(0, HISTORY_LIMIT));
        setAtlas({ ...previous, updatedAt: Date.now() });
        setSelectedIds([]);
    };

    const redo = () => {
        setPointerSession(null);
        const next = future[0];
        if (!next) return;
        setPast((items) => [...items.slice(-(HISTORY_LIMIT - 1)), atlas]);
        setFuture((items) => items.slice(1));
        setAtlas({ ...next, updatedAt: Date.now() });
        setSelectedIds([]);
    };

    const layers = atlasLayers(atlas);
    const activeLayer = layers.find(layer => layer.id === activeLayerId) ?? layers[0];
    const editableIds = new Set(atlasEditableShapes(atlas).map(shape => shape.id));
    const selection = atlas.shapes.filter(shape => selectedIds.includes(shape.id) && editableIds.has(shape.id));
    const selectedShape = selection.length === 1 ? selection[0] : undefined;
    const previewShapes = useMemo(() => {
        if (pointerSession?.mode === "move") return translateAtlasSelection(atlas, pointerSession.ids, pointerSession.current.x - pointerSession.start.x, pointerSession.current.y - pointerSession.start.y);
        if (pointerSession?.mode === "resize") return resizeAtlasShape(atlas, pointerSession.shapeId, pointerSession.handle, pointerSession.current);
        return atlas.shapes;
    }, [atlas, pointerSession]);
    const visibleShapes = atlasVisibleShapes({ ...atlas, shapes: previewShapes });
    const selectedPreview = selectedShape ? visibleShapes.find(shape => shape.id === selectedShape.id) : undefined;
    const groupBounds = selection.length > 1 ? selectionBounds(visibleShapes.filter(shape => selectedIds.includes(shape.id) && editableIds.has(shape.id))) : null;
    const marquee = pointerSession?.mode === "marquee" ? {
        x: Math.min(pointerSession.start.x, pointerSession.current.x), y: Math.min(pointerSession.start.y, pointerSession.current.y),
        width: Math.abs(pointerSession.start.x - pointerSession.current.x), height: Math.abs(pointerSession.start.y - pointerSession.current.y),
    } : null;
    const withActiveLayer = (shape: LivingAtlasShape): LivingAtlasShape => activeLayer.id === BASE_ATLAS_LAYER_ID ? shape : { ...shape, layerId: activeLayer.id };
    const commitShapes = (shapes: LivingAtlasShape[]) => {
        if (JSON.stringify(shapes) === JSON.stringify(atlas.shapes)) return;
        commit({ ...atlas, shapes, updatedAt: Date.now() });
    };
    const changeLayers = (next: AtlasLayer[]) => {
        setPointerSession(null); setSelectedIds([]);
        commit({ ...atlas, layers: next, updatedAt: Date.now() });
    };
    const resizeSelected = (handle: AtlasResizeHandle, point: GridPoint) => {
        if (selectedShape) commitShapes(resizeAtlasShape(atlas, selectedShape.id, handle, point));
    };
    const startResize = (event: ReactPointerEvent<SVGRectElement>, handle: AtlasResizeHandle) => {
        event.stopPropagation();
        if (event.button !== 0 || !svgRef.current || !selectedShape || isExporting || isReading) return;
        event.preventDefault(); svgRef.current.focus(); svgRef.current.setPointerCapture(event.pointerId);
        setPointerSession({ mode: "resize", shapeId: selectedShape.id, handle, current: pointFromPointer(svgRef.current, event.clientX, event.clientY, atlas), pointerId: event.pointerId });
    };

    useEffect(() => {
        editorRef.current?.closest(".map-workflow-panel")?.scrollTo({ top: 0, left: 0 });
        const frame = requestAnimationFrame(fitToView);
        return () => cancelAnimationFrame(frame);
    }, [fitToView]);

    const startShapeMove = (event: ReactPointerEvent<SVGElement>, shape: LivingAtlasShape) => {
        if (tool !== "select" || !svgRef.current || event.button !== 0 || isExporting || isReading) return;
        event.stopPropagation();
        if (!editableIds.has(shape.id)) return;
        event.preventDefault(); svgRef.current.focus();
        const add = event.shiftKey || multiSelect;
        const currentIds = selection.map(item => item.id);
        if (add && currentIds.includes(shape.id)) {
            setSelectedIds(currentIds.filter(id => id !== shape.id)); return;
        }
        const ids = currentIds.includes(shape.id) ? currentIds : add ? [...currentIds, shape.id] : [shape.id];
        setSelectedIds(ids);
        svgRef.current.setPointerCapture(event.pointerId);
        const point = pointFromPointer(svgRef.current, event.clientX, event.clientY, atlas);
        setPointerSession({ mode: "move", ids, start: point, current: point, pointerId: event.pointerId });
    };

    const startDrawing = (event: ReactPointerEvent<SVGSVGElement>) => {
        if (event.button !== 0 || isExporting || isReading) return;
        event.currentTarget.focus();
        if (tool === "pan" && scrollRef.current) {
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            setPointerSession({ mode: "pan", clientX: event.clientX, clientY: event.clientY, left: scrollRef.current.scrollLeft, top: scrollRef.current.scrollTop, pointerId: event.pointerId });
            return;
        }
        const point = pointFromPointer(event.currentTarget, event.clientX, event.clientY, atlas);
        if (tool === "select") {
            event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
            const baseIds = event.shiftKey || multiSelect ? selection.map(shape => shape.id) : [];
            setSelectedIds(baseIds);
            setPointerSession({ mode: "marquee", start: point, current: point, baseIds, pointerId: event.pointerId });
            return;
        }
        if (!activeLayer.visible || activeLayer.locked) {
            setError(`Слой «${activeLayer.name}» ${activeLayer.locked ? "заблокирован" : "скрыт"}. Выберите доступный слой.`);
            return;
        }
        if (atlas.shapes.length >= MAX_LIVING_ATLAS_SHAPES) {
            setError(`Достигнут безопасный лимит: ${MAX_LIVING_ATLAS_SHAPES} объектов.`);
            return;
        }
        if (tool === "door") {
            const shape = createShape("door", point, point, corridorWidth, doorRotation, atlas);
            if (shape && commit({ ...atlas, shapes: [...atlas.shapes, withActiveLayer(shape)], updatedAt: Date.now() })) {
                setSelectedIds([shape.id]);
            }
            return;
        }
        event.currentTarget.setPointerCapture(event.pointerId);
        setPointerSession({ mode: "draw", start: point, current: point, pointerId: event.pointerId });
    };

    const continuePointer = (event: ReactPointerEvent<SVGSVGElement>) => {
        if (!pointerSession || pointerSession.pointerId !== event.pointerId) return;
        if (pointerSession.mode === "pan") {
            if (scrollRef.current) {
                scrollRef.current.scrollLeft = pointerSession.left - (event.clientX - pointerSession.clientX);
                scrollRef.current.scrollTop = pointerSession.top - (event.clientY - pointerSession.clientY);
            }
            return;
        }
        const current = pointFromPointer(event.currentTarget, event.clientX, event.clientY, atlas);
        setPointerSession((session) => session ? { ...session, current } : null);
    };

    const finishPointer = (event: ReactPointerEvent<SVGSVGElement>) => {
        if (!pointerSession || pointerSession.pointerId !== event.pointerId) return;
        const current = pointFromPointer(event.currentTarget, event.clientX, event.clientY, atlas);
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        if (pointerSession.mode === "draw" && tool !== "select" && tool !== "pan" && tool !== "door") {
            const shape = createShape(tool, pointerSession.start, current, corridorWidth, doorRotation, atlas);
            if (shape && commit({ ...atlas, shapes: [...atlas.shapes, withActiveLayer(shape)], updatedAt: Date.now() })) {
                setSelectedIds([shape.id]);
            }
        } else if (pointerSession.mode === "move") {
            commitShapes(translateAtlasSelection(atlas, pointerSession.ids, current.x - pointerSession.start.x, current.y - pointerSession.start.y));
        } else if (pointerSession.mode === "resize") {
            commitShapes(resizeAtlasShape(atlas, pointerSession.shapeId, pointerSession.handle, current));
        } else if (pointerSession.mode === "marquee") {
            setSelectedIds([...new Set([...pointerSession.baseIds, ...selectAtlasRectangle(atlas, pointerSession.start, current)])]);
        }
        setPointerSession(null);
    };

    const deleteSelected = () => {
        const ids = new Set(selection.map(shape => shape.id));
        if (!ids.size) return;
        commitShapes(atlas.shapes.filter(shape => !ids.has(shape.id)));
        setSelectedIds([]);
    };

    const nudgeSelected = (deltaX: number, deltaY: number) => {
        commitShapes(translateAtlasSelection(atlas, selection.map(shape => shape.id), deltaX, deltaY));
    };

    const handleCanvasKeyDown = (event: KeyboardEvent<SVGSVGElement>) => {
        event.stopPropagation();
        if (isExporting || isReading) { event.preventDefault(); return; }
        const key = event.key.toLocaleLowerCase("en");
        if (pointerSession && key !== "escape") { event.preventDefault(); return; }
        if ((event.ctrlKey || event.metaKey) && key === "a") {
            event.preventDefault(); setTool("select"); setSelectedIds([...editableIds]); return;
        }
        if (key === "escape") {
            event.preventDefault();
            if (pointerSession) setPointerSession(null); else onClose();
            return;
        }
        if ((event.ctrlKey || event.metaKey) && key === "z") {
            event.preventDefault();
            if (event.shiftKey) redo(); else undo();
            return;
        }
        if ((event.ctrlKey || event.metaKey) && key === "y") {
            event.preventDefault();
            redo();
            return;
        }
        if (event.key === "Delete" || event.key === "Backspace") {
            event.preventDefault();
            deleteSelected();
            return;
        }
        const delta = event.shiftKey ? 5 : 1;
        const moves: Record<string, [number, number]> = {
            ArrowLeft: [-delta, 0], ArrowRight: [delta, 0], ArrowUp: [0, -delta], ArrowDown: [0, delta],
        };
        const move = moves[event.key];
        if (move) {
            event.preventDefault();
            nudgeSelected(...move);
        }
    };

    const updateSelected = (shape: LivingAtlasShape) => {
        if (editableIds.has(shape.id)) commitShapes(atlas.shapes.map(item => item.id === shape.id ? shape : item));
    };

    const saveProject = () => {
        const checked = readLivingAtlasDocument(JSON.stringify({ ...atlas, name: atlas.name.trim() || "Новая карта" }));
        downloadBlob(new Blob([serializeLivingAtlasDocument(checked)], { type: "application/json" }), `${safeLivingAtlasFileStem(checked.name)}.eclatlas.json`);
        setMessage("Файл проекта сохранён локально.");
    };

    const loadProject = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;
        setError(null);
        setMessage(null);
        if (!file.name.toLocaleLowerCase("en").endsWith(".json")) {
            setError("Выберите проект Living Atlas в формате JSON.");
            return;
        }
        if (file.size > MAX_LIVING_ATLAS_FILE_BYTES) {
            setError("Файл проекта больше безопасного лимита 1 МБ.");
            return;
        }
        setIsReading(true);
        try {
            const loaded = readLivingAtlasDocument(await file.text());
            setPast((items) => [...items.slice(-(HISTORY_LIMIT - 1)), atlas]);
            setFuture([]);
            setAtlas({ ...loaded, id: createLivingAtlasId(), createdAt: Date.now(), updatedAt: Date.now(), source: "imported" });
            setSelectedIds([]);
            setPointerSession(null); setActiveLayerId(BASE_ATLAS_LAYER_ID);
            setMessage(`Проект «${loaded.name}» открыт локально.`);
        } catch {
            setError("Не удалось открыть проект: файл повреждён или использует неподдерживаемый формат. Текущая карта не изменена.");
        } finally { setIsReading(false); }
    };

    const exportPng = async () => {
        if (!svgRef.current) return;
        setIsExporting(true);
        setError(null);
        try {
            const dataUrl = await rasterizeAtlas(svgRef.current, atlas, "image/png", 2400);
            downloadBlob(dataUrlToBlob(dataUrl), `${safeLivingAtlasFileStem(atlas.name)}.png`);
            setMessage("PNG экспортирован локально без служебного выделения.");
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : "Не удалось экспортировать PNG.");
        } finally {
            setIsExporting(false);
        }
    };

    const applyToLocation = async () => {
        if (!svgRef.current || atlas.shapes.length === 0) return;
        setIsExporting(true);
        setError(null);
        try {
            const previewDataUrl = await rasterizeAtlas(svgRef.current, atlas, "image/webp", 1200);
            onUsePreview({
                previewDataUrl,
                document: readLivingAtlasDocument(JSON.stringify(atlas)),
                name: atlas.name,
                fileName: `${safeLivingAtlasFileStem(atlas.name)}.webp`,
                widthCells: atlas.widthCells,
                heightCells: atlas.heightCells,
            });
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : "Не удалось подготовить карту для локации.");
        } finally {
            setIsExporting(false);
        }
    };

    const draftShape = pointerSession?.mode === "draw" && tool !== "select" && tool !== "pan"
        ? createShape(tool, pointerSession.start, pointerSession.current, corridorWidth, doorRotation, atlas)
        : null;

    return (
        <section ref={editorRef} className={`living-atlas-editor${inspectorOpen ? " has-inspector" : ""}`} aria-labelledby="living-atlas-title" data-undo-scope="local"
            aria-busy={isExporting || isReading}
            onKeyDownCapture={(event) => {
                if (isExporting || isReading) { event.preventDefault(); event.stopPropagation(); }
            }}
            onClickCapture={(event) => {
                if (isExporting || isReading) { event.preventDefault(); event.stopPropagation(); }
            }}
            onKeyDown={(event) => {
                if (isExporting || isReading) { event.preventDefault(); event.stopPropagation(); return; }
                if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); if (pointerSession) setPointerSession(null); else onClose(); }
                if ((event.ctrlKey || event.metaKey) && ["z", "y"].includes(event.key.toLowerCase())) event.stopPropagation();
            }}>
            <header className="atlas-header">
                {(isExporting || isReading) && <div className="atlas-busy" role="status">{isReading ? "Проверяем файл проекта…" : "Готовим изображение карты…"}</div>}
                <div className="atlas-title">
                    <h3 id="living-atlas-title">Living Atlas</h3>
                    <label className="atlas-name-field" htmlFor="atlas-name"><span>Название карты</span>
                        <input id="atlas-name" value={atlas.name} maxLength={80} onChange={(event) => setAtlas({ ...atlas, name: event.target.value.slice(0, 80), updatedAt: Date.now() })} />
                    </label>
                </div>
                <div className="atlas-project-actions">
                    <input ref={fileInputRef} type="file" accept=".json,application/json" hidden onChange={(event) => void loadProject(event)} />
                    <Button size="sm" variant="bordered" isLoading={isReading} onClick={() => fileInputRef.current?.click()}>Открыть файл</Button>
                    <Button size="sm" variant="bordered" startContent={<IoDownloadOutline />} onClick={saveProject}>Файл проекта</Button>
                    <Button isIconOnly variant="light" className="atlas-close" isDisabled={isExporting || isReading} onClick={onClose} aria-label="Закрыть редактор карты"><IoClose /></Button>
                </div>
            </header>

            <div className="atlas-toolbar" role="toolbar" aria-label="Инструменты рисования карты">
                <div className="atlas-tools" role="group" aria-label="Инструмент">
                    {toolMeta.map((item) => (
                        <Button
                            key={item.tool}
                            size="sm"
                            className={`atlas-tool${tool === item.tool ? " is-active" : ""}`}
                            variant={tool === item.tool ? "solid" : "light"}
                            aria-pressed={tool === item.tool}
                            title={item.hint}
                            onClick={() => { setTool(item.tool); setSelectedIds([]); setPointerSession(null); }}
                        >
                            <item.icon aria-hidden="true" />{item.label}
                        </Button>
                    ))}
                </div>
                <div className="atlas-history-actions">
                    <Button size="sm" variant="light" startContent={<IoSettingsOutline />} aria-expanded={inspectorOpen} aria-controls="atlas-inspector" onClick={() => setInspectorOpen((value) => !value)}>Параметры</Button>
                    <Button isIconOnly size="sm" variant="light" onClick={undo} isDisabled={past.length === 0} aria-label="Отменить изменение"><IoArrowUndoOutline /></Button>
                    <Button isIconOnly size="sm" variant="light" onClick={redo} isDisabled={future.length === 0} aria-label="Вернуть изменение"><IoArrowRedoOutline /></Button>
                    <Button isIconOnly size="sm" variant="light" color="danger" onClick={deleteSelected} isDisabled={selection.length === 0} aria-label="Удалить выбранный объект"><IoTrashOutline /></Button>
                </div>
            </div>

            <div className="atlas-selection-bar">
                <span role="status">{selection.length ? `Выбрано: ${selection.length}` : `Слой: ${activeLayer.name}`}</span>
                {tool === "select" && <>
                    <Button size="sm" variant={multiSelect ? "solid" : "light"} aria-pressed={multiSelect} onClick={() => setMultiSelect(value => !value)}>Несколько</Button>
                    <Button size="sm" variant="light" isDisabled={!editableIds.size} onClick={() => setSelectedIds([...editableIds])}>Выбрать всё</Button>
                    <span className="atlas-selection-hint">Выделяйте рамкой или Shift + клик</span>
                </>}
                {(!activeLayer.visible || activeLayer.locked) && <span className="atlas-layer-warning">{activeLayer.locked ? "Слой заблокирован" : "Слой скрыт"}</span>}
                <Button size="sm" variant="light" onClick={() => { setInspectorOpen(true); requestAnimationFrame(() => editorRef.current?.querySelector(".atlas-layers")?.scrollIntoView({ block: "nearest" })); }}>Слои</Button>
            </div>

            <div className="atlas-layout">
                <div className="atlas-canvas-shell">
                    <div ref={scrollRef} className="atlas-canvas-scroll">
                        <svg
                            ref={svgRef}
                            className={`atlas-canvas is-tool-${tool}`}
                            viewBox={`0 0 ${atlas.widthCells * CELL_SIZE} ${atlas.heightCells * CELL_SIZE}`}
                            width={atlas.widthCells * CELL_SIZE * zoom}
                            height={atlas.heightCells * CELL_SIZE * zoom}
                            role="application"
                            tabIndex={0}
                            aria-label={`Редактор карты ${atlas.name}. ${atlas.shapes.length} объектов.`}
                            onPointerDown={startDrawing}
                            onPointerMove={continuePointer}
                            onPointerUp={finishPointer}
                            onPointerCancel={() => setPointerSession(null)}
                            onKeyDown={handleCanvasKeyDown}
                        >
                            <title>{atlas.name}</title>
                            <defs>
                                <pattern id={`${geometryId}-grid`} width={CELL_SIZE} height={CELL_SIZE} patternUnits="userSpaceOnUse">
                                    <path d={`M ${CELL_SIZE} 0 L 0 0 0 ${CELL_SIZE}`} fill="none" stroke="#c9bfa8" strokeWidth="1" />
                                </pattern>
                            </defs>
                            <rect width="100%" height="100%" fill="#e7dfcf" />
                            <rect width="100%" height="100%" fill={`url(#${geometryId}-grid)`} />
                            {layers.filter(layer => layer.visible).map(layer => <g key={layer.id} data-render-layer={layer.id}>
                                <AtlasFloorLayer shapes={visibleShapes.filter(shape => shapeLayerId(shape) === layer.id)} maskId={`${geometryId}-${layer.id}-doors`} />
                            </g>)}
                            {visibleShapes.filter(shape => editableIds.has(shape.id)).map((shape) => <ShapeView key={shape.id} shape={shape} selected={selectedIds.includes(shape.id)} onPointerDown={(event) => startShapeMove(event, shape)} />)}
                            {groupBounds && <rect data-ui-only="true" pointerEvents="none" x={groupBounds.left * CELL_SIZE} y={groupBounds.top * CELL_SIZE}
                                width={(groupBounds.right - groupBounds.left) * CELL_SIZE} height={(groupBounds.bottom - groupBounds.top) * CELL_SIZE}
                                fill="none" stroke="#2f7fe5" strokeWidth={2 / zoom} strokeDasharray="8 5" />}
                            {selectedPreview && tool === "select" && <AtlasResizeHandles shape={selectedPreview} zoom={zoom} onStart={startResize} onResize={resizeSelected} />}
                            {marquee && <rect data-ui-only="true" pointerEvents="none" x={marquee.x * CELL_SIZE} y={marquee.y * CELL_SIZE}
                                width={marquee.width * CELL_SIZE} height={marquee.height * CELL_SIZE} fill="#2f7fe5" fillOpacity=".12" stroke="#2f7fe5" strokeWidth={2 / zoom} />}
                            {draftShape && <g data-ui-only="true" className="atlas-draft"><AtlasFloorLayer shapes={[draftShape]} maskId={`${geometryId}-draft-doors`} /></g>}
                        </svg>
                    </div>
                    <div className="atlas-zoom" role="group" aria-label="Масштаб карты">
                        <Button isIconOnly size="sm" variant="flat" onClick={() => setZoom((value) => clamp(value - 0.1, 0.08, 2))} aria-label="Уменьшить масштаб">−</Button>
                        <Button isIconOnly size="sm" variant="flat" onClick={fitToView} aria-label="Показать карту целиком"><IoExpandOutline /></Button>
                        <span>{Math.round(zoom * 100)}%</span>
                        <Button isIconOnly size="sm" variant="flat" onClick={() => setZoom((value) => clamp(value + 0.1, 0.08, 2))} aria-label="Увеличить масштаб">+</Button>
                    </div>
                </div>

                <aside id="atlas-inspector" className="atlas-inspector" aria-label="Настройки редактора" hidden={!inspectorOpen}>
                    <Button size="sm" variant="light" onClick={() => setInspectorOpen(false)}>Скрыть параметры</Button>
                    {selection.length > 0 ? (
                        <>
                            <div className="atlas-inspector-heading">
                                <span>Выбрано</span>
                                <strong>{selectedShape ? shapeLabels[selectedShape.kind] : `${selection.length} объектов`}</strong>
                            </div>
                            <div className="atlas-nudge-grid" role="group" aria-label="Переместить выбранный объект">
                                <Button isIconOnly size="sm" variant="flat" onClick={() => nudgeSelected(0, -1)} aria-label="Переместить вверх"><IoArrowUpOutline /></Button>
                                <Button isIconOnly size="sm" variant="flat" onClick={() => nudgeSelected(-1, 0)} aria-label="Переместить влево"><IoArrowBackOutline /></Button>
                                <Button isIconOnly size="sm" variant="flat" onClick={() => nudgeSelected(1, 0)} aria-label="Переместить вправо"><IoArrowForwardOutline /></Button>
                                <Button isIconOnly size="sm" variant="flat" onClick={() => nudgeSelected(0, 1)} aria-label="Переместить вниз"><IoArrowDownOutline /></Button>
                            </div>
                            {selectedShape && <AtlasResizeFields shape={selectedShape} document={atlas} onResize={resizeSelected} />}
                            {selectedShape?.kind === "door" && (
                                <Button size="sm" variant="bordered" onClick={() => updateSelected({ ...selectedShape, rotation: selectedShape.rotation === 0 ? 90 : 0 })}>Повернуть дверь</Button>
                            )}
                            {(selectedShape?.kind === "corridor" || selectedShape?.kind === "wall") && (
                                <label className="atlas-compact-field">
                                    Толщина
                                    <input type="range" min="1" max={selectedShape?.kind === "corridor" ? 6 : 2} value={selectedShape.width} onChange={(event) => updateSelected({ ...selectedShape, width: Number(event.target.value) })} />
                                </label>
                            )}
                            <Button size="sm" color="danger" variant="light" startContent={<IoTrashOutline />} onClick={deleteSelected}>Удалить</Button>
                        </>
                    ) : (
                        <div className="atlas-inspector-empty">
                            <strong>{toolMeta.find((item) => item.tool === tool)?.label}</strong>
                            <p>{toolMeta.find((item) => item.tool === tool)?.hint}</p>
                        </div>
                    )}

                    {tool === "corridor" && !selectedShape && (
                        <label className="atlas-compact-field">
                            Ширина коридора
                            <input type="range" min="1" max="6" value={corridorWidth} onChange={(event) => setCorridorWidth(Number(event.target.value))} />
                            <span>{corridorWidth} клетки</span>
                        </label>
                    )}
                    {tool === "door" && !selectedShape && (
                        <Button size="sm" variant="bordered" onClick={() => setDoorRotation((value) => value === 0 ? 90 : 0)}>Ориентация: {doorRotation === 0 ? "горизонтальная" : "вертикальная"}</Button>
                    )}

                    <AtlasLayerPanel document={atlas} activeId={activeLayer.id} selectedCount={selection.length}
                        onActivate={id => { setActiveLayerId(id); setPointerSession(null); setSelectedIds([]); setError(null); }}
                        onChange={changeLayers}
                        onTransfer={id => commitShapes(transferAtlasSelection(atlas, selection.map(shape => shape.id), id))} />

                    <div className="atlas-document-meta">
                        <span>{atlas.widthCells}×{atlas.heightCells} клеток</span>
                        <span>{atlas.shapes.length} объектов</span>
                        <span>Черновик принадлежит этой карте и кампании</span>
                    </div>
                </aside>
            </div>

            {storageFailed && <p className="map-message is-error" role="alert">Черновик не сохранён. Скачайте файл проекта перед закрытием. <button onClick={() => setAtlas({ ...atlas })}>Повторить запись</button></p>}
            {(error || message) && <p className={`map-message ${error ? "is-error" : "is-success"}`} role={error ? "alert" : "status"}>{error || message}</p>}

            <footer className="atlas-footer">
                <span role="status" className="atlas-save-status">{storageFailed ? "Есть несохранённые изменения" : "Черновик сохранён в этой кампании"}</span>
                <Button variant="bordered" startContent={<IoDownloadOutline />} isLoading={isExporting} onClick={() => void exportPng()} isDisabled={atlas.shapes.length === 0}>Скачать PNG</Button>
                <Button color="primary" isLoading={isExporting} onClick={() => void applyToLocation()} isDisabled={atlas.shapes.length === 0 || !atlas.name.trim()}>{mapId ? "Сохранить изменения" : "Использовать в локации"}</Button>
            </footer>
        </section>
    );
}
