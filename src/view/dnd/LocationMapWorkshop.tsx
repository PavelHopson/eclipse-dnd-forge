import { Button } from "@nextui-org/react";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { IoCheckmarkCircle, IoImageOutline, IoOpenOutline, IoTrashOutline, IoWarningOutline } from "react-icons/io5";
import { useModelStore } from "../../model/Model";
import {
    LocationMapCommercialRights,
    LocationMapGridType,
    LocationMapIpRisk,
    LocationMapProvenance,
    LocationMapRightsBasis,
    LocationMapScaleUnit,
    MAX_LOCATION_MAP_PREVIEW_BYTES,
    MAX_LOCATION_MAP_SOURCE_BYTES,
    createLocationMapAsset,
    evaluateLocationMapRights,
    validateLocationMapPreviewDataUrl,
    validateLocationMapSourceHeader,
} from "../../model/dnd/locationMap";
import { useLocationMapStore } from "../../store/useLocationMapStore";
import { useMapStoryPinStore } from "../../store/useMapStoryPinStore";
import LivingAtlasEditor from "./LivingAtlasEditor";
import type { LivingAtlasDocument } from "../../model/dnd/livingAtlas";
import MapStoryPins from "./MapStoryPins";

const DUNGEON_SCRAWL_URL = "https://app.dungeonscrawl.com/";

const rightsBasisLabels: Record<LocationMapRightsBasis, string> = {
    original: "Создано мной",
    licensed: "Лицензировано",
    "public-domain": "Public domain",
    generated: "Сгенерировано",
    "external-tool": "Внешний редактор",
    unverified: "Источник не проверен",
};

const gridTypeLabels: Record<LocationMapGridType, string> = {
    square: "Квадратная сетка",
    hex: "Гексы",
    none: "Без сетки",
};

const rightsStateLabels = {
    allowed: "проверено",
    "review-required": "нужна проверка",
    blocked: "заблокировано",
} as const;

const reasonLabels = {
    "source-rights-unverified": "Права на источник не подтверждены",
    "creator-missing": "Не указан автор",
    "provider-missing": "Не указан сервис или провайдер",
    "source-record-missing": "Нет HTTPS-ссылки на источник или условия",
    "license-missing": "Не указана лицензия",
    "attribution-missing": "Не записана обязательная атрибуция",
    "commercial-rights-unverified": "Коммерческие права не подтверждены",
    "commercial-use-prohibited": "Коммерческое использование запрещено",
    "real-person-consent-missing": "Нет подтверждения согласия изображённого человека",
    "derivative-risk-review": "Нужна проверка сходства с чужой франшизой",
    "derivative-risk-blocked": "Высокий риск производного контента",
} as const;

function dataUrlBytes(value: string): number {
    const payload = value.split(",", 2)[1] ?? "";
    const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;
    return Math.floor(payload.length * 3 / 4) - padding;
}

async function createPreview(file: File): Promise<string> {
    const bitmap = await createImageBitmap(file);
    try {
        for (const [maxSide, quality] of [[1200, 0.76], [960, 0.66], [720, 0.58]] as const) {
            const ratio = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
            const canvas = document.createElement("canvas");
            canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
            canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
            const context = canvas.getContext("2d", { alpha: false });
            if (!context) throw new Error("Браузер не смог подготовить безопасный preview.");
            context.fillStyle = "#f8f1df";
            context.fillRect(0, 0, canvas.width, canvas.height);
            context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
            const preview = canvas.toDataURL("image/webp", quality);
            if (preview.startsWith("data:image/webp") && dataUrlBytes(preview) <= MAX_LOCATION_MAP_PREVIEW_BYTES) {
                return validateLocationMapPreviewDataUrl(preview);
            }
        }
    } finally {
        bitmap.close();
    }
    throw new Error("Не удалось уменьшить preview до безопасного лимита 384 КБ.");
}

export default function LocationMapWorkshop({ onEditorChange }: { onEditorChange?: (open: boolean) => void }) {
    const locationNodes = useModelStore((state) => state.locationNodes);
    const selectedNodes = useModelStore((state) => state.selectedNodes);
    const selectedLocation = locationNodes.find((node) => selectedNodes.includes(node.id));
    const [locationId, setLocationId] = useState(selectedLocation?.id ?? locationNodes[0]?.id ?? "");
    const [name, setName] = useState("");
    const [fileName, setFileName] = useState("");
    const [previewDataUrl, setPreviewDataUrl] = useState("");
    const [gridType, setGridType] = useState<LocationMapGridType>("square");
    const [scale, setScale] = useState(5);
    const [unit, setUnit] = useState<LocationMapScaleUnit>("ft");
    const [widthCells, setWidthCells] = useState(30);
    const [heightCells, setHeightCells] = useState(20);
    const [rightsBasis, setRightsBasis] = useState<LocationMapRightsBasis>("original");
    const [creator, setCreator] = useState("Автор кампании");
    const [provider, setProvider] = useState("");
    const [sourceUrl, setSourceUrl] = useState("");
    const [license, setLicense] = useState("");
    const [attribution, setAttribution] = useState("");
    const [commercialIntent, setCommercialIntent] = useState(false);
    const [commercialRights, setCommercialRights] = useState<LocationMapCommercialRights>("not-requested");
    const [containsRealPerson, setContainsRealPerson] = useState(false);
    const [consentEvidence, setConsentEvidence] = useState("");
    const [ipRisk, setIpRisk] = useState<LocationMapIpRisk>("none");
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [feedback, setFeedback] = useState<string | null>(null);
    const [activeMapId, setActiveMapId] = useState("");
    const [isImportOpen, setIsImportOpen] = useState(false);
    const [isAtlasOpen, setIsAtlasOpen] = useState(false);
    const [editingMapId, setEditingMapId] = useState("");
    const [pendingAtlas, setPendingAtlas] = useState<LivingAtlasDocument | undefined>();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const importRef = useRef<HTMLDetailsElement>(null);
    useEffect(() => { onEditorChange?.(isAtlasOpen); }, [isAtlasOpen, onEditorChange]);
    useEffect(() => {
        if (!isAtlasOpen && previewDataUrl) importRef.current?.scrollIntoView({ block: "start" });
    }, [isAtlasOpen, previewDataUrl]);

    const library = useLocationMapStore((state) => state.library);
    const storageError = useLocationMapStore((state) => state.storageError);
    const maps = library.maps.filter((map) => map.locationId === locationId);
    const activeMap = maps.find((map) => map.id === activeMapId) ?? maps[0];
    const editingMap = maps.find((map) => map.id === editingMapId);

    const provenance = useMemo<LocationMapProvenance>(() => ({
        rightsBasis,
        creator: creator.trim(),
        provider: provider.trim(),
        sourceUrl: sourceUrl.trim() || null,
        license: license.trim(),
        attribution: attribution.trim(),
        commercialIntent,
        commercialRights: commercialIntent ? commercialRights : "not-requested",
        containsRealPerson,
        consentEvidence: consentEvidence.trim(),
        ipRisk,
    }), [
        attribution, commercialIntent, commercialRights, consentEvidence, containsRealPerson, creator, ipRisk,
        license, provider, rightsBasis, sourceUrl,
    ]);
    const decision = useMemo(() => evaluateLocationMapRights(provenance), [provenance]);

    const readImage = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;
        setIsImportOpen(true);
        setError(null);
        setFeedback(null);
        setPreviewDataUrl("");
        setFileName("");
        setPendingAtlas(undefined);
        setEditingMapId("");

        const extension = file.name.toLocaleLowerCase("en").split(".").pop();
        const expectedMime = extension === "png"
            ? "image/png"
            : extension === "jpg" || extension === "jpeg"
                ? "image/jpeg"
                : extension === "webp" ? "image/webp" : "";
        if (!expectedMime) {
            setError("Выберите PNG, JPEG или WebP. SVG и другие активные форматы не принимаются.");
            return;
        }
        if (file.type && file.type !== expectedMime) {
            setError("Расширение файла не совпадает с его MIME-типом.");
            return;
        }
        if (file.size > MAX_LOCATION_MAP_SOURCE_BYTES) {
            setError("Исходное изображение больше 8 МБ. Сожмите его перед импортом.");
            return;
        }

        setIsProcessing(true);
        try {
            const bytes = new Uint8Array(await file.arrayBuffer());
            validateLocationMapSourceHeader(expectedMime, bytes.subarray(0, 16));
            const preview = await createPreview(file);
            setPreviewDataUrl(preview);
            setFileName(file.name.split(/[\\/]/).pop() ?? "map.webp");
            if (!name) setName(file.name.replace(/\.[^.]+$/, "").slice(0, 80));
            setFeedback("Предпросмотр подготовлен локально. Исходный файл никуда не отправлялся.");
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : "Не удалось проверить изображение.");
        } finally {
            setIsProcessing(false);
        }
    };

    const saveMap = () => {
        setError(null);
        setFeedback(null);
        if (!locationId) {
            setError("Сначала выберите локацию.");
            return;
        }
        if (!previewDataUrl) {
            setError("Сначала выберите изображение карты.");
            return;
        }
        try {
            const randomPart = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
                ? crypto.randomUUID().slice(0, 8)
                : Math.random().toString(36).slice(2, 10);
            const candidate = createLocationMapAsset({
                id: editingMap?.id ?? `map-${Date.now().toString(36)}-${randomPart}`,
                locationId,
                name,
                fileName,
                previewDataUrl,
                grid: { type: gridType, scale, unit, widthCells, heightCells },
                provenance,
                ...(pendingAtlas ? { atlasDocument: { ...pendingAtlas, name, updatedAt: Date.now() } } : {}),
            });
            const map = { ...candidate, createdAt: editingMap?.createdAt ?? candidate.createdAt };
            if (!useLocationMapStore.getState().saveMap(map)) return;
            setActiveMapId(map.id);
            setIsImportOpen(false);
            setPreviewDataUrl("");
            setFileName("");
            setName("");
            setPendingAtlas(undefined);
            setEditingMapId("");
            setFeedback(map.rightsState === "allowed"
                ? "Карта сохранена локально и готова для работы внутри кампании."
                : "Карта сохранена как черновик; публичный и коммерческий экспорт остаётся закрыт.");
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : "Не удалось сохранить карту.");
        }
    };

    const removeMap = (mapId: string) => {
        if (!window.confirm("Удалить карту и её сюжетные метки? Для восстановления нужна резервная копия кампании.")) return;
        if (!useLocationMapStore.getState().removeMap(mapId)) return;
        useMapStoryPinStore.getState().removePinsForMap(mapId);
        if (activeMapId === mapId) setActiveMapId("");
    };

    const useAtlasPreview = (result: {
        previewDataUrl: string;
        name: string;
        fileName: string;
        widthCells: number;
        heightCells: number;
        document: LivingAtlasDocument;
    }) => {
        try {
            setPreviewDataUrl(validateLocationMapPreviewDataUrl(result.previewDataUrl));
            setName(result.name.slice(0, 80));
            setFileName(result.fileName.slice(0, 120));
            setGridType("square");
            setWidthCells(result.widthCells);
            setHeightCells(result.heightCells);
            setPendingAtlas(result.document);
            const imported = result.document.source === "imported" && result.document.id !== editingMap?.atlasDocument?.id;
            const previous = editingMap?.provenance;
            setRightsBasis(imported ? "unverified" : previous?.rightsBasis ?? "original");
            setCreator(previous?.creator ?? "Автор кампании");
            setProvider(previous?.provider ?? "");
            setSourceUrl(previous?.sourceUrl ?? "");
            setLicense(previous?.license ?? "");
            setAttribution(previous?.attribution ?? "");
            setCommercialIntent(previous?.commercialIntent ?? false);
            setCommercialRights(imported ? "unknown" : previous?.commercialRights ?? "not-requested");
            setContainsRealPerson(previous?.containsRealPerson ?? false);
            setConsentEvidence(previous?.consentEvidence ?? "");
            setIpRisk(previous?.ipRisk ?? "none");
            setIsAtlasOpen(false);
            setIsImportOpen(true);
            setError(null);
            setFeedback(imported ? "Импортированный проект не подтверждает права на источник. Заполните сведения перед публикацией."
                : editingMap ? "Изменения готовы. Сохраните карту — её идентификатор и сюжетные метки останутся прежними."
                : "Карта из Living Atlas готова. Проверьте название и сохраните её в локацию.");
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : "Не удалось проверить карту Living Atlas.");
        }
    };

    if (locationNodes.length === 0) {
        return (
            <div className="map-empty-state map-location-empty">
                <strong>Сначала нужна локация</strong>
                <p>Создайте локацию вручную или импортируйте города из карты мира.</p>
            </div>
        );
    }

    if (isAtlasOpen) {
        const locationName = locationNodes.find((node) => node.id === locationId)?.data.name ?? "Новая локация";
        return (
            <LivingAtlasEditor
                key={editingMapId || locationId}
                locationId={locationId}
                mapId={editingMap?.id}
                initialDocument={editingMap?.atlasDocument}
                savedDocumentIds={library.maps.flatMap((map) => map.atlasDocument ? [map.atlasDocument.id] : [])}
                initialName={`${locationName} — карта`}
                onClose={() => setIsAtlasOpen(false)}
                onUsePreview={useAtlasPreview}
            />
        );
    }

    return (
        <div className="location-map-workshop">
            <div className="map-commandbar">
                <label className="map-field" htmlFor="map-location">
                    Локация
                    <select id="map-location" value={locationId} onChange={(event) => setLocationId(event.target.value)}>
                        {locationNodes.map((node) => <option key={node.id} value={node.id}>{node.data.emoji} {node.data.name}</option>)}
                    </select>
                </label>
                <Button
                    className="map-command-button"
                    color="primary"
                    onClick={() => { setEditingMapId(""); setIsAtlasOpen(true); }}
                >
                    Нарисовать карту
                </Button>
                <Button
                    className="map-command-button"
                    variant="bordered"
                    startContent={<IoImageOutline />}
                    onClick={() => { setIsImportOpen(true); fileInputRef.current?.click(); }}
                >
                    Импортировать
                </Button>
                <Button
                    className="map-command-button"
                    as="a"
                    size="sm"
                    variant="bordered"
                    href={DUNGEON_SCRAWL_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    startContent={<IoOpenOutline />}
                >
                    Внешний редактор
                </Button>
            </div>

            {(error || storageError) && <p role="alert" className="map-message is-error">{error || storageError}</p>}
            {feedback && <p aria-live="polite" className="map-message is-success">{feedback}</p>}

            {activeMap && <MapStoryPins key={activeMap.id} map={activeMap} />}

            <details
                ref={importRef}
                className="map-import-drawer"
                open={maps.length === 0 || isImportOpen}
                onToggle={(event) => setIsImportOpen(event.currentTarget.open)}
            >
                <summary>{previewDataUrl ? "Настройте новую карту" : "Добавить новую карту"}</summary>
                <div className="map-import-body">
                    <div className="map-dropzone">
                        <div>
                            <strong>Локальное изображение карты</strong>
                            <p>PNG, JPEG или WebP до 8 МБ. В приложении останется только уменьшенный preview.</p>
                            <input ref={fileInputRef} type="file" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" hidden onChange={(event) => void readImage(event)} />
                        </div>
                        <Button className="map-command-button" variant="bordered" isLoading={isProcessing} startContent={isProcessing ? undefined : <IoImageOutline />} onClick={() => fileInputRef.current?.click()}>
                            Выбрать изображение
                        </Button>
                        {previewDataUrl && (
                            <img
                                className="map-import-preview"
                                src={previewDataUrl}
                                alt={`Preview карты ${name || "локации"}`}
                            />
                        )}
                    </div>

                    <div className="map-config-grid">
                        <label className="map-field map-field-wide" htmlFor="map-name">
                            Название карты
                            <input id="map-name" value={name} maxLength={80} onChange={(event) => setName(event.target.value)} placeholder="Например: Затопленные тоннели" />
                        </label>
                        <label className="map-field" htmlFor="map-grid">
                            Сетка
                            <select id="map-grid" value={gridType} disabled={!!pendingAtlas} onChange={(event) => setGridType(event.target.value as LocationMapGridType)}>
                                <option value="square">Квадратная</option><option value="hex">Гексы</option><option value="none">Без сетки</option>
                            </select>
                        </label>
                        <label className="map-field" htmlFor="map-scale">
                            Масштаб клетки
                            <input id="map-scale" type="number" min={0.1} max={10000} step={0.1} value={scale} onChange={(event) => setScale(Number(event.target.value))} />
                        </label>
                        <label className="map-field" htmlFor="map-unit">
                            Единица
                            <select id="map-unit" value={unit} onChange={(event) => setUnit(event.target.value as LocationMapScaleUnit)}>
                                <option value="ft">футы</option><option value="m">метры</option><option value="km">км</option><option value="mi">мили</option><option value="custom">своя</option>
                            </select>
                        </label>
                        <label className="map-field" htmlFor="map-width">
                            Ширина, клетки
                            <input id="map-width" type="number" min={1} max={500} value={widthCells} disabled={!!pendingAtlas} onChange={(event) => setWidthCells(Number(event.target.value))} />
                        </label>
                        <label className="map-field" htmlFor="map-height">
                            Высота, клетки
                            <input id="map-height" type="number" min={1} max={500} value={heightCells} disabled={!!pendingAtlas} onChange={(event) => setHeightCells(Number(event.target.value))} />
                        </label>
                    </div>

                    <details className="map-provenance">
                        <summary>Права и источник · {rightsStateLabels[decision.state]}</summary>
                        <div className="map-provenance-grid">
                    <label className="map-field" htmlFor="map-rights-basis">
                        Основание прав
                        <select id="map-rights-basis" value={rightsBasis} onChange={(event) => setRightsBasis(event.target.value as LocationMapRightsBasis)}>
                            {Object.entries(rightsBasisLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </select>
                    </label>
                    <label className="map-field" htmlFor="map-creator">
                        Автор / правообладатель
                        <input id="map-creator" value={creator} maxLength={100} onChange={(event) => setCreator(event.target.value)} />
                    </label>
                    {(rightsBasis === "generated" || rightsBasis === "external-tool") && (
                        <label className="map-field" htmlFor="map-provider">
                            Сервис / провайдер
                            <input id="map-provider" value={provider} maxLength={100} onChange={(event) => setProvider(event.target.value)} placeholder="Например: Dungeon Scrawl" />
                        </label>
                    )}
                    {rightsBasis !== "original" && (
                        <>
                            <label className="map-field" htmlFor="map-source-url">
                                HTTPS-ссылка на источник/условия
                                <input id="map-source-url" type="url" value={sourceUrl} maxLength={2048} onChange={(event) => setSourceUrl(event.target.value)} placeholder="https://…" />
                            </label>
                            <label className="map-field" htmlFor="map-license">
                                Лицензия
                                <input id="map-license" value={license} maxLength={160} onChange={(event) => setLicense(event.target.value)} placeholder="CC BY 4.0, договор…" />
                            </label>
                            <label className="map-field map-field-wide" htmlFor="map-attribution">
                                Атрибуция
                                <input id="map-attribution" value={attribution} maxLength={300} onChange={(event) => setAttribution(event.target.value)} />
                            </label>
                        </>
                    )}
                    <label className="map-field" htmlFor="map-ip-risk">
                        Сходство с чужой франшизой
                        <select id="map-ip-risk" value={ipRisk} onChange={(event) => setIpRisk(event.target.value as LocationMapIpRisk)}>
                            <option value="none">Нет</option><option value="review">Нужна проверка</option><option value="blocked">Высокий риск</option>
                        </select>
                    </label>
                    <label className="map-check">
                        <span><input type="checkbox" checked={commercialIntent} onChange={(event) => { setCommercialIntent(event.target.checked); setCommercialRights(event.target.checked ? "unknown" : "not-requested"); }} /> Планируется коммерческое использование</span>
                    </label>
                    {commercialIntent && (
                        <label className="map-field" htmlFor="map-commercial-rights">
                            Коммерческие права
                            <select id="map-commercial-rights" value={commercialRights} onChange={(event) => setCommercialRights(event.target.value as LocationMapCommercialRights)}>
                                <option value="unknown">Не проверены</option><option value="confirmed">Подтверждены документом</option><option value="prohibited">Запрещены</option>
                            </select>
                        </label>
                    )}
                    <label className="map-check">
                        <span><input type="checkbox" checked={containsRealPerson} onChange={(event) => setContainsRealPerson(event.target.checked)} /> На изображении есть узнаваемый реальный человек</span>
                    </label>
                    {containsRealPerson && (
                        <label className="map-field map-field-wide" htmlFor="map-consent">
                            Подтверждение согласия
                            <input id="map-consent" value={consentEvidence} maxLength={300} onChange={(event) => setConsentEvidence(event.target.value)} />
                        </label>
                    )}
                        </div>
                    </details>

                    <div className="map-savebar">
                        <div role="status" className={`map-gate is-${decision.state === "review-required" ? "review" : decision.state}`}>
                            <strong>
                                {decision.state === "allowed" ? <IoCheckmarkCircle /> : <IoWarningOutline />}
                                {decision.state === "allowed" ? "Разрешено для внутренней работы" : decision.state === "blocked" ? "Заблокировано для публикации" : "Нужна проверка перед публикацией"}
                            </strong>
                            {decision.reasons.length > 0 && <p>{decision.reasons.map((reason) => reasonLabels[reason]).join(" · ")}</p>}
                        </div>

                        <Button className="map-command-button" color="primary" startContent={<IoCheckmarkCircle />} onClick={saveMap} isDisabled={!previewDataUrl || !name.trim()}>
                            {editingMap ? "Сохранить изменения карты" : "Сохранить карту"}
                        </Button>
                    </div>
                </div>
            </details>

            {maps.length > 0 && (
                <section aria-label="Сохранённые карты локации" className="map-library">
                    <div className="map-section-heading">
                        <strong>Карты локации</strong>
                        <span>{maps.length} в локации · {library.maps.length} / 8 в кампании</span>
                    </div>
                    <div className="map-library-grid">
                        {maps.map((map) => (
                            <article key={map.id} className={`map-library-card${activeMap?.id === map.id ? " is-active" : ""}`}>
                                <img src={map.previewDataUrl} alt="" />
                                <div className="map-library-copy">
                                    <strong>{map.name}</strong>
                                    <span>{gridTypeLabels[map.grid.type]} · {map.grid.widthCells}×{map.grid.heightCells} · {rightsStateLabels[map.rightsState]}</span>
                                </div>
                                <div className="map-library-actions">
                                    {map.atlasDocument && <Button size="sm" variant="bordered"
                                        isDisabled={map.rightsState === "blocked"}
                                        onClick={() => { setEditingMapId(map.id); setIsAtlasOpen(true); }}
                                        aria-label={`Редактировать карту ${map.name}`}>Редактировать</Button>}
                                    <Button size="sm" variant={activeMap?.id === map.id ? "solid" : "light"} color={activeMap?.id === map.id ? "primary" : "default"} onClick={() => setActiveMapId(map.id)}>
                                        Открыть
                                    </Button>
                                    <Button isIconOnly size="sm" variant="light" color="danger" aria-label={`Удалить карту ${map.name}`} onClick={() => removeMap(map.id)}>
                                        <IoTrashOutline />
                                    </Button>
                                </div>
                            </article>
                        ))}
                    </div>
                </section>
            )}

            <p className="map-legal-note">
                Dungeon Scrawl и другие VTT — только внешние инструменты. Приложение не копирует их код, интерфейс, форматы или материалы и не подтверждает ваши права автоматически. Проверка названия продукта остаётся отдельным этапом.
            </p>
        </div>
    );
}
