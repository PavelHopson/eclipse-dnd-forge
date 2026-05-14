import { Button, Input, Tooltip } from "@nextui-org/react";
import { useState } from "react";
import { GiDiceTwentyFacesTwenty, GiScrollQuill } from "react-icons/gi";
import { IoClose, IoDiceOutline } from "react-icons/io5";
import { useModelStore } from "../../model/Model";
import { DiceRollResult, formatRoll, rollDice } from "../../model/dice";
import { insertTextAtCursor } from "../../model/agents/sessionInjector";

interface DiceRollerPanelProps {
    onClose: () => void;
}

const QUICK_DICE = ["d4", "d6", "d8", "d10", "d12", "d20", "d100"];

export default function DiceRollerPanel({ onClose }: DiceRollerPanelProps) {
    const [expr, setExpr] = useState("d20");
    const [history, setHistory] = useState<DiceRollResult[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [scanReport, setScanReport] = useState<string | null>(null);

    const rollAndPush = (e: string) => {
        try {
            setError(null);
            const result = rollDice(e);
            setHistory((h) => [result, ...h].slice(0, 30));
            return result;
        } catch (err: any) {
            setError(typeof err?.message === "string" ? err.message : "Некорректное выражение");
            return null;
        }
    };

    const scanAndRollAll = () => {
        setError(null);
        setScanReport(null);
        const text = useModelStore.getState().text;
        const regex = /\/roll\s+([^\s]+)/gi;
        let replacedAny = false;
        let rollCount = 0;
        const replaced = text.replace(regex, (match, captured: string) => {
            try {
                const result = rollDice(captured);
                replacedAny = true;
                rollCount++;
                setHistory((h) => [result, ...h].slice(0, 30));
                return formatRoll(result);
            } catch {
                return match; // leave unchanged on parse failure
            }
        });

        if (!replacedAny) {
            setScanReport(`В тексте сессии не найдено выражений /roll.`);
            return;
        }

        // The Slate editor in this codebase normalises to a single root
        // paragraph with embedded newlines, so writing back as one text
        // node is the correct shape.
        const newState = [{ children: [{ text: replaced }] }];
        useModelStore.getState().setTextState(newState as any, true, true);
        setScanReport(`Брошено и заменено выражений в сессии: ${rollCount}.`);
    };

    return (
        <div
            style={{
                position: "absolute",
                top: 60,
                right: 16,
                zIndex: 1000,
                width: 360,
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
                    <GiDiceTwentyFacesTwenty style={{ fontSize: 24, color: "#7a1f1f" }} />
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <span style={{ fontWeight: 800, color: "#2a1a1a", lineHeight: 1.1 }}>Кубики</span>
                        <span style={{ fontSize: 10, color: "#6b5c4c", lineHeight: 1.1 }}>Быстрые броски или сканер /roll</span>
                    </div>
                </div>
                <Button size="sm" variant="light" isIconOnly onClick={onClose} aria-label="Закрыть панель кубиков">
                    <IoClose />
                </Button>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {QUICK_DICE.map((d) => (
                    <Button
                        key={d}
                        size="sm"
                        variant="bordered"
                        onClick={() => rollAndPush(d)}
                        style={{ height: 28, minHeight: 28, fontSize: 12 }}
                    >
                        {d}
                    </Button>
                ))}
            </div>

            <div style={{ display: "flex", gap: 6, alignItems: "flex-end" }}>
                <Input
                    size="sm"
                    variant="faded"
                    label="Выражение"
                    placeholder="напр. 2d6+3"
                    value={expr}
                    onValueChange={setExpr}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            e.preventDefault();
                            rollAndPush(expr);
                        }
                    }}
                    style={{ flex: 1 }}
                />
                <Button
                    size="sm"
                    color="primary"
                    startContent={<IoDiceOutline />}
                    onClick={() => rollAndPush(expr)}
                    style={{ background: "#7a1f1f", height: 36 }}
                >
                    Бросить
                </Button>
            </div>

            <Tooltip content="Найти каждое /roll <выражение> в тексте сессии и заменить результатом броска" closeDelay={0}>
                <Button size="sm" variant="flat" onClick={scanAndRollAll}>
                    Найти и бросить все <code style={{ fontSize: 11, background: "#f0e4c8", padding: "0 4px", borderRadius: 3, marginLeft: 4 }}>/roll …</code> в сессии
                </Button>
            </Tooltip>

            {scanReport && (
                <div style={{ fontSize: 11, color: "#3a2a2a", background: "#e6f0d2", padding: 6, borderRadius: 6 }}>
                    {scanReport}
                </div>
            )}
            {error && (
                <div style={{ fontSize: 11, color: "#7a1f1f", background: "#fde2e2", padding: 6, borderRadius: 6 }}>
                    {error}
                </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 260, overflowY: "auto" }}>
                {history.length === 0 ? (
                    <div style={{ color: "#9a8a7a", fontStyle: "italic", textAlign: "center", padding: 12, fontSize: 12 }}>
                        История бросков появится здесь.
                    </div>
                ) : (
                    history.map((r, idx) => (
                        <div
                            key={idx}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                padding: "4px 8px",
                                borderRadius: 6,
                                background: idx === 0 ? "#f0e4c8" : "#fffefb",
                                border: "1px solid #e8dcc0",
                                fontSize: 12,
                            }}
                        >
                            <span style={{ flex: 1 }}>
                                <strong>{r.expr}</strong> ={" "}
                                <span style={{ fontWeight: 800, color: "#7a1f1f" }}>{r.total}</span>{" "}
                                <span style={{ fontSize: 10, color: "#6b5c4c" }}>
                                    ({r.rolls.join("+")}{r.modifier ? (r.modifier > 0 ? `+${r.modifier}` : `${r.modifier}`) : ""})
                                </span>
                            </span>
                            <Tooltip content="Вставить этот бросок в текст сессии в позицию курсора" closeDelay={0}>
                                <Button
                                    size="sm"
                                    isIconOnly
                                    variant="light"
                                    onClick={() => insertTextAtCursor(formatRoll(r))}
                                    style={{ minWidth: 22, height: 22 }}
                                    aria-label="Вставить"
                                >
                                    <GiScrollQuill style={{ fontSize: 12 }} />
                                </Button>
                            </Tooltip>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
