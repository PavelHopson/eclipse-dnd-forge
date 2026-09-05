import type { PointerEvent as ReactPointerEvent } from "react";
import type { LivingAtlasDocument, LivingAtlasShape } from "../../model/dnd/livingAtlas";
import type { AtlasPoint, AtlasResizeHandle } from "../../model/dnd/atlasEditing";
import { ATLAS_CELL_SIZE as CELL } from "../../model/dnd/atlasGeometry";

type Resize = (handle: AtlasResizeHandle, point: AtlasPoint) => void;
export function AtlasResizeHandles({ shape, zoom, onStart, onResize }: {
    shape: LivingAtlasShape; zoom: number;
    onStart: (event: ReactPointerEvent<SVGRectElement>, handle: AtlasResizeHandle) => void;
    onResize: Resize;
}) {
    if (shape.kind === "door") return null;
    const handles: Array<{ handle: AtlasResizeHandle; x: number; y: number; label: string }> = shape.kind === "room" ? [
        { handle: "nw", x: shape.x, y: shape.y, label: "Верхний левый угол" },
        { handle: "ne", x: shape.x + shape.width, y: shape.y, label: "Верхний правый угол" },
        { handle: "sw", x: shape.x, y: shape.y + shape.height, label: "Нижний левый угол" },
        { handle: "se", x: shape.x + shape.width, y: shape.y + shape.height, label: "Нижний правый угол" },
    ] : [
        { handle: "start", x: shape.x1, y: shape.y1, label: "Начало линии" },
        { handle: "end", x: shape.x2, y: shape.y2, label: "Конец линии" },
    ];
    const size = 22 / zoom;
    return <g data-ui-only="true">
        {handles.map(item => <rect key={item.handle} className={`atlas-resize-handle is-${item.handle}`} data-resize-handle={item.handle}
            x={item.x * CELL - size / 2} y={item.y * CELL - size / 2} width={size} height={size} rx={2 / zoom}
            fill="#fff" stroke="#2f7fe5" strokeWidth={2 / zoom} role="button" tabIndex={0} aria-label={item.label}
            onPointerDown={event => onStart(event, item.handle)}
            onKeyDown={event => {
                if (!event.key.startsWith("Arrow")) return;
                event.preventDefault(); event.stopPropagation();
                const step = event.shiftKey ? 5 : 1;
                onResize(item.handle, { x: item.x + (event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0),
                    y: item.y + (event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0) });
            }} />)}
    </g>;
}

function CoordinateField({ label, value, min = 0, max, onChange }: {
    label: string; value: number; min?: number; max: number; onChange: (value: number) => void;
}) {
    return <label className="atlas-compact-field">{label}<input key={value} type="number" min={min} max={max} step="1"
        defaultValue={value} onBlur={event => {
            const n = event.currentTarget.valueAsNumber;
            if (!event.currentTarget.validity.valid || !Number.isInteger(n)) { event.currentTarget.value = String(value); return; }
            if (n !== value) onChange(n);
            // A rejected transform (for example a collapsed line) must not leave a false value in the field.
            event.currentTarget.value = String(value);
        }} onKeyDown={event => { if (event.key === "Enter") event.currentTarget.blur(); }} /></label>;
}

export function AtlasResizeFields({ shape, document, onResize }: { shape: LivingAtlasShape; document: LivingAtlasDocument; onResize: Resize }) {
    if (shape.kind === "door") return null;
    if (shape.kind === "room") return <div className="atlas-size-fields" role="group" aria-label="Размер комнаты в клетках">
        <CoordinateField label="Ширина" value={shape.width} min={1} max={document.widthCells - shape.x}
            onChange={width => onResize("se", { x: shape.x + width, y: shape.y + shape.height })} />
        <CoordinateField label="Высота" value={shape.height} min={1} max={document.heightCells - shape.y}
            onChange={height => onResize("se", { x: shape.x + shape.width, y: shape.y + height })} />
    </div>;
    return <div className="atlas-size-fields" role="group" aria-label="Концы линии в клетках">
        <CoordinateField label="Начало X" value={shape.x1} max={document.widthCells} onChange={x => onResize("start", { x, y: shape.y1 })} />
        <CoordinateField label="Начало Y" value={shape.y1} max={document.heightCells} onChange={y => onResize("start", { x: shape.x1, y })} />
        <CoordinateField label="Конец X" value={shape.x2} max={document.widthCells} onChange={x => onResize("end", { x, y: shape.y2 })} />
        <CoordinateField label="Конец Y" value={shape.y2} max={document.heightCells} onChange={y => onResize("end", { x: shape.x2, y })} />
    </div>;
}
