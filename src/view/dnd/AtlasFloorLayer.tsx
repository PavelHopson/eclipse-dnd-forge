import { ATLAS_CELL_SIZE as CELL, ATLAS_WALL_OUTLINE, atlasWallWidth } from "../../model/dnd/atlasGeometry";
import type { LivingAtlasShape, LivingAtlasLine } from "../../model/dnd/livingAtlas";

function Floor({ shape, outline }: { shape: LivingAtlasShape; outline: boolean }) {
    const color = outline ? "#283443" : "#f8f3e5";
    if (shape.kind === "room") return <rect x={shape.x * CELL} y={shape.y * CELL} width={shape.width * CELL} height={shape.height * CELL}
        fill={color} stroke={outline ? color : "none"} strokeWidth={ATLAS_WALL_OUTLINE * 2} />;
    if (shape.kind === "corridor") return <line x1={shape.x1 * CELL} y1={shape.y1 * CELL} x2={shape.x2 * CELL} y2={shape.y2 * CELL}
        stroke={color} strokeWidth={shape.width * CELL + (outline ? ATLAS_WALL_OUTLINE * 2 : 0)} strokeLinecap="square" />;
    return null;
}

/** Paint the union's outlines first, then ALL interiors. Shared room/corridor walls disappear irrespective of object order. */
export default function AtlasFloorLayer({ shapes, maskId }: { shapes: LivingAtlasShape[]; maskId: string }) {
    return <g pointerEvents="none" data-atlas-geometry="continuous-floor">
        <defs>
            <mask id={maskId} maskUnits="userSpaceOnUse" x="-20" y="-20" width="4000" height="4000" style={{ maskType: "luminance" }}>
                <rect x="-20" y="-20" width="4000" height="4000" fill="white" />
                {shapes.filter((shape) => shape.kind === "door").map((door) => <rect key={door.id}
                    transform={`translate(${door.x * CELL} ${door.y * CELL}) rotate(${door.rotation})`}
                    x="-20" y="-12" width="40" height="24" fill="black" />)}
            </mask>
        </defs>
        <g mask={`url(#${maskId})`} data-atlas-walls="true">
            {shapes.map((shape) => <Floor key={shape.id} shape={shape} outline />)}
            {shapes.map((shape) => <Floor key={shape.id} shape={shape} outline={false} />)}
            {shapes.filter((shape): shape is LivingAtlasLine => shape.kind === "wall").map((wall) => <line key={wall.id} data-wall-id={wall.id}
                x1={wall.x1 * CELL} y1={wall.y1 * CELL} x2={wall.x2 * CELL} y2={wall.y2 * CELL}
                stroke="#202b3a" strokeWidth={atlasWallWidth(wall.width)} strokeLinecap="round" />)}
        </g>
        {shapes.filter((shape) => shape.kind === "door").map((door) => <g key={door.id}
            transform={`translate(${door.x * CELL} ${door.y * CELL}) rotate(${door.rotation})`}>
            <rect x="-18" y="-5" width="36" height="10" fill="#f8f3e5" stroke="#9d7a3e" strokeWidth="3" />
        </g>)}
    </g>;
}
