import type { LivingAtlasShape } from "./livingAtlas.ts";

export const ATLAS_CELL_SIZE = 32;
export const ATLAS_WALL_OUTLINE = 5;
export const atlasWallWidth = (width: number) => width * 7;

/** Floor membership for the same square-capped corridor geometry used by SVG. */
export function isAtlasFloorPoint(shapes: LivingAtlasShape[], x: number, y: number): boolean {
    return shapes.some((shape) => {
        if (shape.kind === "room") return x >= shape.x && x <= shape.x + shape.width && y >= shape.y && y <= shape.y + shape.height;
        if (shape.kind !== "corridor") return false;
        const dx = shape.x2 - shape.x1, dy = shape.y2 - shape.y1;
        const length = Math.hypot(dx, dy);
        if (!length) return false;
        const along = ((x - shape.x1) * dx + (y - shape.y1) * dy) / length;
        const across = Math.abs((x - shape.x1) * dy - (y - shape.y1) * dx) / length;
        return along >= -shape.width / 2 && along <= length + shape.width / 2 && across <= shape.width / 2;
    });
}
