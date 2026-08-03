import { Button, Input, Select, SelectItem, Textarea, Tooltip } from "@nextui-org/react";
import { useState } from "react";
import { GiScrollQuill, GiSpellBook } from "react-icons/gi";
import { IoClose } from "react-icons/io5";
import { insertTextAtCursor } from "../../model/agents/sessionInjector";
import { GeneratedNpc, NpcCriteria, generateNpcIntoScene } from "../../model/prompts/generators/NpcGenerator";

interface NpcGeneratorPanelProps {
    onClose: () => void;
    canvasCenter: { x: number; y: number };
    defaultLocation?: string;
}

const HOSTILITY_OPTIONS: { key: NonNullable<NpcCriteria["hostility"]>; label: string }[] = [
    { key: "any", label: "Любая (на усмотрение DM)" },
    { key: "friendly", label: "Дружелюбный" },
    { key: "neutral", label: "Нейтральный" },
    { key: "hostile", label: "Враждебный" },
];

export default function NpcGeneratorPanel({ onClose, canvasCenter, defaultLocation }: NpcGeneratorPanelProps) {
    const [race, setRace] = useState("");
    const [occupation, setOccupation] = useState("");
    const [partyLevel, setPartyLevel] = useState("3");
    const [location, setLocation] = useState(defaultLocation || "");
    const [hostility, setHostility] = useState<NonNullable<NpcCriteria["hostility"]>>("any");
    const [notes, setNotes] = useState("");

    const [isGenerating, setIsGenerating] = useState(false);
    const [result, setResult] = useState<GeneratedNpc | null>(null);
    const [error, setError] = useState<string | null>(null);

    const generate = async () => {
        setIsGenerating(true);
        setError(null);
        setResult(null);

        try {
            const parsedLevel = parseInt(partyLevel, 10);
            const { npc } = await generateNpcIntoScene(
                {
                    race: race || undefined,
                    occupation: occupation || undefined,
                    partyLevel: Number.isFinite(parsedLevel) ? parsedLevel : 3,
                    location: location || undefined,
                    hostility,
                    notes: notes || undefined,
                },
                canvasCenter,
            );
            setResult(npc);
        } catch (e: any) {
            const message = typeof e?.message === "string" ? e.message : "Не удалось сгенерировать NPC. Проверьте API-ключ и попробуйте снова.";
            setError(message);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div
            className="dnd-overlay-panel"
            style={{
                position: "absolute",
                top: 60,
                right: 16,
                zIndex: 1000,
                width: 320,
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
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <GiSpellBook style={{ fontSize: 20, color: "#7a1f1f" }} />
                    <span style={{ fontWeight: 800, color: "#2a1a1a" }}>Генератор NPC</span>
                </div>
                <Button
                    size="sm"
                    variant="light"
                    isIconOnly
                    onClick={onClose}
                    aria-label="Закрыть генератор NPC"
                >
                    <IoClose />
                </Button>
            </div>

            {!result && (
                <>
                    <Input
                        size="sm"
                        variant="faded"
                        label="Раса / существо"
                        placeholder="Полуорк, кобольд, фея..."
                        value={race}
                        onValueChange={setRace}
                        isDisabled={isGenerating}
                    />
                    <Input
                        size="sm"
                        variant="faded"
                        label="Роль / занятие"
                        placeholder="Трактирщик, капитан бандитов, мудрец..."
                        value={occupation}
                        onValueChange={setOccupation}
                        isDisabled={isGenerating}
                    />
                    <div style={{ display: "flex", gap: 8 }}>
                        <Input
                            size="sm"
                            variant="faded"
                            label="Уровень партии"
                            type="number"
                            value={partyLevel}
                            onValueChange={setPartyLevel}
                            isDisabled={isGenerating}
                            style={{ width: 90 }}
                        />
                        <Select
                            size="sm"
                            variant="faded"
                            label="Враждебность"
                            selectedKeys={[hostility]}
                            onChange={(e) => setHostility(e.target.value as NonNullable<NpcCriteria["hostility"]>)}
                            isDisabled={isGenerating}
                        >
                            {HOSTILITY_OPTIONS.map((opt) => (
                                <SelectItem key={opt.key} value={opt.key} textValue={opt.label}>
                                    {opt.label}
                                </SelectItem>
                            ))}
                        </Select>
                    </div>
                    <Input
                        size="sm"
                        variant="faded"
                        label="Локация"
                        placeholder="Таверна, логово гоблинов..."
                        value={location}
                        onValueChange={setLocation}
                        isDisabled={isGenerating}
                    />
                    <Textarea
                        size="sm"
                        variant="faded"
                        label="Заметки DM (опционально)"
                        placeholder="Сюжетные связи, секреты, что AI должен учесть"
                        value={notes}
                        onValueChange={setNotes}
                        minRows={2}
                        isDisabled={isGenerating}
                    />

                    {error && (
                        <div style={{ fontSize: 12, color: "#7a1f1f", background: "#fde2e2", padding: 8, borderRadius: 6 }}>
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
                        {isGenerating ? "Кузню…" : "Сгенерировать NPC"}
                    </Button>
                </>
            )}

            {result && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 28 }}>{result.emoji}</span>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                            <span style={{ fontWeight: 800, fontSize: 14, color: "#2a1a1a" }}>{result.name}</span>
                            <span style={{ fontSize: 11, color: "#6b5c4c" }}>{result.role}</span>
                        </div>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        <StatChip label="HP" value={result.hp} />
                        <StatChip label="AC" value={result.ac} />
                        <StatChip label="CR" value={result.cr} />
                        <StatChip label="STR" value={result.abilities.str} />
                        <StatChip label="DEX" value={result.abilities.dex} />
                        <StatChip label="CON" value={result.abilities.con} />
                        <StatChip label="INT" value={result.abilities.int} />
                        <StatChip label="WIS" value={result.abilities.wis} />
                        <StatChip label="CHA" value={result.abilities.cha} />
                    </div>
                    <div style={{ fontSize: 12, color: "#3a2a2a", background: "#f0e4c8", padding: 8, borderRadius: 6, lineHeight: 1.4 }}>
                        <span style={{ fontWeight: 700, marginRight: 4 }}>Зацепка:</span>
                        {result.hook}
                        <div style={{ marginTop: 6, display: "flex", justifyContent: "flex-end" }}>
                            <Tooltip content="Вставить зацепку в позицию курсора (или в конец, если курсора нет)" closeDelay={0}>
                                <Button
                                    size="sm"
                                    variant="flat"
                                    startContent={<GiScrollQuill />}
                                    onClick={() => insertTextAtCursor(result.hook)}
                                    style={{
                                        height: 22,
                                        minHeight: 22,
                                        fontSize: 10,
                                        background: "#fffbf0",
                                        border: "1px solid #d4c5a0",
                                    }}
                                >
                                    Вставить зацепку
                                </Button>
                            </Tooltip>
                        </div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                        <Button size="sm" variant="bordered" onClick={() => { setResult(null); setError(null); }}>
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

function StatChip({ label, value }: { label: string; value: number }) {
    return (
        <span
            style={{
                fontSize: 10,
                fontWeight: 700,
                padding: "2px 6px",
                borderRadius: 4,
                background: "#2a1a1a",
                color: "#fdf6e3",
                letterSpacing: 0.3,
            }}
        >
            {label} {value}
        </span>
    );
}
