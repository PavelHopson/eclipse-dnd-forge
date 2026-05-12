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
                {
                    name: "Toblen Stonehill", emoji: "🍺", kind: "npc", role: "Innkeeper", properties: [{ name: "friendly", value: 8 }],
                    goal: "Keep his inn safe, his customers fed, and his daughter Pip away from the Redbrand thugs.",
                    secret: "He has been paying small bribes to the Redbrands for weeks to keep them away from his family — he is ashamed of it.",
                    knowledge: [
                        "Black-fletched goblin arrows have been found on the Triboar Trail twice this month.",
                        "Linan Swift is a regular customer who recently rode in alone, agitated.",
                        "Sildar Hallwinter was Linan's caravan captain — taken alive, not killed.",
                        "The Cragmaw goblins are based somewhere in the Neverwinter Wood, north of the trail.",
                        "Redbrand thugs are drinking at the Sleeping Giant taphouse, not here.",
                    ],
                },
                {
                    name: "Linan Swift", emoji: "📜", kind: "npc", role: "Merchant", properties: [{ name: "anxious", value: 7 }],
                    goal: "Get Sildar back alive — Sildar is an old friend who once saved Linan's life on the road to Yartar.",
                    secret: "He can actually afford 100 gp, not 50 — he is testing the party's commitment before paying more.",
                    knowledge: [
                        "The ambush happened two miles up the Triboar Trail near a bend by a dead oak.",
                        "Goblins took Sildar alive and dragged him off — there were at least four of them.",
                        "The wagon and supplies were ransacked; only Sildar was carried away.",
                        "Sildar carries a small leather cylinder hidden under his armour — Linan does not know what is in it.",
                    ],
                },
                {
                    name: "Sildar Hallwinter", emoji: "🛡️", kind: "npc", role: "Captive Guard Captain", properties: [{ name: "wounded", value: 6 }],
                    goal: "Survive, get free, and warn the Lord's Alliance in Neverwinter about Cragmaw activity.",
                    secret: "He carries a Lord's Alliance cypher worth more than his life — if the bugbears find it they will torture him.",
                    knowledge: [
                        "The bugbear chief in the hideout is named Klarg.",
                        "There are roughly a dozen goblins plus Klarg and two wolves at the hideout.",
                        "The hideout is a cave warren with a stream running through the lower chamber.",
                        "Someone called 'the Black Spider' is paying the Cragmaws — Sildar overheard the name twice.",
                    ],
                },
                {
                    name: "Cragmaw Goblins", emoji: "👺", kind: "monster", role: "Goblin Raiders", properties: [{ name: "ferocity", value: 5 }], cr: 0.25,
                    goal: "Bring meat, gold, and live captives back to Klarg the bugbear.",
                    secret: "Klarg works for someone called the Black Spider, who pays in coin and dark magic — none of the rank-and-file know who that really is.",
                    knowledge: [
                        "Klarg sleeps in the upper cave with two wolves.",
                        "A flooded tunnel from the stream connects to the back of the warren.",
                        "Prisoners are tied in the rear pit, near where the loot is stashed.",
                    ],
                },
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
                {
                    name: "Strahd von Zarovich", emoji: "🧛", kind: "monster", role: "Vampire Lord of Barovia", properties: [{ name: "menace", value: 10 }, { name: "patience", value: 9 }], cr: 15,
                    goal: "Reclaim Tatyana — Ireena Kolyana is her latest reincarnation, and Strahd will own her body or destroy it.",
                    secret: "He was once human. He murdered his own brother Sergei on the morning of Sergei's wedding to Tatyana, and signed a pact with the Dark Powers in the same hour.",
                    knowledge: [
                        "Every Barovian by name and by what they fear most.",
                        "The current location of the Sunsword and the Holy Symbol of Ravenkind.",
                        "Madam Eva's prophecy varies with every reading — he watches her cards even when she refuses to read for him.",
                        "Doru in the church bell tower was sired by him personally.",
                    ],
                },
                {
                    name: "Father Donavich", emoji: "✝️", kind: "npc", role: "Broken priest", properties: [{ name: "despair", value: 9 }],
                    goal: "Find anyone strong enough to destroy his son Doru cleanly, without making him feel pain.",
                    secret: "He is the one who locked Doru in the bell tower. Doru is starving on his orders, and Donavich brings the bell-pulls down so no one rings them.",
                    knowledge: [
                        "Doru was killed and turned attacking Strahd's castle a year ago.",
                        "The Holy Symbol of Ravenkind is somewhere in this church — he himself does not know where.",
                        "The screaming from the bell tower is his son, not a ghost.",
                        "Mad Mary's daughter Gertruda left the village three nights ago after a fight with her mother.",
                    ],
                },
                {
                    name: "Mad Mary", emoji: "😢", kind: "npc", role: "Mother of the missing Gertruda", properties: [{ name: "grief", value: 10 }],
                    goal: "Find Gertruda and bring her home before Strahd does.",
                    secret: "She struck Gertruda the night Gertruda ran away. The grief is partly guilt.",
                    knowledge: [
                        "Gertruda had been receiving letters in a fine hand from a man she would not name.",
                        "Gertruda left through the east gate, alone, three nights ago.",
                        "There is an old hunting path through the eastern woods that leads toward Castle Ravenloft.",
                    ],
                },
                {
                    name: "Doru", emoji: "🩸", kind: "monster", role: "Vampire Spawn in the bell tower", properties: [{ name: "hunger", value: 8 }], cr: 5,
                    goal: "Feed — anyone, anything warm. The hunger is louder than any thought.",
                    secret: "Beneath the hunger, fragments remain — he still remembers his father's voice, and is terrified of what he has become.",
                    knowledge: [
                        "His father Donavich locked him here.",
                        "There is a hidden trapdoor in the bell tower to the crypt below the church.",
                        "Strahd's blood still calls to him from Castle Ravenloft.",
                    ],
                },
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
                {
                    name: "Old Mab", emoji: "🔮", kind: "npc", role: "Hedge Wizard", properties: [{ name: "lore", value: 8 }, { name: "eccentricity", value: 9 }],
                    goal: "Study the meteor herself before any of the factions can take it away.",
                    secret: "She is over two hundred years old, partial-elf, and she remembers when the previous meteor of this kind fell — eighty years ago in a different valley.",
                    knowledge: [
                        "The hum near the crater is the same pitch she heard as a child in the southern range.",
                        "The Hooded Stranger is from the same era she is — she recognised her gait.",
                        "Birds do not fly near the crater because the air pressure shifts in waves.",
                        "Sheriff Vance has been awake for three nights running.",
                    ],
                },
                {
                    name: "Sheriff Doral Vance", emoji: "⭐", kind: "npc", role: "Frontier Sheriff", properties: [{ name: "weariness", value: 7 }],
                    goal: "Get something fell from the sky out of his jurisdiction before the three factions kill someone over it.",
                    secret: "Ten years ago he was a Zhentarim enforcer in Westgate. He recognises the broker but has not let on.",
                    knowledge: [
                        "The Clerics of Pelor arrived two nights ago, the Zhentarim broker yesterday morning, the Hooded Stranger this dawn.",
                        "Wren is sixteen and is the only person in town who has actually been to the marsh edge near the crater.",
                        "The broker stays at the Salt Crow inn and pays in old Westgate marks.",
                        "Old Mab knows more than she says — she has been buying expensive ink and parchment all week.",
                    ],
                },
                {
                    name: "Deputy Wren", emoji: "🪶", kind: "npc", role: "Young Deputy, marsh guide", properties: [{ name: "courage", value: 4 }, { name: "fear", value: 8 }],
                    goal: "Survive this assignment, prove he is not a coward, then quit and apprentice with the smith.",
                    secret: "He touched the meteor on the night it fell. Since then he has been dreaming in a language he does not know — and remembering one word of it each morning.",
                    knowledge: [
                        "The trail to the crater takes about three hours on foot, longer in fog.",
                        "There is a half-sunken stone causeway that gets you within sight of the crater without wading.",
                        "The air near the crater feels heavy, like before a thunderstorm — but there is no storm.",
                        "A dead heron near the crater had no marks on it.",
                    ],
                },
                {
                    name: "Clerics of Pelor", emoji: "☀️", kind: "faction", role: "Sun-bronzed pilgrims", properties: [{ name: "zeal", value: 8 }],
                    goal: "Recover the meteor as a relic — they believe it is a fragment of Pelor's broken spear.",
                    secret: "Their leader, Brother Iram, intends to consume the fragment alone if it grants power — the others do not know this.",
                    knowledge: [
                        "A meteor of similar description is mentioned in a banned Pelorian apocrypha.",
                        "The Zhentarim broker is travelling alone, an opportunity if it comes to a fight.",
                        "Pelorian doctrine forbids letting an unconsecrated soul touch a relic of the Sun.",
                    ],
                },
                {
                    name: "Zhentarim Broker", emoji: "🎭", kind: "faction", role: "Masked agent with gold", properties: [{ name: "cunning", value: 9 }],
                    goal: "Buy or steal the meteor and deliver it to his contact in Waterdeep within the month.",
                    secret: "His buyer is not a noble — it is a beholder operating through intermediaries. He himself has never met it.",
                    knowledge: [
                        "Black-market routes from Cinder Hollow east through the marsh and north to a smuggling cog.",
                        "The going price for an arcane curiosity of this size is between 3000 and 8000 gp.",
                        "There is a Pelorian cleric named Iram who has a price on his head in three cities — could be turned.",
                    ],
                },
                {
                    name: "Hooded Stranger", emoji: "🧝‍♀️", kind: "npc", role: "Nameless elven figure", properties: [{ name: "mystery", value: 10 }],
                    goal: "Destroy the meteor before anyone uses it — it is a seed of something far older and worse than any of them know.",
                    secret: "She was once a servant of an aboleth. She survived when the previous fragment fell eighty years ago. She still hears the aboleth in her dreams.",
                    knowledge: [
                        "The meteor is a fragment of a Far Realm artefact — using it once will tear a thin spot in reality.",
                        "There is a ritual that can unmake the fragment, but it requires a willing sacrifice.",
                        "Old Mab is older than she pretends and has seen this kind of object before.",
                        "If the Zhentarim move the fragment far enough, it will start to attract more like itself.",
                    ],
                },
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
