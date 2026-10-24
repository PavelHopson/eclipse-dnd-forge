import type { Entity, Location } from "../Model";

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
        id: "emberfall-opener",
        title: "Эмберфолл — Broken Lantern Opener",
        subtitle: "Засада гоблинов на Трёхдорогой тропе. Низкий уровень, классическое 5e-онбординг приключение.",
        emoji: "🗡️",
        text: `Session 1 — The Stonefang Pass

The party arrived at the gates of Emberfall just before dusk. Thalia, a half-elf ranger, scouted the treeline while Bren, a dwarven cleric of Auron, addressed the worried townsfolk gathered at the Hearthstone Inn. Mira, a tiefling rogue, slipped into the market crowd to listen for rumors about the missing caravan.

In the Hearthstone common room, the innkeeper Tovin told them that goblin raiders had been seen near the Three-Road Trail. A merchant named Mara Quill offered fifty gold pieces for the rescue of his guard captain, Edrin, who had been taken alive into Ashclaw Hideout — a cave warren somewhere in the Northmere Wood.

At first light the party rode north. Two miles up the trail they found a dead horse pierced by black-fletched arrows. Thalia spotted goblin tracks leading off into the undergrowth. Mira readied her shortbow. Bren raised the symbol of Auron and whispered a prayer for the road ahead.`,
        seed: {
            entities: [
                { name: "Thalia", emoji: "🏹", kind: "hero", role: "Half-elf Ranger", properties: [{ name: "perception", value: 7 }, { name: "stealth", value: 6 }], abilities: { str: 12, dex: 16, con: 13, int: 11, wis: 14, cha: 10 }, hp: 22, ac: 14 },
                { name: "Bren", emoji: "⚒️", kind: "hero", role: "Dwarven Cleric of Auron", properties: [{ name: "faith", value: 9 }, { name: "endurance", value: 7 }], abilities: { str: 14, dex: 10, con: 15, int: 10, wis: 16, cha: 12 }, hp: 26, ac: 18 },
                { name: "Mira", emoji: "🗡️", kind: "hero", role: "Tiefling Rogue", properties: [{ name: "cunning", value: 8 }, { name: "stealth", value: 9 }], abilities: { str: 9, dex: 17, con: 12, int: 13, wis: 11, cha: 14 }, hp: 18, ac: 15 },
                {
                    name: "Tovin Hearthstone", emoji: "🍺", kind: "npc", role: "Innkeeper", properties: [{ name: "friendly", value: 8 }],
                    goal: "Keep his inn safe, his customers fed, and his daughter Nessa away from the Red Sash thugs.",
                    secret: "He has been paying small bribes to the Red Sashes for weeks to keep them away from his family — he is ashamed of it.",
                    knowledge: [
                        "Black-fletched goblin arrows have been found on the Three-Road Trail twice this month.",
                        "Mara Quill is a regular customer who recently rode in alone, agitated.",
                        "Edrin Hale was Mara's caravan captain — taken alive, not killed.",
                        "The Ashclaw goblins are based somewhere in the Northmere Wood, north of the trail.",
                        "Red Sash thugs are drinking at the Sleeping Giant taphouse, not here.",
                    ],
                },
                {
                    name: "Mara Quill", emoji: "📜", kind: "npc", role: "Merchant", properties: [{ name: "anxious", value: 7 }],
                    goal: "Get Edrin back alive — Edrin is an old friend who once saved Mara's life on the road to Marlowe.",
                    secret: "He can actually afford 100 gp, not 50 — he is testing the party's commitment before paying more.",
                    knowledge: [
                        "The ambush happened two miles up the Three-Road Trail near a bend by a dead oak.",
                        "Goblins took Edrin alive and dragged him off — there were at least four of them.",
                        "The wagon and supplies were ransacked; only Edrin was carried away.",
                        "Edrin carries a small leather cylinder hidden under his armour — Mara does not know what is in it.",
                    ],
                },
                {
                    name: "Edrin Hale", emoji: "🛡️", kind: "npc", role: "Captive Guard Captain", properties: [{ name: "wounded", value: 6 }],
                    goal: "Survive, get free, and warn the Northroad Wardens in Northmere about Ashclaw activity.",
                    secret: "He carries a Northroad Wardens cypher worth more than his life — if the bugbears find it they will torture him.",
                    knowledge: [
                        "The bugbear chief in the hideout is named Brakka.",
                        "There are roughly a dozen goblins plus Brakka and two wolves at the hideout.",
                        "The hideout is a cave warren with a stream running through the lower chamber.",
                        "Someone called 'the Veiled Broker' is paying the Ashclaws — Edrin overheard the name twice.",
                    ],
                },
                {
                    name: "Ashclaw Goblins", emoji: "👺", kind: "monster", role: "Goblin Raiders", properties: [{ name: "ferocity", value: 5 }], cr: 0.25,
                    goal: "Bring meat, gold, and live captives back to Brakka the bugbear.",
                    secret: "Brakka works for someone called the Veiled Broker, who pays in coin and dark magic — none of the rank-and-file know who that really is.",
                    knowledge: [
                        "Brakka sleeps in the upper cave with two wolves.",
                        "A flooded tunnel from the stream connects to the back of the warren.",
                        "Prisoners are tied in the rear pit, near where the loot is stashed.",
                    ],
                },
            ],
            locations: [
                { name: "Emberfall", emoji: "🏘️", kind: "town", biome: "frontier" },
                { name: "Hearthstone Inn", emoji: "🍻", kind: "town", biome: "interior" },
                { name: "Three-Road Trail", emoji: "🛤️", kind: "wild", biome: "road", danger: 3 },
                { name: "Northmere Wood", emoji: "🌲", kind: "wild", biome: "forest", danger: 5 },
                { name: "Ashclaw Hideout", emoji: "🕳️", kind: "dungeon", biome: "cave", danger: 6 },
            ],
        }
    },
    {
        id: "greyfen-arrival",
        title: "Грейфен — Туманы Вейра",
        subtitle: "Готический ужас. Партию затягивает через туманы во владения Вейра.",
        emoji: "🦇",
        text: `Session 1 — Through the Mists

The road behind the party had vanished. One moment they were riding through the moor under a thin grey sky, the next they were swallowed by mist so thick that even their lanterns gave only a small bubble of yellow light. The horses had refused to go further and were sent back into the fog alone.

Ahead loomed the gates of a walled village. A wooden sign read: "Welcome to Greyfen." Above the gates, two figures were strung up by their necks, their faces serene as if asleep. A woman wept somewhere down the cobbled street, calling the name "Gerta" over and over.

Father Oren opened the door of the church only a crack. "You should not have come here," he whispered. "The Devil Veyr is hunting tonight." From the bell tower above, a thin voice — a young man's voice — began to scream, and would not stop.`,
        seed: {
            entities: [
                { name: "The Party", emoji: "🧝", kind: "hero", role: "Travelers from beyond the mists", properties: [{ name: "resolve", value: 6 }] },
                {
                    name: "Veyr Nocturne", emoji: "🧛", kind: "monster", role: "Vampire Lord of Greyfen", properties: [{ name: "menace", value: 10 }, { name: "patience", value: 9 }], cr: 15,
                    goal: "Reclaim Talia — Irena Vale is her latest reincarnation, and Veyr will own her body or destroy it.",
                    secret: "He was once human. He murdered his own brother Soren on the morning of Soren's wedding to Talia, and signed a pact with the Veiled Powers in the same hour.",
                    knowledge: [
                        "Every Greyfen by name and by what they fear most.",
                        "The current location of the Dawnblade and the Sunward Sigil.",
                        "Seer Vessa's prophecy varies with every reading — he watches her cards even when she refuses to read for him.",
                        "Derran in the church bell tower was sired by him personally.",
                    ],
                },
                {
                    name: "Father Oren", emoji: "✝️", kind: "npc", role: "Broken priest", properties: [{ name: "despair", value: 9 }],
                    goal: "Find anyone strong enough to destroy his son Derran cleanly, without making him feel pain.",
                    secret: "He is the one who locked Derran in the bell tower. Derran is starving on his orders, and Oren brings the bell-pulls down so no one rings them.",
                    knowledge: [
                        "Derran was killed and turned attacking Veyr's castle a year ago.",
                        "The Sunward Sigil is somewhere in this church — he himself does not know where.",
                        "The screaming from the bell tower is his son, not a ghost.",
                        "Mara Grief's daughter Gerta left the village three nights ago after a fight with her mother.",
                    ],
                },
                {
                    name: "Mara Grief", emoji: "😢", kind: "npc", role: "Mother of the missing Gerta", properties: [{ name: "grief", value: 10 }],
                    goal: "Find Gerta and bring her home before Veyr does.",
                    secret: "She struck Gerta the night Gerta ran away. The grief is partly guilt.",
                    knowledge: [
                        "Gerta had been receiving letters in a fine hand from a man she would not name.",
                        "Gerta left through the east gate, alone, three nights ago.",
                        "There is an old hunting path through the eastern woods that leads toward Castle Nightkeep.",
                    ],
                },
                {
                    name: "Derran", emoji: "🩸", kind: "monster", role: "Vampire Spawn in the bell tower", properties: [{ name: "hunger", value: 8 }], cr: 5,
                    goal: "Feed — anyone, anything warm. The hunger is louder than any thought.",
                    secret: "Beneath the hunger, fragments remain — he still remembers his father's voice, and is terrified of what he has become.",
                    knowledge: [
                        "His father Oren locked him here.",
                        "There is a hidden trapdoor in the bell tower to the crypt below the church.",
                        "Veyr's blood still calls to him from Castle Nightkeep.",
                    ],
                },
            ],
            locations: [
                { name: "The Mists", emoji: "🌫️", kind: "plane", biome: "between-realms", danger: 7 },
                { name: "Village of Greyfen", emoji: "🏚️", kind: "town", biome: "gothic-decay", danger: 5 },
                { name: "Chapel of Quiet Bells", emoji: "⛪", kind: "town", biome: "interior", danger: 6 },
                { name: "Castle Nightkeep", emoji: "🏰", kind: "stronghold", biome: "mountain-fortress", danger: 10 },
            ],
        }
    },
    {
        id: "starfall-cinder",
        title: "Синдер-Холлоу — Упавшая звезда",
        subtitle: "Sandbox-стартер с открытым миром. Метеор падает рядом с фронтирным городком.",
        emoji: "☄️",
        text: `Session 1 — The Falling Star

Three nights ago a streak of white fire split the sky over Cinder Hollow and crashed somewhere in the Ashfen Marsh. The local hedge wizard, Old Mab, claims it was no ordinary stone — the air around it hums, and birds have stopped flying near the crater.

By dawn the town had three groups of strangers asking questions about the marsh. A pair of grim-faced clerics of Solara wearing sun-bronze tabards. A masked Umbral Cartel broker who flashed too much gold at the inn. And a hooded figure with elven features who would not give a name.

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
                    secret: "Ten years ago he was an Umbral Cartel enforcer in Westmere. He recognises the broker but has not let on.",
                    knowledge: [
                        "The Clerics of Solara arrived two nights ago, the Umbral Cartel broker yesterday morning, the Hooded Stranger this dawn.",
                        "Wren is sixteen and is the only person in town who has actually been to the marsh edge near the crater.",
                        "The broker stays at the Salt Crow inn and pays in old Westmere marks.",
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
                    name: "Clerics of Solara", emoji: "☀️", kind: "faction", role: "Sun-bronzed pilgrims", properties: [{ name: "zeal", value: 8 }],
                    goal: "Recover the meteor as a relic — they believe it is a fragment of Solara's broken spear.",
                    secret: "Their leader, Brother Iram, intends to consume the fragment alone if it grants power — the others do not know this.",
                    knowledge: [
                        "A meteor of similar description is mentioned in a banned Solaran apocrypha.",
                        "The Umbral Cartel broker is travelling alone, an opportunity if it comes to a fight.",
                        "Solaran doctrine forbids letting an unconsecrated soul touch a relic of the Sun.",
                    ],
                },
                {
                    name: "Umbral Cartel Broker", emoji: "🎭", kind: "faction", role: "Masked agent with gold", properties: [{ name: "cunning", value: 9 }],
                    goal: "Buy or steal the meteor and deliver it to his contact in Highport within the month.",
                    secret: "His buyer is not a noble — it is a many-eyed watcher operating through intermediaries. He himself has never met it.",
                    knowledge: [
                        "Black-market routes from Cinder Hollow east through the marsh and north to a smuggling cog.",
                        "The going price for an arcane curiosity of this size is between 3000 and 8000 gp.",
                        "There is a Solaran cleric named Iram who has a price on his head in three cities — could be turned.",
                    ],
                },
                {
                    name: "Hooded Stranger", emoji: "🧝‍♀️", kind: "npc", role: "Nameless elven figure", properties: [{ name: "mystery", value: 10 }],
                    goal: "Destroy the meteor before anyone uses it — it is a seed of something far older and worse than any of them know.",
                    secret: "She was once a servant of a deep oracle. She survived when the previous fragment fell eighty years ago. She still hears the deep oracle in her dreams.",
                    knowledge: [
                        "The meteor is a fragment of an Outer Beyond artefact — using it once will tear a thin spot in reality.",
                        "There is a ritual that can unmake the fragment, but it requires a willing sacrifice.",
                        "Old Mab is older than she pretends and has seen this kind of object before.",
                        "If the Umbral Cartel move the fragment far enough, it will start to attract more like itself.",
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
        title: "Пустая кампания",
        subtitle: "Чистый мир. Пишите свой текст, вставляйте заметки сессий или рисуйте граф вручную.",
        emoji: "📜",
        text: ``,
        seed: {
            entities: [],
            locations: [{ name: "Unknown Realm", emoji: "🌍", kind: "unknown" }],
        }
    },
];
