import { Button, Input, Tooltip } from "@nextui-org/react";
import { useMemo, useState } from "react";
import { GiBroom, GiCrossedSwords, GiSwordman } from "react-icons/gi";
import { IoAdd, IoClose, IoTrash } from "react-icons/io5";
import { Entity, useModelStore } from "../../model/Model";
import { InitiativeEntry, useInitiativeStore } from "../../store/useInitiativeStore";

interface InitiativePanelProps {
    onClose: () => void;
}

function rollD20Plus(modifier: number): number {
    return Math.floor(Math.random() * 20) + 1 + modifier;
}

function dexModifierFromEntity(entity: Entity | undefined): number {
    const dex = entity?.abilities?.dex;
    if (typeof dex !== "number") return 0;
    return Math.floor((dex - 10) / 2);
}

export default function InitiativePanel({ onClose }: InitiativePanelProps) {
    const entries = useInitiativeStore((s) => s.entries);
    const activeIndex = useInitiativeStore((s) => s.activeIndex);
    const round = useInitiativeStore((s) => s.round);
    const active = useInitiativeStore((s) => s.active);

    const entityNodes = useModelStore((s) => s.entityNodes);

    const [newName, setNewName] = useState("");
    const [newInit, setNewInit] = useState("");

    // Entities not yet in the tracker — surfaced as "add by click" chips.
    const availableEntities = useMemo(() => {
        const inTracker = new Set(entries.map((e) => e.entityId).filter(Boolean));
        return entityNodes.filter((n) => !inTracker.has(n.id));
    }, [entries, entityNodes]);

    const addFromEntity = (entityNodeId: string) => {
        const node = entityNodes.find((n) => n.id === entityNodeId);
        if (!node) return;
        const data = node.data as Entity;
        const mod = dexModifierFromEntity(data);
        const initiative = rollD20Plus(mod);
        const entry: InitiativeEntry = {
            id: `init-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            name: data.name,
            entityId: entityNodeId,
            initiative,
            hp: data.hp,
        };
        useInitiativeStore.getState().addEntry(entry);
    };

    const addCustom = () => {
        const name = newName.trim();
        const init = parseInt(newInit, 10);
        if (!name || !Number.isFinite(init)) return;
        useInitiativeStore.getState().addEntry({
            id: `init-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            name,
            initiative: init,
        });
        setNewName("");
        setNewInit("");
    };

    return (
        <div
            style={{
                position: "absolute",
                top: 60,
                right: 16,
                zIndex: 1000,
                width: 420,
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
                    <GiSwordman style={{ fontSize: 24, color: "#7a1f1f" }} />
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <span style={{ fontWeight: 800, color: "#2a1a1a", lineHeight: 1.1 }}>Инициатива</span>
                        <span style={{ fontSize: 10, color: "#6b5c4c", lineHeight: 1.1 }}>
                            {active ? `Бой — Раунд ${round}` : "Бой ещё не начат"}
                        </span>
                    </div>
                </div>
                <Button size="sm" variant="light" isIconOnly onClick={onClose} aria-label="Закрыть панель инициативы">
                    <IoClose />
                </Button>
            </div>

            {availableEntities.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={{ fontSize: 11, color: "#6b5c4c" }}>Добавить из графа мира (авто-бросок d20 + мод. ЛОВ):</span>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {availableEntities.slice(0, 16).map((n) => {
                            const e = n.data as Entity;
                            return (
                                <button
                                    key={n.id}
                                    onClick={() => addFromEntity(n.id)}
                                    style={{
                                        fontSize: 11,
                                        padding: "2px 8px",
                                        borderRadius: 999,
                                        border: "1px solid #d4c5a0",
                                        background: "#fffbf0",
                                        cursor: "pointer",
                                    }}
                                >
                                    {e.emoji} {e.name}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            <div style={{ display: "flex", gap: 6, alignItems: "flex-end" }}>
                <Input
                    size="sm"
                    variant="faded"
                    label="Имя"
                    placeholder="напр. Странствующий бард"
                    value={newName}
                    onValueChange={setNewName}
                    style={{ flex: 2 }}
                />
                <Input
                    size="sm"
                    variant="faded"
                    label="Иниц."
                    type="number"
                    value={newInit}
                    onValueChange={setNewInit}
                    style={{ width: 70 }}
                />
                <Button size="sm" isIconOnly variant="bordered" onClick={addCustom} aria-label="Добавить">
                    <IoAdd />
                </Button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 320, overflowY: "auto" }}>
                {entries.length === 0 && (
                    <div style={{ color: "#9a8a7a", fontStyle: "italic", textAlign: "center", padding: 16, fontSize: 12 }}>
                        Добавьте сущности и начните бой для отслеживания ходов.
                    </div>
                )}
                {entries.map((e, idx) => {
                    const isActive = active && idx === activeIndex;
                    return (
                        <div
                            key={e.id}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                padding: "6px 8px",
                                borderRadius: 6,
                                background: isActive ? "#7a1f1f" : "#f0e4c8",
                                color: isActive ? "#fdf6e3" : "#2a1a1a",
                                fontWeight: isActive ? 700 : 400,
                            }}
                        >
                            <span style={{
                                fontSize: 11,
                                fontWeight: 700,
                                padding: "1px 6px",
                                borderRadius: 4,
                                background: isActive ? "#fdf6e3" : "#2a1a1a",
                                color: isActive ? "#2a1a1a" : "#fdf6e3",
                                minWidth: 24,
                                textAlign: "center",
                            }}>
                                {e.initiative}
                            </span>
                            <span style={{ flex: 1, fontSize: 13 }}>{e.name}</span>
                            {typeof e.hp === "number" && (
                                <Input
                                    size="sm"
                                    variant="flat"
                                    type="number"
                                    aria-label="HP"
                                    value={String(e.hp)}
                                    onValueChange={(v) => useInitiativeStore.getState().updateEntry(e.id, { hp: parseInt(v, 10) || 0 })}
                                    classNames={{ inputWrapper: "!min-h-[24px] h-[24px]", input: "!text-[11px]" }}
                                    style={{ width: 60 }}
                                    startContent={<span style={{ fontSize: 9 }}>HP</span>}
                                />
                            )}
                            <Tooltip content="Удалить из трекера" closeDelay={0}>
                                <Button
                                    size="sm"
                                    isIconOnly
                                    variant="light"
                                    onClick={() => useInitiativeStore.getState().removeEntry(e.id)}
                                    style={{ minWidth: 22, height: 22, color: isActive ? "#fdf6e3" : "#7a1f1f" }}
                                    aria-label="Удалить"
                                >
                                    <IoTrash style={{ fontSize: 12 }} />
                                </Button>
                            </Tooltip>
                        </div>
                    );
                })}
            </div>

            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {!active ? (
                    <Button
                        size="sm"
                        color="primary"
                        startContent={<GiCrossedSwords />}
                        onClick={() => useInitiativeStore.getState().startCombat()}
                        isDisabled={entries.length === 0}
                        style={{ background: "#7a1f1f" }}
                    >
                        Начать бой
                    </Button>
                ) : (
                    <>
                        <Button
                            size="sm"
                            color="primary"
                            onClick={() => useInitiativeStore.getState().nextTurn()}
                            style={{ background: "#7a1f1f" }}
                        >
                            Следующий ход →
                        </Button>
                        <Button
                            size="sm"
                            variant="bordered"
                            onClick={() => useInitiativeStore.getState().endCombat()}
                        >
                            Завершить бой
                        </Button>
                    </>
                )}
                <div style={{ flex: 1 }} />
                <Tooltip content="Очистить трекер" closeDelay={0}>
                    <Button
                        size="sm"
                        isIconOnly
                        variant="light"
                        onClick={() => useInitiativeStore.getState().clearAll()}
                        isDisabled={entries.length === 0}
                        aria-label="Очистить трекер"
                    >
                        <GiBroom />
                    </Button>
                </Tooltip>
            </div>
        </div>
    );
}
