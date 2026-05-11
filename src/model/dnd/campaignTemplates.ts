import { Entity, EntityNode, Location, LocationNode } from "../Model";
import { CreateEntityNode } from "../../view/entityActionView/EntityNodeComponent";
import { CreateLocatioNode } from "../../view/locationView/LocationNodeComponent";

export type CampaignSeed = {
    entities: Entity[]
    locations: Location[]
}

export type CampaignTemplate = {
    id: string
    title: string
    subtitle: string
    emoji: string
    text: string
    seed: CampaignSeed
}

export const CAMPAIGN_TEMPLATES: CampaignTemplate[] = [
    {
        id: "phandalin-opener",
        title: "Phandalin — Lost Mine Opener",
        subtitle: "Goblin ambush on the Triboar Trail. Low level, classic 5e onboarding.",
        emoji: "🗡️",
        text: `Session 1 — The Stonefang Pass

The party arrived at the gates of Phandalin just before dusk. Thalia, a half-elf ranger, scouted the treeline while Bren, a dwarven cleric of Moradin, addressed the worried townsfolk gathered at the Stonehill Inn. Mira, a tiefling rogue, slipped into the market crowd to listen for rumors about the missing caravan.

In the Stonehill common room, the innkeeper Toblen told them that goblin raiders had been seen near the Triboar Trail. A merchant named Linan Swift offered fifty gold pieces for the rescue of his guard captain, Sildar, who had been taken alive into Cragmaw Hideout — a cave warren somewhere in the Neverwinter Wood.

At first light the party rode north. Two miles up the trail they found a dead horse pierced by black-fletched arrows. Thalia spotted goblin tracks leading off into the undergrowth. Mira readied her shortbow. Bren raised the symbol of Moradin and whispered a prayer for the road ahead.`,
        seed: {
            entities: [
                { name: "Thalia", emoji: "🏹", kind: "hero", role: "Half-elf Ranger", properties: [{ name: "perception", value: 7 }, { name: "stealth", value: 6 }], abilities: { str: 12, dex: 16, con: 13, int: 11, wis: 14, cha: 10 }, hp: 22, ac: 14 },
                { name: "Bren", emoji: "⚒️", kind: "hero", role: "Dwarven Cleric of Moradin", properties: [{ name: "faith", value: 9 }, { name: "endurance", value: 7 }], abilities: { str: 14, dex: 10, con: 15, int: 10, wis: 16, cha: 12 }, hp: 26, ac: 18 },
                { name: "Mira", emoji: "🗡️", kind: "hero", role: "Tiefling Rogue", properties: [{ name: "cunning", value: 8 }, { name: "stealth", value: 9 }], abilities: { str: 9, dex: 17, con: 12, int: 13, wis: 11, cha: 14 }, hp: 18, ac: 15 },
                { name: "Toblen Stonehill", emoji: "🍺", kind: "npc", role: "Innkeeper", properties: [{ name: "friendly", value: 8 }] },
                { name: "Linan Swift", emoji: "📜", kind: "npc", role: "Merchant", properties: [{ name: "anxious", value: 7 }] },
                { name: "Sildar Hallwinter", emoji: "🛡️", kind: "npc", role: "Captive Guard Captain", properties: [{ name: "wounded", value: 6 }] },
                { name: "Cragmaw Goblins", emoji: "👺", kind: "monster", role: "Goblin Raiders", properties: [{ name: "ferocity", value: 5 }], cr: 0.25 },
            ],
            locations: [
                { name: "Phandalin", emoji: "🏘️", kind: "town", biome: "frontier" },
                { name: "Stonehill Inn", emoji: "🍻", kind: "town", biome: "interior" },
                { name: "Triboar Trail", emoji: "🛤️", kind: "wild", biome: "road", danger: 3 },
                { name: "Neverwinter Wood", emoji: "🌲", kind: "wild", biome: "forest", danger: 5 },
                { name: "Cragmaw Hideout", emoji: "🕳️", kind: "dungeon", biome: "cave", danger: 6 },
            ],
        }
    },
    {
        id: "strahd-arrival",
        title: "Barovia — Mists of Strahd",
        subtitle: "Gothic horror. Party drawn through the mists into Strahd's domain.",
        emoji: "🦇",
        text: `Session 1 — Through the Mists

The road behind the party had vanished. One moment they were riding through the moor under a thin grey sky, the next they were swallowed by mist so thick that even their lanterns gave only a small bubble of yellow light. The horses had refused to go further and were sent back into the fog alone.

Ahead loomed the gates of a walled village. A wooden sign read: "Welcome to Barovia." Above the gates, two figures were strung up by their necks, their faces serene as if asleep. A woman wept somewhere down the cobbled street, calling the name "Gertruda" over and over.

Father Donavich opened the door of the church only a crack. "You should not have come here," he whispered. "The Devil Strahd is hunting tonight." From the bell tower above, a thin voice — a young man's voice — began to scream, and would not stop.`,
        seed: {
            entities: [
                { name: "The Party", emoji: "🧝", kind: "hero", role: "Travelers from beyond the mists", properties: [{ name: "resolve", value: 6 }] },
                { name: "Strahd von Zarovich", emoji: "🧛", kind: "monster", role: "Vampire Lord of Barovia", properties: [{ name: "menace", value: 10 }, { name: "patience", value: 9 }], cr: 15 },
                { name: "Father Donavich", emoji: "✝️", kind: "npc", role: "Broken priest", properties: [{ name: "despair", value: 9 }] },
                { name: "Mad Mary", emoji: "😢", kind: "npc", role: "Mother of the missing Gertruda", properties: [{ name: "grief", value: 10 }] },
                { name: "Doru", emoji: "🩸", kind: "monster", role: "Vampire Spawn in the bell tower", properties: [{ name: "hunger", value: 8 }], cr: 5 },
            ],
            locations: [
                { name: "The Mists", emoji: "🌫️", kind: "plane", biome: "between-realms", danger: 7 },
                { name: "Village of Barovia", emoji: "🏚️", kind: "town", biome: "gothic-decay", danger: 5 },
                { name: "Church of Saint Andral", emoji: "⛪", kind: "town", biome: "interior", danger: 6 },
                { name: "Castle Ravenloft", emoji: "🏰", kind: "stronghold", biome: "mountain-fortress", danger: 10 },
            ],
        }
    },
    {
        id: "starfall-cinder",
        title: "Cinder Hollow — Falling Star",
        subtitle: "Sandbox open-world starter. A meteor crashes near a frontier town.",
        emoji: "☄️",
        text: `Session 1 — The Falling Star

Three nights ago a streak of white fire split the sky over Cinder Hollow and crashed somewhere in the Ashfen Marsh. The local hedge wizard, Old Mab, claims it was no ordinary stone — the air around it hums, and birds have stopped flying near the crater.

By dawn the town had three groups of strangers asking questions about the marsh. A pair of grim-faced clerics of Pelor wearing sun-bronze tabards. A masked Zhentarim broker who flashed too much gold at the inn. And a hooded figure with elven features who would not give a name.

Sheriff Doral Vance has posted a fifty-gold bounty for any party willing to escort his deputy, Wren, into the marsh and report back what fell from the sky. The bounty is paid in advance, half on departure. The deputy is sixteen, terrified, and the only person in town who knows the trail.`,
        seed: {
            entities: [
                { name: "Old Mab", emoji: "🔮", kind: "npc", role: "Hedge Wizard", properties: [{ name: "lore", value: 8 }, { name: "eccentricity", value: 9 }] },
                { name: "Sheriff Doral Vance", emoji: "⭐", kind: "npc", role: "Frontier Sheriff", properties: [{ name: "weariness", value: 7 }] },
                { name: "Deputy Wren", emoji: "🪶", kind: "npc", role: "Young Deputy, marsh guide", properties: [{ name: "courage", value: 4 }, { name: "fear", value: 8 }] },
                { name: "Clerics of Pelor", emoji: "☀️", kind: "faction", role: "Sun-bronzed pilgrims", properties: [{ name: "zeal", value: 8 }] },
                { name: "Zhentarim Broker", emoji: "🎭", kind: "faction", role: "Masked agent with gold", properties: [{ name: "cunning", value: 9 }] },
                { name: "Hooded Stranger", emoji: "🧝‍♀️", kind: "npc", role: "Nameless elven figure", properties: [{ name: "mystery", value: 10 }] },
            ],
            locations: [
                { name: "Cinder Hollow", emoji: "🪵", kind: "town", biome: "frontier" },
                { name: "Ashfen Marsh", emoji: "🪷", kind: "wild", biome: "marsh", danger: 6 },
                { name: "The Crater", emoji: "🌟", kind: "dungeon", biome: "crash-site", danger: 8 },
            ],
        }
    },
    {
        id: "blank-campaign",
        title: "Blank Campaign",
        subtitle: "Empty world. Type, paste session notes, or sketch the visual graph by hand.",
        emoji: "📜",
        text: ``,
        seed: {
            entities: [],
            locations: [{ name: "Unknown Realm", emoji: "🌍", kind: "unknown" }],
        }
    },
];

export function seedToNodes(seed: CampaignSeed): {
    entityNodes: EntityNode[]
    locationNodes: LocationNode[]
} {
    const entityNodes = seed.entities.map((e, i) => CreateEntityNode(e, i));
    const locationNodes = seed.locations.map((l, i) => CreateLocatioNode(l, i));
    return { entityNodes, locationNodes };
}
