import { Button } from "@nextui-org/react";
import { ChangeEvent, useMemo, useRef, useState } from "react";
import { GiWorld } from "react-icons/gi";
import { IoCheckmarkCircle, IoClose, IoCopyOutline, IoDocumentTextOutline, IoOpenOutline } from "react-icons/io5";
import { LayoutUtils } from "../../model/LayoutUtils";
import { useModelStore } from "../../model/Model";
import {
    AZGAAR_MAP_URL,
    MAX_AZGAAR_JSON_BYTES,
    AzgaarExportSummary,
    AzgaarImportMode,
    azgaarPlaceToLocation,
    buildAzgaarCampaignBrief,
    planAzgaarImport,
    readAzgaarExport,
} from "../../model/dnd/azgaarImport";
import { CreateLocatioNode } from "../locationView/LocationNodeComponent";

interface MapWorkflowPanelProps {
    onClose: () => void;
    canvasCenter: { x: number; y: number };
}

function nextLocationIndex(existingIds: Set<string>, startAt: number): number {
    let index = startAt;
    while (existingIds.has(`location-${index}`)) index += 1;
    return index;
}

export default function MapWorkflowPanel({ onClose, canvasCenter }: MapWorkflowPanelProps) {
    const locationNodes = useModelStore((state) => state.locationNodes);
    const campaignText = useModelStore((state) => state.text);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [summary, setSummary] = useState<AzgaarExportSummary | null>(null);
    const [fileName, setFileName] = useState("");
    const [mode, setMode] = useState<AzgaarImportMode>("important");
    const [isReading, setIsReading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [feedback, setFeedback] = useState<string | null>(null);

    const brief = useMemo(
        () => buildAzgaarCampaignBrief(campaignText, locationNodes.map((node) => node.data)),
        [campaignText, locationNodes],
    );
    const plan = useMemo(
        () => summary
            ? planAzgaarImport(summary, locationNodes.map((node) => node.data.name), mode)
            : null,
        [locationNodes, mode, summary],
    );

    const copyBrief = async () => {
        setError(null);
        try {
            await navigator.clipboard.writeText(brief);
            setFeedback("Бриф скопирован. Откройте Azgaar и используйте его как checklist мира.");
        } catch {
            setError("Браузер не дал доступ к буферу обмена. Выделите текст брифа и скопируйте вручную.");
        }
    };

    const readFile = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;

        setError(null);
        setFeedback(null);
        setSummary(null);
        setFileName(file.name);

        if (!file.name.toLocaleLowerCase("en").endsWith(".json")) {
            setError("Нужен JSON-файл. В Azgaar выберите Export → JSON → Minimal.");
            return;
        }
        if (file.size > MAX_AZGAAR_JSON_BYTES) {
            setError("Файл больше 8 МБ. Экспортируйте облегчённый вариант JSON → Minimal.");
            return;
        }

        setIsReading(true);
        try {
            setSummary(readAzgaarExport(await file.text()));
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : "Не удалось проверить JSON-файл.");
        } finally {
            setIsReading(false);
        }
    };

    const importPlaces = () => {
        if (!plan || plan.selected.length === 0) return;

        const existing = useModelStore.getState().locationNodes;
        const ids = new Set(existing.map((node) => node.id));
        let index = nextLocationIndex(ids, existing.length);
        const imported = plan.selected.map((place) => {
            index = nextLocationIndex(ids, index);
            const node = CreateLocatioNode(azgaarPlaceToLocation(place), index);
            ids.add(node.id);
            index += 1;
            return node;
        });
        const merged = [...existing, ...imported];
        useModelStore.getState().setLocationNodes(merged);
        LayoutUtils.optimizeNodeLayout(
            "location",
            merged,
            useModelStore.getState().setLocationNodes,
            canvasCenter,
            120,
        );
        setFeedback(`Добавлено ${imported.length} локаций. Повторный импорт этого файла не создаст дубли.`);
    };

    return (
        <section
            className="dnd-overlay-panel"
            aria-labelledby="map-workflow-title"
            style={{
                position: "absolute",
                top: 60,
                right: 16,
                zIndex: 1000,
                width: "min(480px, calc(100vw - 32px))",
                maxHeight: "calc(100% - 76px)",
                overflowY: "auto",
                overscrollBehavior: "contain",
                background: "#fffbf0",
                border: "1px solid #d4c5a0",
                borderRadius: 12,
                boxShadow: "rgba(42, 26, 26, 0.22) 0 12px 36px",
                padding: 16,
                display: "flex",
                flexDirection: "column",
                gap: 14,
                color: "#2a1a1a",
                fontSize: 13,
            }}
        >
            <header style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                <div style={{ display: "flex", gap: 10 }}>
                    <GiWorld aria-hidden="true" style={{ flex: "0 0 auto", fontSize: 28, color: "#7a1f1f" }} />
                    <div>
                        <h2 id="map-workflow-title" style={{ margin: 0, fontSize: 17, lineHeight: 1.2 }}>Карта мира</h2>
                        <p style={{ margin: "4px 0 0", color: "#6b5c4c", lineHeight: 1.4 }}>
                            Создайте карту в Azgaar, затем перенесите подтверждённые города в кампанию.
                        </p>
                    </div>
                </div>
                <Button size="sm" variant="light" isIconOnly onClick={onClose} aria-label="Закрыть панель карты мира">
                    <IoClose />
                </Button>
            </header>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 10 }}>
                <div style={{ border: "1px solid #e2d7bd", borderRadius: 10, padding: 12, background: "#fffdf7" }}>
                    <strong style={{ display: "block", marginBottom: 5 }}>1. Подготовьте мир</strong>
                    <p style={{ margin: "0 0 10px", color: "#6b5c4c", lineHeight: 1.45 }}>
                        Бриф уже содержит известные локации. Он помогает не забыть важные места и спойлеры.
                    </p>
                    <Button size="sm" variant="bordered" startContent={<IoCopyOutline />} onClick={() => void copyBrief()}>
                        Скопировать бриф
                    </Button>
                </div>
                <div style={{ border: "1px solid #e2d7bd", borderRadius: 10, padding: 12, background: "#fffdf7" }}>
                    <strong style={{ display: "block", marginBottom: 5 }}>2. Нарисуйте карту</strong>
                    <p style={{ margin: "0 0 10px", color: "#6b5c4c", lineHeight: 1.45 }}>
                        Откроется официальный сайт. Сохраните `.map`, затем сделайте JSON → Minimal.
                    </p>
                    <Button
                        as="a"
                        size="sm"
                        color="primary"
                        href={AZGAAR_MAP_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        startContent={<IoOpenOutline />}
                    >
                        Открыть Azgaar
                    </Button>
                </div>
            </div>

            <details style={{ border: "1px solid #e2d7bd", borderRadius: 9, padding: "8px 10px", background: "#fffdf7" }}>
                <summary style={{ cursor: "pointer", fontWeight: 700 }}>Посмотреть готовый бриф</summary>
                <pre style={{ margin: "10px 0 0", whiteSpace: "pre-wrap", overflowWrap: "anywhere", font: "12px/1.5 ui-monospace, monospace", color: "#4b4035" }}>
                    {brief}
                </pre>
            </details>

            <div style={{ borderTop: "1px solid #e2d7bd", paddingTop: 14 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div>
                        <strong style={{ display: "block" }}>3. Импортируйте города</strong>
                        <span style={{ color: "#6b5c4c" }}>Только после preview — кампания пока не изменяется.</span>
                    </div>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".json,application/json"
                        onChange={(event) => void readFile(event)}
                        hidden
                    />
                    <Button
                        size="sm"
                        variant="bordered"
                        isLoading={isReading}
                        startContent={isReading ? undefined : <IoDocumentTextOutline />}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        Выбрать Minimal JSON
                    </Button>
                </div>

                {fileName && <p style={{ margin: "8px 0 0", color: "#6b5c4c", overflowWrap: "anywhere" }}>Файл: {fileName}</p>}
                {summary && plan && (
                    <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                        <div style={{ borderRadius: 9, background: "#f3ead5", padding: 10 }}>
                            <strong>{summary.mapName}</strong>
                            <div style={{ color: "#6b5c4c", marginTop: 3 }}>
                                Найдено мест: {summary.places.length} · дублей: {plan.duplicates.length} · пропущено или объединено: {summary.skippedPlaceCount}
                                {summary.version ? ` · Azgaar ${summary.version}` : ""}
                            </div>
                        </div>

                        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
                            <legend style={{ fontWeight: 700, marginBottom: 6 }}>Сколько добавить</legend>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                <Button
                                    size="sm"
                                    color={mode === "important" ? "primary" : "default"}
                                    variant={mode === "important" ? "solid" : "bordered"}
                                    onClick={() => setMode("important")}
                                    aria-pressed={mode === "important"}
                                >
                                    Значимые · до 24
                                </Button>
                                <Button
                                    size="sm"
                                    color={mode === "expanded" ? "primary" : "default"}
                                    variant={mode === "expanded" ? "solid" : "bordered"}
                                    onClick={() => setMode("expanded")}
                                    aria-pressed={mode === "expanded"}
                                >
                                    Расширенный · до 60
                                </Button>
                            </div>
                        </fieldset>

                        <div>
                            <strong>Будет добавлено: {plan.selected.length}</strong>
                            <p style={{ margin: "4px 0 0", color: "#6b5c4c", lineHeight: 1.45 }}>
                                {plan.selected.slice(0, 8).map((place) => place.name).join(" · ")}
                                {plan.selected.length > 8 ? ` · ещё ${plan.selected.length - 8}` : ""}
                            </p>
                            {plan.availableCount > plan.limit && (
                                <p style={{ margin: "5px 0 0", color: "#8a5a17" }}>
                                    Ещё {plan.availableCount - plan.limit} мест не добавятся, чтобы не перегрузить граф.
                                </p>
                            )}
                        </div>

                        <Button
                            color="primary"
                            startContent={<IoCheckmarkCircle />}
                            isDisabled={plan.selected.length === 0}
                            onClick={importPlaces}
                        >
                            {plan.selected.length > 0
                                ? `Добавить ${plan.selected.length} локаций`
                                : "Новых локаций нет"}
                        </Button>
                    </div>
                )}
            </div>

            {error && (
                <p role="alert" style={{ margin: 0, borderRadius: 8, padding: "9px 10px", background: "#fee2e2", color: "#991b1b" }}>
                    {error}
                </p>
            )}
            {feedback && (
                <p aria-live="polite" style={{ margin: 0, borderRadius: 8, padding: "9px 10px", background: "#dcfce7", color: "#166534" }}>
                    {feedback}
                </p>
            )}

            <p style={{ margin: 0, color: "#786957", fontSize: 11, lineHeight: 1.45 }}>
                DnD Forge не загружает файл на сервер. `.map` не поддерживается: храните его как резервную рабочую копию.
            </p>
        </section>
    );
}
