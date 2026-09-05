import { atlasEditableShapes, atlasLayers, shapeLayerId } from "./livingAtlas.ts";
import type { LivingAtlasDocument, LivingAtlasShape } from "./livingAtlas.ts";

export type AtlasPoint = { x: number; y: number };
export type AtlasBounds = { left: number; top: number; right: number; bottom: number };
export type AtlasResizeHandle = "nw" | "ne" | "sw" | "se" | "start" | "end";
const clamp = (n: number, low: number, high: number) => Math.max(low, Math.min(high, n));

export function shapeBounds(shape: LivingAtlasShape): AtlasBounds {
    if (shape.kind === "room") return { left: shape.x, top: shape.y, right: shape.x + shape.width, bottom: shape.y + shape.height };
    if (shape.kind === "door") return { left: shape.x, top: shape.y, right: shape.x, bottom: shape.y };
    return { left: Math.min(shape.x1, shape.x2), top: Math.min(shape.y1, shape.y2), right: Math.max(shape.x1, shape.x2), bottom: Math.max(shape.y1, shape.y2) };
}

export function selectionBounds(shapes: LivingAtlasShape[]): AtlasBounds | null {
    if (!shapes.length) return null;
    const boxes = shapes.map(shapeBounds);
    return { left: Math.min(...boxes.map(b => b.left)), top: Math.min(...boxes.map(b => b.top)),
        right: Math.max(...boxes.map(b => b.right)), bottom: Math.max(...boxes.map(b => b.bottom)) };
}

/** Marquee selects intersecting logical bounds; hidden/locked layers are never editable. */
export function selectAtlasRectangle(document: LivingAtlasDocument, start: AtlasPoint, end: AtlasPoint): string[] {
    const left = Math.min(start.x, end.x), right = Math.max(start.x, end.x);
    const top = Math.min(start.y, end.y), bottom = Math.max(start.y, end.y);
    if (left === right && top === bottom) return [];
    return atlasEditableShapes(document).filter(shape => {
        const b = shapeBounds(shape);
        return b.left <= right && b.right >= left && b.top <= bottom && b.bottom >= top;
    }).map(shape => shape.id);
}

/** Apply ONE clamped delta to the selection: relative spacing survives canvas edges. */
export function translateAtlasSelection(document: LivingAtlasDocument, ids: string[], dx: number, dy: number): LivingAtlasShape[] {
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return document.shapes;
    const selected = atlasEditableShapes(document).filter(shape => ids.includes(shape.id));
    const bounds = selectionBounds(selected);
    if (!bounds) return document.shapes;
    const x = clamp(Math.round(dx), -bounds.left, document.widthCells - bounds.right);
    const y = clamp(Math.round(dy), -bounds.top, document.heightCells - bounds.bottom);
    if (!x && !y) return document.shapes;
    const allowed = new Set(selected.map(shape => shape.id));
    return document.shapes.map(shape => {
        if (!allowed.has(shape.id)) return shape;
        if (shape.kind === "room" || shape.kind === "door") return { ...shape, x: shape.x + x, y: shape.y + y };
        return { ...shape, x1: shape.x1 + x, y1: shape.y1 + y, x2: shape.x2 + x, y2: shape.y2 + y };
    });
}

export function resizeAtlasShape(document: LivingAtlasDocument, id: string, handle: AtlasResizeHandle, point: AtlasPoint): LivingAtlasShape[] {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return document.shapes;
    const shape = atlasEditableShapes(document).find(item => item.id === id);
    if (!shape || shape.kind === "door") return document.shapes;
    const x = clamp(Math.round(point.x), 0, document.widthCells), y = clamp(Math.round(point.y), 0, document.heightCells);
    let resized: LivingAtlasShape = shape;
    if (shape.kind === "room") {
        if (handle === "start" || handle === "end") return document.shapes;
        const west = handle === "nw" || handle === "sw", north = handle === "nw" || handle === "ne";
        const left = west ? Math.min(x, shape.x + shape.width - 1) : shape.x;
        const top = north ? Math.min(y, shape.y + shape.height - 1) : shape.y;
        const right = west ? shape.x + shape.width : Math.max(x, shape.x + 1);
        const bottom = north ? shape.y + shape.height : Math.max(y, shape.y + 1);
        resized = { ...shape, x: left, y: top, width: right - left, height: bottom - top };
    } else {
        if (handle !== "start" && handle !== "end") return document.shapes;
        resized = handle === "start" ? { ...shape, x1: x, y1: y } : { ...shape, x2: x, y2: y };
        if (resized.x1 === resized.x2 && resized.y1 === resized.y2) return document.shapes;
    }
    if (JSON.stringify(shape) === JSON.stringify(resized)) return document.shapes;
    return document.shapes.map(item => item.id === id ? resized : item);
}

export function transferAtlasSelection(document: LivingAtlasDocument, ids: string[], layerId: string): LivingAtlasShape[] {
    if (!atlasLayers(document).some(layer => layer.id === layerId && layer.visible && !layer.locked)) return document.shapes;
    const allowed = new Set(atlasEditableShapes(document).filter(shape => ids.includes(shape.id)).map(shape => shape.id));
    return document.shapes.map(shape => allowed.has(shape.id) && shapeLayerId(shape) !== layerId ? { ...shape, layerId } : shape);
}
