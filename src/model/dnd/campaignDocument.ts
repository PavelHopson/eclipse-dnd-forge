import type { ActionEdge, Entity, EntityNode, Location, LocationNode, ModelState } from "../Model";
import type { Descendant } from "slate";

export const CAMPAIGN_SCHEMA = "eclivarium.campaign.v1";
export const MAX_CAMPAIGN_BYTES = 12 * 1024 * 1024;
export const RESOURCE_KEYS = [
    "eclipse_dnd_sessions_v1", "eclipse_dnd_world_events_v1", "eclipse_dnd_initiative_v1",
    "eclipse_location_maps_v1", "eclipse_map_story_pins_v1", "eclipse_dnd_reference_board_v1",
    "eclivarium_living_atlas_draft_v1",
] as const;
export const ATLAS_RESOURCE_PREFIX = "eclivarium_living_atlas_draft_v1:";

export type CampaignWorld = Pick<ModelState, "textState" | "entityNodes" | "locationNodes" | "actionEdges" | "isStale">;
export interface CampaignDocument {
    schemaVersion: typeof CAMPAIGN_SCHEMA;
    id: string;
    name: string;
    revision: number;
    updatedAt: number;
    world: CampaignWorld;
    resources: Record<string, string>;
}

function requireValue(valid: boolean): asserts valid {
    if (!valid) throw new Error("Файл кампании повреждён или использует неподдерживаемый формат. Исходные данные не изменены.");
}
function object(value: unknown, keys: string[]): asserts value is Record<string, any> {
    requireValue(!!value && typeof value === "object" && !Array.isArray(value));
    requireValue(Object.keys(value).every((key) => keys.includes(key)));
}
function string(value: unknown, max = 10000, min = 0): asserts value is string {
    requireValue(typeof value === "string" && value.length >= min && value.length <= max);
}
function number(value: unknown, max = 1e9): asserts value is number {
    requireValue(typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= max);
}
function array(value: unknown, max: number): asserts value is any[] {
    requireValue(Array.isArray(value) && value.length <= max);
}
export function isCampaignId(id: unknown): id is string {
    return typeof id === "string" && /^(?:legacy|campaign-[a-zA-Z0-9-]{8,80})$/.test(id);
}
export function isResourceKey(key: string): boolean {
    return (RESOURCE_KEYS as readonly string[]).includes(key) ||
        (key.startsWith(ATLAS_RESOURCE_PREFIX) && key.length <= 240 && key.length > ATLAS_RESOURCE_PREFIX.length);
}
function data(value: unknown, kind: "entity" | "location") {
    const common = ["name", "emoji", "kind"];
    object(value, [...common, ...(kind === "entity"
        ? ["properties", "role", "abilities", "hp", "ac", "cr", "goal", "secret", "knowledge"]
        : ["biome", "danger"])]);
    string(value.name, 500); string(value.emoji, 80);
    for (const key of ["kind", "role", "goal", "secret", "biome"]) if (value[key] !== undefined) string(value[key]);
    for (const key of ["hp", "ac", "cr", "danger"]) if (value[key] !== undefined) number(value[key]);
    if (kind === "entity") {
        array(value.properties, 128);
        for (const property of value.properties) {
            object(property, ["name", "value"]); string(property.name, 500); number(property.value);
        }
        if (value.abilities !== undefined) {
            object(value.abilities, ["str", "dex", "con", "int", "wis", "cha"]);
            Object.values(value.abilities).forEach((score) => number(score));
        }
        if (value.knowledge !== undefined) { array(value.knowledge, 256); value.knowledge.forEach((fact: unknown) => string(fact)); }
    }
}

export function readCampaignWorld(value: unknown): CampaignWorld {
    object(value, ["textState", "entityNodes", "locationNodes", "actionEdges", "isStale"]);
    requireValue(typeof value.isStale === "boolean");
    array(value.textState, 1000); requireValue(value.textState.length > 0);
    let textLength = 0;
    let leafCount = 0;
    for (const paragraph of value.textState) {
        object(paragraph, ["type", "children"]);
        if (paragraph.type !== undefined) requireValue(paragraph.type === "paragraph");
        array(paragraph.children, 10000); requireValue(paragraph.children.length > 0);
        for (const leaf of paragraph.children) {
            object(leaf, ["text", "added", "removed", "highlight"]); string(leaf.text, 1_000_000);
            for (const flag of ["added", "removed", "highlight"]) if (leaf[flag] !== undefined) requireValue(typeof leaf[flag] === "boolean");
            textLength += leaf.text.length; leafCount++;
        }
    }
    requireValue(textLength <= 1_000_000 && leafCount <= 10000);
    const allIds = new Set<string>();
    for (const [key, kind] of [["entityNodes", "entity"], ["locationNodes", "location"]] as const) {
        array(value[key], 2000);
        for (const node of value[key]) {
            object(node, ["id", "type", "position", "data", "dragHandle"]);
            string(node.id, 180, 1); requireValue(!allIds.has(node.id)); allIds.add(node.id);
            requireValue(node.type === `${kind}Node`);
            if (node.dragHandle !== undefined) requireValue(node.dragHandle === ".custom-drag-handle");
            object(node.position, ["x", "y"]); number(node.position.x, 1e6); number(node.position.y, 1e6);
            data(node.data, kind);
        }
    }
    array(value.actionEdges, 5000);
    const entityIds = new Set(value.entityNodes.map((node: EntityNode) => node.id));
    const edgeIds = new Set<string>();
    for (const edge of value.actionEdges) {
        object(edge, ["id", "source", "target", "type", "data", "sourceHandle", "targetHandle"]);
        string(edge.id, 180, 1); requireValue(!edgeIds.has(edge.id)); edgeIds.add(edge.id);
        requireValue(entityIds.has(edge.source) && entityIds.has(edge.target));
        if (edge.type !== undefined) string(edge.type, 80);
        for (const key of ["sourceHandle", "targetHandle"]) if (edge[key] !== undefined && edge[key] !== null) string(edge[key], 180);
        object(edge.data, ["name", "sourceLocation", "targetLocation", "passage"]);
        for (const key of ["name", "sourceLocation", "targetLocation"]) string(edge.data[key], 10000);
        string(edge.data.passage, 1_000_000);
    }
    return value as CampaignWorld;
}

/** Explicit projection: never serialize store actions, SDK credentials or React Flow internals. */
export function captureCampaignWorld(state: CampaignWorld): CampaignWorld {
    const node = (item: EntityNode | LocationNode) => ({
        id: item.id, type: item.type, position: { x: item.position.x, y: item.position.y }, data: item.data,
        ...(item.dragHandle ? { dragHandle: item.dragHandle } : {}),
    });
    const projected = {
        textState: state.textState, isStale: state.isStale,
        entityNodes: state.entityNodes.map(node), locationNodes: state.locationNodes.map(node),
        actionEdges: state.actionEdges.map(({ id, source, target, type, data, sourceHandle, targetHandle }) =>
            ({ id, source, target, type, data, sourceHandle, targetHandle })),
    };
    return readCampaignWorld(JSON.parse(JSON.stringify(projected)));
}

export function emptyCampaignWorld(): CampaignWorld {
    return { textState: [{ children: [{ text: "" }] }] as Descendant[], entityNodes: [], locationNodes: [], actionEdges: [], isStale: false };
}
export function readCampaignDocument(raw: string): CampaignDocument {
    requireValue(typeof raw === "string" && new TextEncoder().encode(raw).length <= MAX_CAMPAIGN_BYTES);
    const value = JSON.parse(raw);
    object(value, ["schemaVersion", "id", "name", "revision", "updatedAt", "world", "resources"]);
    requireValue(value.schemaVersion === CAMPAIGN_SCHEMA && isCampaignId(value.id));
    string(value.name, 160, 1);
    requireValue(Number.isSafeInteger(value.revision) && value.revision >= 0);
    requireValue(Number.isSafeInteger(value.updatedAt) && value.updatedAt >= 0);
    readCampaignWorld(value.world);
    requireValue(!!value.resources && typeof value.resources === "object" && !Array.isArray(value.resources));
    requireValue(Object.keys(value.resources).length <= 128);
    for (const [key, rawResource] of Object.entries(value.resources)) {
        requireValue(isResourceKey(key)); string(rawResource, MAX_CAMPAIGN_BYTES);
    }
    return value as CampaignDocument;
}

export function templateWorld(text: string, entities: Entity[], locations: Location[]): CampaignWorld {
    const node = (item: Entity | Location, index: number, kind: string) => ({
        id: kind === "entity" ? `entity-${item.name}` : `location-${index}`, type: `${kind}Node`, dragHandle: ".custom-drag-handle",
        position: { x: 20 + (index % 2) * 350, y: 20 + Math.floor(index / 2) * 200 }, data: item,
    });
    return captureCampaignWorld({
        textState: [{ children: [{ text }] }] as Descendant[], isStale: false,
        entityNodes: entities.map((item, i) => node(item, i, "entity") as EntityNode),
        locationNodes: locations.map((item, i) => node(item, i, "location") as LocationNode), actionEdges: [] as ActionEdge[],
    });
}
