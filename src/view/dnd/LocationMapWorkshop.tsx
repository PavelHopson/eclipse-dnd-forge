import { Button } from "@nextui-org/react";
import { ChangeEvent, useMemo, useRef, useState } from "react";
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
import MapStoryPins from "./MapStoryPins";

const DUNGEON_SCRAWL_URL = "https://app.dungeonscrawl.com/";

const fieldStyle = {
    width: "100%",
    minHeight: 36,
    border: "1px solid #d8c9a8",
    borderRadius: 8,
    background: "#fffdf7",
    color: "#2a1a1a",
    padding: "7px 9px",
    font: "inherit",
} as const;

const labelStyle = { display: "grid", gap: 5, color: "#514438", fontWeight: 700 } as const;

const rightsBasisLabels: Record<LocationMapRightsBasis, string> = {
    original: "Создано мной",
    licensed: "Лицензировано",
    "public-domain": "Public domain",
    generated: "Сгенерировано",
    "external-tool": "Внешний редактор",
    unverified: "Источник не проверен",
};

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

export default function LocationMapWorkshop() {
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
    const fileInputRef = useRef<HTMLInputElement>(null);

    const library = useLocationMapStore((state) => state.library);
    const storageError = useLocationMapStore((state) => state.storageError);
    const maps = library.maps.filter((map) => map.locationId === locationId);
    const activeMap = maps.find((map) => map.id === activeMapId) ?? maps[0];

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
        setError(null);
        setFeedback(null);
        setPreviewDataUrl("");
        setFileName("");

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
            setFeedback("Preview подготовлен локально. Исходный файл никуда не отправлялся.");
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
            const map = createLocationMapAsset({
                id: `map-${Date.now().toString(36)}-${randomPart}`,
                locationId,
                name,
                fileName,
                previewDataUrl,
                grid: { type: gridType, scale, unit, widthCells, heightCells },
                provenance,
            });
            if (!useLocationMapStore.getState().saveMap(map)) return;
            setActiveMapId(map.id);
            setPreviewDataUrl("");
            setFileName("");
            setName("");
            setFeedback(map.rightsState === "allowed"
                ? "Карта сохранена локально и готова для работы внутри кампании."
                : "Карта сохранена как черновик; public/commercial export остаётся закрыт.");
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : "Не удалось сохранить карту.");
        }
    };

    const removeMap = (mapId: string) => {
        useLocationMapStore.getState().removeMap(mapId);
        useMapStoryPinStore.getState().removePinsForMap(mapId);
        if (activeMapId === mapId) setActiveMapId("");
    };

    if (locationNodes.length === 0) {
        return (
            <div style={{ border: "1px dashed #c9b894", borderRadius: 10, padding: 16, background: "#fffdf7" }}>
                <strong>Сначала нужна локация</strong>
                <p style={{ margin: "5px 0 0", color: "#6b5c4c" }}>Создайте локацию вручную или импортируйте города из карты мира.</p>
            </div>
        );
    }

    const gateColor = decision.state === "allowed" ? "#166534" : decision.state === "blocked" ? "#991b1b" : "#8a5a17";
    const gateBackground = decision.state === "allowed" ? "#dcfce7" : decision.state === "blocked" ? "#fee2e2" : "#fef3c7";

    return (
        <div style={{ display: "grid", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 10, alignItems: "end" }}>
                <label style={labelStyle} htmlFor="map-location">
                    Локация
                    <select id="map-location" value={locationId} onChange={(event) => setLocationId(event.target.value)} style={fieldStyle}>
                        {locationNodes.map((node) => <option key={node.id} value={node.id}>{node.data.emoji} {node.data.name}</option>)}
                    </select>
                </label>
                <Button
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

            <div style={{ border: "1px solid #e2d7bd", borderRadius: 10, padding: 12, background: "#fffdf7" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div>
                        <strong>1. Выберите готовую карту</strong>
                        <p style={{ margin: "3px 0 0", color: "#6b5c4c" }}>PNG, JPEG или WebP до 8 МБ. В библиотеке хранится только уменьшенный preview.</p>
                    </div>
                    <input ref={fileInputRef} type="file" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" hidden onChange={(event) => void readImage(event)} />
                    <Button size="sm" variant="bordered" isLoading={isProcessing} startContent={isProcessing ? undefined : <IoImageOutline />} onClick={() => fileInputRef.current?.click()}>
                        Выбрать изображение
                    </Button>
                </div>
                {previewDataUrl && (
                    <img
                        src={previewDataUrl}
                        alt={`Preview карты ${name || "локации"}`}
                        style={{ width: "100%", maxHeight: 230, objectFit: "contain", marginTop: 12, borderRadius: 8, background: "#17130f" }}
                    />
                )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 9 }}>
                <label style={{ ...labelStyle, gridColumn: "1 / -1" }} htmlFor="map-name">
                    Название карты
                    <input id="map-name" value={name} maxLength={80} onChange={(event) => setName(event.target.value)} placeholder="Например: Затопленные тоннели" style={fieldStyle} />
                </label>
                <label style={labelStyle} htmlFor="map-grid">
                    Сетка
                    <select id="map-grid" value={gridType} onChange={(event) => setGridType(event.target.value as LocationMapGridType)} style={fieldStyle}>
                        <option value="square">Квадратная</option><option value="hex">Гексы</option><option value="none">Без сетки</option>
                    </select>
                </label>
                <label style={labelStyle} htmlFor="map-scale">
                    Масштаб клетки
                    <input id="map-scale" type="number" min={0.1} max={10000} step={0.1} value={scale} onChange={(event) => setScale(Number(event.target.value))} style={fieldStyle} />
                </label>
                <label style={labelStyle} htmlFor="map-unit">
                    Единица
                    <select id="map-unit" value={unit} onChange={(event) => setUnit(event.target.value as LocationMapScaleUnit)} style={fieldStyle}>
                        <option value="ft">футы</option><option value="m">метры</option><option value="km">км</option><option value="mi">мили</option><option value="custom">своя</option>
                    </select>
                </label>
                <label style={labelStyle} htmlFor="map-width">
                    Ширина, клетки
                    <input id="map-width" type="number" min={1} max={500} value={widthCells} onChange={(event) => setWidthCells(Number(event.target.value))} style={fieldStyle} />
                </label>
                <label style={labelStyle} htmlFor="map-height">
                    Высота, клетки
                    <input id="map-height" type="number" min={1} max={500} value={heightCells} onChange={(event) => setHeightCells(Number(event.target.value))} style={fieldStyle} />
                </label>
            </div>

            <details style={{ border: "1px solid #e2d7bd", borderRadius: 10, padding: "9px 11px", background: "#fffdf7" }}>
                <summary style={{ cursor: "pointer", fontWeight: 800 }}>2. Права и provenance · {decision.state}</summary>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginTop: 12 }}>
                    <label style={labelStyle} htmlFor="map-rights-basis">
                        Основание прав
                        <select id="map-rights-basis" value={rightsBasis} onChange={(event) => setRightsBasis(event.target.value as LocationMapRightsBasis)} style={fieldStyle}>
                            {Object.entries(rightsBasisLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </select>
                    </label>
                    <label style={labelStyle} htmlFor="map-creator">
                        Автор / правообладатель
                        <input id="map-creator" value={creator} maxLength={100} onChange={(event) => setCreator(event.target.value)} style={fieldStyle} />
                    </label>
                    {(rightsBasis === "generated" || rightsBasis === "external-tool") && (
                        <label style={labelStyle} htmlFor="map-provider">
                            Сервис / провайдер
                            <input id="map-provider" value={provider} maxLength={100} onChange={(event) => setProvider(event.target.value)} placeholder="Например: Dungeon Scrawl" style={fieldStyle} />
                        </label>
                    )}
                    {rightsBasis !== "original" && (
                        <>
                            <label style={labelStyle} htmlFor="map-source-url">
                                HTTPS-ссылка на источник/условия
                                <input id="map-source-url" type="url" value={sourceUrl} maxLength={2048} onChange={(event) => setSourceUrl(event.target.value)} placeholder="https://…" style={fieldStyle} />
                            </label>
                            <label style={labelStyle} htmlFor="map-license">
                                Лицензия
                                <input id="map-license" value={license} maxLength={160} onChange={(event) => setLicense(event.target.value)} placeholder="CC BY 4.0, договор…" style={fieldStyle} />
                            </label>
                            <label style={{ ...labelStyle, gridColumn: "1 / -1" }} htmlFor="map-attribution">
                                Атрибуция
                                <input id="map-attribution" value={attribution} maxLength={300} onChange={(event) => setAttribution(event.target.value)} style={fieldStyle} />
                            </label>
                        </>
                    )}
                    <label style={labelStyle} htmlFor="map-ip-risk">
                        Сходство с чужой франшизой
                        <select id="map-ip-risk" value={ipRisk} onChange={(event) => setIpRisk(event.target.value as LocationMapIpRisk)} style={fieldStyle}>
                            <option value="none">Нет</option><option value="review">Нужна проверка</option><option value="blocked">Высокий риск</option>
                        </select>
                    </label>
                    <label style={{ ...labelStyle, alignContent: "end" }}>
                        <span><input type="checkbox" checked={commercialIntent} onChange={(event) => { setCommercialIntent(event.target.checked); setCommercialRights(event.target.checked ? "unknown" : "not-requested"); }} /> Планируется коммерческое использование</span>
                    </label>
                    {commercialIntent && (
                        <label style={labelStyle} htmlFor="map-commercial-rights">
                            Коммерческие права
                            <select id="map-commercial-rights" value={commercialRights} onChange={(event) => setCommercialRights(event.target.value as LocationMapCommercialRights)} style={fieldStyle}>
                                <option value="unknown">Не проверены</option><option value="confirmed">Подтверждены документом</option><option value="prohibited">Запрещены</option>
                            </select>
                        </label>
                    )}
                    <label style={{ ...labelStyle, alignContent: "end" }}>
                        <span><input type="checkbox" checked={containsRealPerson} onChange={(event) => setContainsRealPerson(event.target.checked)} /> На изображении есть узнаваемый реальный человек</span>
                    </label>
                    {containsRealPerson && (
                        <label style={{ ...labelStyle, gridColumn: "1 / -1" }} htmlFor="map-consent">
                            Подтверждение согласия
                            <input id="map-consent" value={consentEvidence} maxLength={300} onChange={(event) => setConsentEvidence(event.target.value)} style={fieldStyle} />
                        </label>
                    )}
                </div>
            </details>

            <div role="status" style={{ borderRadius: 9, padding: "9px 11px", background: gateBackground, color: gateColor }}>
                <strong style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {decision.state === "allowed" ? <IoCheckmarkCircle /> : <IoWarningOutline />}
                    {decision.state === "allowed" ? "Разрешено для внутренней работы" : decision.state === "blocked" ? "Заблокировано для публикации" : "Нужна проверка перед публикацией"}
                </strong>
                {decision.reasons.length > 0 && <p style={{ margin: "4px 0 0" }}>{decision.reasons.map((reason) => reasonLabels[reason]).join(" · ")}</p>}
            </div>

            <Button color="primary" startContent={<IoCheckmarkCircle />} onClick={saveMap} isDisabled={!previewDataUrl || !name.trim()}>
                Сохранить карту локации
            </Button>

            {(error || storageError) && <p role="alert" style={{ margin: 0, borderRadius: 8, padding: "9px 10px", background: "#fee2e2", color: "#991b1b" }}>{error || storageError}</p>}
            {feedback && <p aria-live="polite" style={{ margin: 0, borderRadius: 8, padding: "9px 10px", background: "#dcfce7", color: "#166534" }}>{feedback}</p>}

            {maps.length > 0 && (
                <section aria-label="Сохранённые карты локации" style={{ display: "grid", gap: 9 }}>
                    <strong>Карты этой локации</strong>
                    {maps.map((map) => (
                        <article key={map.id} style={{ display: "grid", gridTemplateColumns: "92px minmax(0, 1fr) auto", gap: 10, alignItems: "center", border: activeMap?.id === map.id ? "2px solid #7a1f1f" : "1px solid #e2d7bd", borderRadius: 10, padding: 9, background: "#fffdf7" }}>
                            <img src={map.previewDataUrl} alt="" style={{ width: 92, height: 64, objectFit: "cover", borderRadius: 6, background: "#17130f" }} />
                            <div style={{ minWidth: 0 }}>
                                <strong style={{ display: "block", overflowWrap: "anywhere" }}>{map.name}</strong>
                                <span style={{ color: "#6b5c4c" }}>{map.grid.type} · {map.grid.widthCells}×{map.grid.heightCells} · {map.rightsState}</span>
                            </div>
                            <div style={{ display: "grid", gap: 4 }}>
                                <Button size="sm" variant={activeMap?.id === map.id ? "solid" : "light"} color={activeMap?.id === map.id ? "primary" : "default"} onClick={() => setActiveMapId(map.id)}>
                                    Открыть
                                </Button>
                                <Button isIconOnly size="sm" variant="light" color="danger" aria-label={`Удалить карту ${map.name}`} onClick={() => removeMap(map.id)}>
                                    <IoTrashOutline />
                                </Button>
                            </div>
                        </article>
                    ))}
                    {activeMap && <MapStoryPins key={activeMap.id} map={activeMap} />}
                </section>
            )}

            <p style={{ margin: 0, color: "#786957", fontSize: 11, lineHeight: 1.45 }}>
                Dungeon Scrawl и другие VTT — только внешние инструменты. Приложение не копирует их код, интерфейс, форматы или assets и не подтверждает ваши права автоматически. Product trademark gate остаётся отдельным.
            </p>
        </div>
    );
}
