import { Button } from "@nextui-org/react";
import { ChangeEvent, useMemo, useRef, useState } from "react";
import { GiWorld } from "react-icons/gi";
import { IoCheckmarkCircle, IoClose, IoCopyOutline, IoDocumentTextOutline, IoDownloadOutline, IoOpenOutline } from "react-icons/io5";
import { LayoutUtils } from "../../model/LayoutUtils";
import { useModelStore } from "../../model/Model";
import { buildCampaignMapAsset, readMapImport, serializeCampaignMapAsset } from "../../model/dnd/campaignMapContract";
import {
    AZGAAR_MAP_URL,
    MAX_AZGAAR_JSON_BYTES,
    AzgaarExportSummary,
    AzgaarImportMode,
    azgaarPlaceToLocation,
    buildAzgaarCampaignBrief,
    planAzgaarImport,
} from "../../model/dnd/azgaarImport";
import { CreateLocatioNode } from "../locationView/LocationNodeComponent";
import LocationMapWorkshop from "./LocationMapWorkshop";
import MapWorkspaceDialog from "./MapWorkspaceDialog";
import "./MapWorkshop.css";
import "./AtlasWorkspace.css";

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
    const [inputKind, setInputKind] = useState<"azgaar" | "campaign-map-asset" | null>(null);
    const [fileName, setFileName] = useState("");
    const [mode, setMode] = useState<AzgaarImportMode>("important");
    const [isReading, setIsReading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [feedback, setFeedback] = useState<string | null>(null);
    const [workspaceMode, setWorkspaceMode] = useState<"location" | "world">("location");
    const [isDrawing, setIsDrawing] = useState(false);

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
        setInputKind(null);
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
            const result = readMapImport(await file.text());
            setSummary(result.summary);
            setInputKind(result.inputKind);
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
    const downloadCampaignMapAsset = () => {
        if (!summary || !plan || plan.selected.length === 0) return;
        const blob = new Blob(
            [serializeCampaignMapAsset(buildCampaignMapAsset(summary, plan.selected))],
            { type: "application/json" },
        );
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = "campaign-map.asset.json";
        anchor.click();
        URL.revokeObjectURL(url);
        setFeedback("Campaign Map Asset downloaded. Re-import it through the same preview.");
    };


    return (
        <MapWorkspaceDialog onClose={onClose}>
        <section
            className="dnd-overlay-panel map-workflow-panel"
            data-drawing={isDrawing}
            aria-labelledby="map-workflow-title"
        >
            <header className="map-workflow-header">
                <div className="map-workflow-title-group">
                    <GiWorld aria-hidden="true" className="map-workflow-title-icon" />
                    <div>
                        <span className="map-workflow-kicker">Атлас кампании</span>
                        <h2 id="map-workflow-title">Карты кампании</h2>
                        <p>Локации, сюжетные точки и структура мира.</p>
                    </div>
                </div>
                <Button className="map-workflow-close" size="sm" variant="light" isIconOnly onClick={onClose} aria-label="Закрыть карты кампании">
                    <IoClose />
                </Button>
            </header>

            <div role="tablist" aria-label="Режим работы с картами" className="map-workflow-tabs">
                <Button
                    className="map-workflow-tab"
                    size="sm"
                    color={workspaceMode === "location" ? "primary" : "default"}
                    variant={workspaceMode === "location" ? "solid" : "bordered"}
                    role="tab"
                    aria-selected={workspaceMode === "location"}
                    onClick={() => setWorkspaceMode("location")}
                >
                    Карта локации
                </Button>
                <Button
                    className="map-workflow-tab"
                    size="sm"
                    color={workspaceMode === "world" ? "primary" : "default"}
                    variant={workspaceMode === "world" ? "solid" : "bordered"}
                    role="tab"
                    aria-selected={workspaceMode === "world"}
                    onClick={() => setWorkspaceMode("world")}
                >
                    Карта мира
                </Button>
            </div>

            <div className="map-workflow-content">
            {workspaceMode === "location" ? <LocationMapWorkshop onEditorChange={setIsDrawing} /> : <div className="map-world-workflow">
            <div className="map-world-steps">
                <div className="map-world-step">
                    <span className="map-step-number">01</span>
                    <strong>Подготовьте мир</strong>
                    <p>
                        Бриф уже содержит известные локации. Он помогает не забыть важные места и спойлеры.
                    </p>
                    <Button className="map-command-button" size="sm" variant="bordered" startContent={<IoCopyOutline />} onClick={() => void copyBrief()}>
                        Скопировать бриф
                    </Button>
                </div>
                <div className="map-world-step">
                    <span className="map-step-number">02</span>
                    <strong>Нарисуйте карту</strong>
                    <p>
                        Откроется официальный сайт. Сохраните `.map`, затем сделайте JSON → Minimal.
                    </p>
                    <Button
                        className="map-command-button"
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

            <details className="map-brief-drawer">
                <summary>Посмотреть готовый бриф</summary>
                <pre>
                    {brief}
                </pre>
            </details>

            <section className="map-world-import">
                <div className="map-world-section-head">
                    <div>
                        <span className="map-step-number">03</span>
                        <strong>Импортируйте города</strong>
                        <p>Только после preview — кампания пока не изменяется.</p>
                    </div>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".json,application/json"
                        onChange={(event) => void readFile(event)}
                        hidden
                    />
                    <Button
                        className="map-command-button"
                        size="sm"
                        variant="bordered"
                        isLoading={isReading}
                        startContent={isReading ? undefined : <IoDocumentTextOutline />}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        Выбрать Minimal JSON
                    </Button>
                </div>

                {fileName && <p className="map-world-file">Файл: {fileName}</p>}
                {summary && plan && (
                    <div className="map-import-plan">
                        <div className="map-import-summary">
                            <strong>{summary.mapName}</strong>
                            <p>{inputKind === "campaign-map-asset" ? "Campaign Map Asset" : "Azgaar JSON"}</p>
                            <div>
                                Найдено мест: {summary.places.length} · дублей: {plan.duplicates.length} · пропущено или объединено: {summary.skippedPlaceCount}
                                {summary.version ? ` · Azgaar ${summary.version}` : ""}
                            </div>
                        </div>

                        <fieldset className="map-choice-fieldset">
                            <legend>Сколько добавить</legend>
                            <div className="map-choice-group">
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

                        <div className="map-import-selection">
                            <strong>Будет добавлено: {plan.selected.length}</strong>
                            <p>
                                {plan.selected.slice(0, 8).map((place) => place.name).join(" · ")}
                                {plan.selected.length > 8 ? ` · ещё ${plan.selected.length - 8}` : ""}
                            </p>
                            {plan.availableCount > plan.limit && (
                                <p className="map-limit-note">
                                    Ещё {plan.availableCount - plan.limit} мест не добавятся, чтобы не перегрузить граф.
                                </p>
                            )}
                        </div>

                        <div className="map-import-actions">
                            <Button
                                className="map-command-button"
                                color="primary"
                                startContent={<IoCheckmarkCircle />}
                                isDisabled={plan.selected.length === 0}
                                onClick={importPlaces}
                            >
                                {plan.selected.length > 0
                                    ? `Добавить ${plan.selected.length} локаций`
                                    : "Новых локаций нет"}
                            </Button>
                            <Button
                                className="map-command-button"
                                variant="bordered"
                                startContent={<IoDownloadOutline />}
                                isDisabled={plan.selected.length === 0}
                                onClick={downloadCampaignMapAsset}
                            >
                                Скачать Campaign Map Asset
                            </Button>
                        </div>
                    </div>
                )}
            </section>

            {error && (
                <p role="alert" className="map-message is-error">
                    {error}
                </p>
            )}
            {feedback && (
                <p aria-live="polite" className="map-message is-success">
                    {feedback}
                </p>
            )}

            <p className="map-legal-note">
                Приложение не загружает файл на сервер. Формат `.map` не поддерживается: храните его как резервную рабочую копию.
            </p>
            </div>}
            </div>
        </section>
        </MapWorkspaceDialog>
    );
}
