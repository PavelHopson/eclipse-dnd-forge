import { Button, Input, Select, SelectItem, Textarea, Tooltip } from "@nextui-org/react";
import { useState } from "react";
import { GiBattleAxe, GiScrollQuill, GiSpellBook } from "react-icons/gi";
import { IoClose } from "react-icons/io5";
import { Location, useModelStore } from "../../model/Model";
import { EncounterCriteria, EncounterDifficulty, GeneratedEncounter, calcXpBudget, generateEncounterIntoScene } from "../../model/prompts/generators/EncounterGenerator";
import { insertTextAtCursor } from "../../model/agents/sessionInjector";

interface EncounterGeneratorPanelProps {
    onClose: () => void;
    locationId: string;
    canvasCenter: { x: number; y: number };
}

const DIFFICULTY_OPTIONS: { key: EncounterDifficulty; label: string }[] = [
    { key: "easy", label: "Лёгкий" },
    { key: "medium", label: "Средний" },
    { key: "hard", label: "Тяжёлый" },
    { key: "deadly", label: "Смертельный" },
];

export default function EncounterGeneratorPanel({ onClose, locationId, canvasCenter }: EncounterGeneratorPanelProps) {
    const locationNode = useModelStore((s) => s.locationNodes.find((n) => n.id === locationId));

    const [partyLevel, setPartyLevel] = useState("3");
    const [partySize, setPartySize] = useState("4");
    const [difficulty, setDifficulty] = useState<EncounterDifficulty>("medium");
    const [notes, setNotes] = useState("");

    const [isGenerating, setIsGenerating] = useState(false);
    const [result, setResult] = useState<GeneratedEncounter | null>(null);
    const [error, setError] = useState<string | null>(null);

    if (!locationNode) return null;
    const location = locationNode.data as Location;

    const lvl = Math.max(1, Math.min(20, parseInt(partyLevel, 10) || 3));
    const size = Math.max(1, Math.min(8, parseInt(partySize, 10) || 4));
    const budget = calcXpBudget(lvl, size, difficulty);

    const generate = async () => {
        setIsGenerating(true);
        setError(null);
        setResult(null);
        try {
            const criteria: EncounterCriteria = {
                location,
                partyLevel: lvl,
                partySize: size,
                difficulty,
                notes: notes || undefined,
            };
            const { encounter } = await generateEncounterIntoScene(criteria, canvasCenter);
            setResult(encounter);
        } catch (e: any) {
            setError(typeof e?.message === "string" ? e.message : "Не удалось сгенерировать энкаунтер.");
        } finally {
            setIsGenerating(false);
        }
    };

    const insertEncounter = () => {
        if (!result) return;
        const monsterLines = result.monsters
            .map((m) => `- ${m.count}× **${m.name}** (${m.role}, ${m.combatRole}) — HP ${m.hp}, AC ${m.ac}, CR ${m.cr}`)
            .join("\n");
        const block = `**Энкаунтер в локации ${location.name}** (${difficulty}, оценка XP ${result.xpBudgetEstimate} против бюджета ${budget}):\n\n${monsterLines}\n\n*Изюминка:* ${result.twist}`;
        insertTextAtCursor(block);
    };

    return (
        <div
            className="dnd-overlay-panel"
            style={{
                position: "absolute",
                top: 60,
                right: 16,
                zIndex: 1000,
                width: 380,
                maxHeight: "calc(100% - 80px)",
                background: "#fffbf0",
                border: "1px solid #d4c5a0",
                borderRadius: 10,
                boxShadow: "rgba(0, 0, 0, 0.18) 0px 8px 24px",
                padding: 14,
                display: "flex",
                flexDirection: "column",
                gap: 10,
                fontSize: 13,
            }}
        >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <GiBattleAxe style={{ fontSize: 22, color: "#7a1f1f" }} />
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <span style={{ fontWeight: 800, color: "#2a1a1a", lineHeight: 1.1 }}>Генератор энкаунтера</span>
                        <span style={{ fontSize: 11, color: "#6b5c4c", lineHeight: 1.1 }}>в <strong>{location.name}</strong></span>
                    </div>
                </div>
                <Button size="sm" variant="light" isIconOnly onClick={onClose} aria-label="Закрыть генератор энкаунтеров">
                    <IoClose />
                </Button>
            </div>

            {!result && (
                <>
                    <div style={{ display: "flex", gap: 8 }}>
                        <Input
                            size="sm"
                            variant="faded"
                            label="Уровень партии"
                            type="number"
                            value={partyLevel}
                            onValueChange={setPartyLevel}
                            isDisabled={isGenerating}
                            style={{ flex: 1 }}
                        />
                        <Input
                            size="sm"
                            variant="faded"
                            label="Размер партии"
                            type="number"
                            value={partySize}
                            onValueChange={setPartySize}
                            isDisabled={isGenerating}
                            style={{ flex: 1 }}
                        />
                    </div>
                    <Select
                        size="sm"
                        variant="faded"
                        label="Сложность"
                        selectedKeys={[difficulty]}
                        onChange={(e) => setDifficulty(e.target.value as EncounterDifficulty)}
                        isDisabled={isGenerating}
                    >
                        {DIFFICULTY_OPTIONS.map((opt) => (
                            <SelectItem key={opt.key} value={opt.key} textValue={opt.label}>
                                {opt.label}
                            </SelectItem>
                        ))}
                    </Select>
                    <Textarea
                        size="sm"
                        variant="faded"
                        label="Заметки DM (опционально)"
                        placeholder="Конкретный тип монстра, тематика, окружающие ограничения…"
                        value={notes}
                        onValueChange={setNotes}
                        minRows={2}
                        isDisabled={isGenerating}
                    />
                    <div style={{ fontSize: 11, color: "#6b5c4c", padding: "4px 8px", background: "#f0e4c8", borderRadius: 4 }}>
                        Целевой XP бюджет: <strong>{budget}</strong> ({size} × уровень {lvl}, {difficulty})
                    </div>

                    {error && (
                        <div style={{ fontSize: 11, color: "#7a1f1f", background: "#fde2e2", padding: 6, borderRadius: 6 }}>
                            {error}
                        </div>
                    )}

                    <Button
                        size="sm"
                        color="primary"
                        isLoading={isGenerating}
                        onClick={generate}
                        startContent={!isGenerating ? <GiSpellBook /> : null}
                        style={{ background: "#7a1f1f" }}
                    >
                        {isGenerating ? "Куём энкаунтер…" : "Сгенерировать энкаунтер"}
                    </Button>
                </>
            )}

            {result && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ fontSize: 12, color: "#3a2a2a" }}>
                        Создано <strong>{result.monsters.reduce((s, m) => s + Math.max(1, Math.round(m.count)), 0)}</strong> существ в <strong>{result.monsters.length}</strong> групп(ах). Оценка XP {result.xpBudgetEstimate} против целевого бюджета {budget}.
                    </div>
                    <div style={{ background: "#fffefb", border: "1px solid #e8dcc0", borderRadius: 6, padding: 8, display: "flex", flexDirection: "column", gap: 6, maxHeight: 240, overflowY: "auto" }}>
                        {result.monsters.map((m, i) => (
                            <div key={i} style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: 12 }}>
                                <div>
                                    <span style={{ fontSize: 16, marginRight: 4 }}>{m.emoji}</span>
                                    <strong>{m.count}× {m.name}</strong> <span style={{ fontSize: 10, opacity: 0.7 }}>— {m.role}</span>
                                </div>
                                <div style={{ fontSize: 10, color: "#6b5c4c", display: "flex", gap: 6, flexWrap: "wrap" }}>
                                    <span>HP {m.hp}</span><span>AC {m.ac}</span><span>CR {m.cr}</span>
                                    <span style={{ background: "#2a1a1a", color: "#fdf6e3", padding: "0 4px", borderRadius: 3, fontSize: 9 }}>{m.combatRole}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div style={{ fontSize: 12, color: "#3a2a2a", background: "#f0e4c8", padding: 8, borderRadius: 6, lineHeight: 1.4 }}>
                        <span style={{ fontWeight: 700, marginRight: 4 }}>Изюминка:</span>
                        {result.twist}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                        <Tooltip content="Вставить блок энкаунтера в текст сессии в позицию курсора" closeDelay={0}>
                            <Button size="sm" variant="bordered" startContent={<GiScrollQuill />} onClick={insertEncounter}>
                                Вставить в сессию
                            </Button>
                        </Tooltip>
                        <Button size="sm" variant="light" onClick={() => { setResult(null); setError(null); }}>
                            Создать ещё
                        </Button>
                        <Button size="sm" color="primary" onClick={onClose} style={{ background: "#7a1f1f" }}>
                            Готово
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
