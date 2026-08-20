import { ChangeEvent, useMemo, useRef, useState } from "react";
import { IoAdd, IoCheckmarkCircle, IoClose, IoDownloadOutline, IoPencil, IoTrashOutline } from "react-icons/io5";
import {
    MAX_REFERENCE_ASSETS,
    MAX_REFERENCE_PREVIEW_BYTES,
    REFERENCE_ASSET_KINDS,
    ReferenceAsset,
    ReferenceAssetKind,
    ReferenceAssetStatus,
    ReferenceProvenanceKind,
    provenanceStatus,
    serializeReferenceBoard,
} from "../../model/dnd/referenceBoard";
import { useReferenceBoardStore } from "../../store/useReferenceBoardStore";
import "./ReferenceBoardPanel.css";

interface ReferenceBoardPanelProps {
    onClose: () => void;
}

const KIND_LABELS: Record<ReferenceAssetKind, string> = {
    character: "Персонаж",
    creature: "Существо",
    location: "Локация",
    object: "Предмет",
    pose: "Поза",
    shot: "Кадр",
};

const STATUS_LABELS: Record<ReferenceAssetStatus, string> = {
    draft: "Черновик",
    review: "Нужна проверка",
    approved: "Утверждено",
    blocked: "Заблокировано",
};

const PROVENANCE_LABELS: Record<ReferenceProvenanceKind, string> = {
    original: "Создано нами",
    commissioned: "Заказано автору",
    licensed: "Используется по лицензии",
    "public-domain": "Public domain",
    generated: "Сгенерировано",
};

function lines(value: string, maxItems: number): string[] {
    return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean).slice(0, maxItems);
}

function makeAssetId(): string {
    return `reference-${crypto.randomUUID()}`;
}

function isAllowedPreview(bytes: Uint8Array): boolean {
    const png = bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
    const jpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    const webp = bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
        String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
    return png || jpeg || webp;
}

function readAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Preview не прочитан."));
        reader.onerror = () => reject(new Error("Preview не прочитан."));
        reader.readAsDataURL(file);
    });
}

type Draft = {
    id: string;
    kind: ReferenceAssetKind;
    name: string;
    summary: string;
    stableTraits: string;
    previewDataUrl: string | null;
    provenanceKind: ReferenceProvenanceKind;
    creator: string;
    sourceUrl: string;
    license: string;
    containsRealPerson: boolean;
    consentEvidence: string;
    status: Exclude<ReferenceAssetStatus, "blocked">;
    createdAt: number;
};

function emptyDraft(): Draft {
    return {
        id: makeAssetId(),
        kind: "character",
        name: "",
        summary: "",
        stableTraits: "",
        previewDataUrl: null,
        provenanceKind: "original",
        creator: "Eclipse Forge",
        sourceUrl: "",
        license: "",
        containsRealPerson: false,
        consentEvidence: "",
        status: "draft",
        createdAt: Date.now(),
    };
}

function assetDraft(asset: ReferenceAsset): Draft {
    return {
        id: asset.id,
        kind: asset.kind,
        name: asset.name,
        summary: asset.summary,
        stableTraits: asset.stableTraits.join("\n"),
        previewDataUrl: asset.previewDataUrl,
        provenanceKind: asset.provenance.kind,
        creator: asset.provenance.creator,
        sourceUrl: asset.provenance.sourceUrl ?? "",
        license: asset.provenance.license,
        containsRealPerson: asset.provenance.containsRealPerson,
        consentEvidence: asset.provenance.consentEvidence,
        status: asset.status === "blocked" ? "review" : asset.status,
        createdAt: asset.createdAt,
    };
}

export default function ReferenceBoardPanel({ onClose }: ReferenceBoardPanelProps) {
    const board = useReferenceBoardStore((state) => state.board);
    const storageError = useReferenceBoardStore((state) => state.storageError);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [mode, setMode] = useState<"board" | "wizard">("board");
    const [step, setStep] = useState(1);
    const [draft, setDraft] = useState<Draft>(() => emptyDraft());
    const [isReadingPreview, setIsReadingPreview] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [feedback, setFeedback] = useState<string | null>(null);
    const [isEditingBible, setIsEditingBible] = useState(false);
    const [bibleDraft, setBibleDraft] = useState(() => ({
        title: board.bible.title,
        visualDirection: board.bible.visualDirection,
        palette: board.bible.palette.join("\n"),
        cameraLanguage: board.bible.cameraLanguage,
        continuityRules: board.bible.continuityRules.join("\n"),
        avoid: board.bible.avoid.join("\n"),
    }));

    const provenance = useMemo(() => ({
        kind: draft.provenanceKind,
        creator: draft.creator.trim(),
        sourceUrl: draft.sourceUrl.trim() || null,
        license: draft.license.trim(),
        containsRealPerson: draft.containsRealPerson,
        consentEvidence: draft.consentEvidence.trim(),
    }), [draft]);
    const rightsStatus = provenanceStatus(provenance);
    const approvedCount = board.assets.filter((asset) => asset.status === "approved").length;
    const needsAttentionCount = board.assets.filter((asset) => asset.status === "review" || asset.status === "blocked").length;

    const beginAsset = (asset?: ReferenceAsset) => {
        setDraft(asset ? assetDraft(asset) : emptyDraft());
        setStep(1);
        setError(null);
        setFeedback(null);
        setMode("wizard");
    };

    const readPreview = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;
        setError(null);
        if (file.size > MAX_REFERENCE_PREVIEW_BYTES) {
            setError("Preview больше 256 КБ. Сохраните компактный PNG, JPEG или WebP thumbnail.");
            return;
        }
        setIsReadingPreview(true);
        try {
            const bytes = new Uint8Array(await file.arrayBuffer());
            if (!isAllowedPreview(bytes)) throw new Error("Разрешены только проверенные PNG, JPEG и WebP без SVG или исполняемого содержимого.");
            const previewDataUrl = await readAsDataUrl(file);
            setDraft((current) => ({ ...current, previewDataUrl }));
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : "Не удалось проверить preview.");
        } finally {
            setIsReadingPreview(false);
        }
    };

    const saveAsset = () => {
        setError(null);
        if (!draft.name.trim()) {
            setError("Назовите asset, чтобы его можно было найти на доске.");
            setStep(1);
            return;
        }
        if (draft.sourceUrl && !/^https:\/\//i.test(draft.sourceUrl.trim())) {
            setError("Источник должен быть HTTPS-ссылкой. Локальные пути и небезопасные URL не принимаются.");
            setStep(4);
            return;
        }
        const status: ReferenceAssetStatus = rightsStatus === "blocked" ? "blocked" : draft.status;
        const now = Date.now();
        const asset: ReferenceAsset = {
            id: draft.id,
            kind: draft.kind,
            name: draft.name.trim(),
            summary: draft.summary.trim(),
            stableTraits: lines(draft.stableTraits, 8),
            previewDataUrl: draft.previewDataUrl,
            provenance,
            status,
            createdAt: draft.createdAt,
            updatedAt: now,
        };
        if (useReferenceBoardStore.getState().saveAsset(asset)) {
            setMode("board");
            setFeedback(status === "blocked"
                ? "Asset сохранён заблокированным: добавьте подтверждение согласия реального человека."
                : `Asset «${asset.name}» сохранён.`);
        }
    };

    const saveBible = () => {
        useReferenceBoardStore.getState().saveBible({
            title: bibleDraft.title.trim(),
            visualDirection: bibleDraft.visualDirection.trim(),
            palette: lines(bibleDraft.palette, 8),
            cameraLanguage: bibleDraft.cameraLanguage.trim(),
            continuityRules: lines(bibleDraft.continuityRules, 12),
            avoid: lines(bibleDraft.avoid, 12),
        });
        setIsEditingBible(false);
        setFeedback("Project bible сохранена и применяется ко всей reference board.");
    };

    const downloadBoard = () => {
        const blob = new Blob([serializeReferenceBoard(board)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = "campaign-reference-board.json";
        anchor.click();
        URL.revokeObjectURL(url);
        setFeedback("Reference Board экспортирована вместе с provenance и status.");
    };

    return (
        <section className="dnd-overlay-panel reference-board-panel" aria-label="Reference Board кампании">
            <header className="reference-board-header">
                <div>
                    <span className="reference-board-kicker">Campaign assets</span>
                    <h2>Reference Board</h2>
                    <p>Единые визуальные константы мира без случайного дрейфа.</p>
                </div>
                <button type="button" className="reference-icon-button" onClick={onClose} aria-label="Закрыть Reference Board"><IoClose /></button>
            </header>

            {(error || storageError) && <div className="reference-message is-error" role="alert">{error || storageError}</div>}
            {feedback && <div className="reference-message is-success" role="status"><IoCheckmarkCircle /> {feedback}</div>}

            {mode === "board" ? (
                <div className="reference-board-content">
                    <div className="reference-board-summary" aria-label="Статус Reference Board">
                        <span><strong>{board.assets.length}</strong> / {MAX_REFERENCE_ASSETS} assets</span>
                        <span><strong>{approvedCount}</strong> утверждено</span>
                        <span><strong>{needsAttentionCount}</strong> требуют внимания</span>
                    </div>

                    <section className="reference-bible-card">
                        <div className="reference-section-heading">
                            <div><span>Project bible</span><h3>{board.bible.title || "Визуальные правила ещё не заданы"}</h3></div>
                            <button type="button" className="reference-secondary-button" onClick={() => setIsEditingBible((value) => !value)}><IoPencil /> {isEditingBible ? "Свернуть" : "Редактировать"}</button>
                        </div>
                        {isEditingBible ? (
                            <div className="reference-form-grid">
                                <label>Название проекта<input value={bibleDraft.title} maxLength={80} onChange={(e) => setBibleDraft({ ...bibleDraft, title: e.target.value })} /></label>
                                <label className="is-wide">Visual north star<textarea value={bibleDraft.visualDirection} maxLength={500} onChange={(e) => setBibleDraft({ ...bibleDraft, visualDirection: e.target.value })} placeholder="Как мир должен ощущаться в одном предложении" /></label>
                                <label>Palette, по одному значению<textarea value={bibleDraft.palette} onChange={(e) => setBibleDraft({ ...bibleDraft, palette: e.target.value })} placeholder="#182238&#10;тёплое золото" /></label>
                                <label>Camera language<textarea value={bibleDraft.cameraLanguage} maxLength={300} onChange={(e) => setBibleDraft({ ...bibleDraft, cameraLanguage: e.target.value })} placeholder="Высота камеры, фокус, дистанция" /></label>
                                <label>Continuity rules<textarea value={bibleDraft.continuityRules} onChange={(e) => setBibleDraft({ ...bibleDraft, continuityRules: e.target.value })} placeholder="Одна неизменная деталь на строку" /></label>
                                <label>Avoid list<textarea value={bibleDraft.avoid} onChange={(e) => setBibleDraft({ ...bibleDraft, avoid: e.target.value })} placeholder="Чего никогда не должно быть" /></label>
                                <button type="button" className="reference-primary-button is-wide" onClick={saveBible}>Сохранить project bible</button>
                            </div>
                        ) : board.bible.visualDirection || board.bible.continuityRules.length ? (
                            <div className="reference-bible-preview">
                                {board.bible.visualDirection && <p>{board.bible.visualDirection}</p>}
                                {board.bible.palette.length > 0 && <div className="reference-tags">{board.bible.palette.map((item) => <span key={item}>{item}</span>)}</div>}
                                {board.bible.continuityRules.length > 0 && <ul>{board.bible.continuityRules.map((item) => <li key={item}>{item}</li>)}</ul>}
                            </div>
                        ) : <p className="reference-muted">Сначала задайте visual north star и 2–3 continuity rules — этого достаточно для первого asset.</p>}
                    </section>

                    <div className="reference-board-actions">
                        <button type="button" className="reference-primary-button" onClick={() => beginAsset()} disabled={board.assets.length >= MAX_REFERENCE_ASSETS}><IoAdd /> Добавить reference asset</button>
                        <button type="button" className="reference-secondary-button" onClick={downloadBoard} disabled={board.assets.length === 0}><IoDownloadOutline /> Скачать JSON</button>
                    </div>

                    {board.assets.length === 0 ? (
                        <div className="reference-empty-state">
                            <strong>Доска пока пустая</strong>
                            <p>Добавьте персонажа, существо, локацию, предмет, позу или кадр. Wizard сразу попросит stable traits и provenance.</p>
                            <button type="button" className="reference-primary-button" onClick={() => beginAsset()}><IoAdd /> Добавить первый референс</button>
                        </div>
                    ) : (
                        <div className="reference-asset-grid">
                            {board.assets.map((asset) => {
                                const rights = provenanceStatus(asset.provenance);
                                return <article className="reference-asset-card" key={asset.id}>
                                    <div className={`reference-preview is-${asset.kind}`}>
                                        {asset.previewDataUrl
                                            ? <img src={asset.previewDataUrl} alt={`Preview: ${asset.name}`} />
                                            : <span>{KIND_LABELS[asset.kind]}</span>}
                                    </div>
                                    <div className="reference-asset-body">
                                        <div className="reference-card-meta"><span>{KIND_LABELS[asset.kind]}</span><span className={`reference-status is-${asset.status}`}>{STATUS_LABELS[asset.status]}</span></div>
                                        <h3>{asset.name}</h3>
                                        {asset.summary && <p>{asset.summary}</p>}
                                        <div className="reference-tags">{asset.stableTraits.map((trait) => <span key={trait}>{trait}</span>)}</div>
                                        <div className={`reference-provenance is-${rights}`}>Provenance: {rights === "complete" ? "подтверждён" : rights === "blocked" ? "заблокирован" : "нужна проверка"}</div>
                                        <div className="reference-card-actions">
                                            <button type="button" onClick={() => beginAsset(asset)}><IoPencil /> Изменить</button>
                                            <button type="button" onClick={() => {
                                                if (window.confirm(`Удалить reference asset «${asset.name}»?`)) useReferenceBoardStore.getState().removeAsset(asset.id);
                                            }}><IoTrashOutline /> Удалить</button>
                                        </div>
                                    </div>
                                </article>;
                            })}
                        </div>
                    )}
                </div>
            ) : (
                <div className="reference-wizard">
                    <nav className="reference-steps" aria-label="Шаги создания reference asset">
                        {["Тип", "Константы", "Preview", "Права"].map((label, index) => <span key={label} className={step === index + 1 ? "is-active" : step > index + 1 ? "is-complete" : ""} aria-current={step === index + 1 ? "step" : undefined}>{index + 1}. {label}</span>)}
                    </nav>

                    {step === 1 && <div className="reference-step">
                        <h3>Что фиксируем?</h3>
                        <p>Выберите один тип — остальные поля подстроятся под его задачу.</p>
                        <div className="reference-kind-grid">{REFERENCE_ASSET_KINDS.map((kind) => <button type="button" key={kind} className={draft.kind === kind ? "is-selected" : ""} onClick={() => setDraft({ ...draft, kind })}>{KIND_LABELS[kind]}</button>)}</div>
                        <label>Название<input autoFocus value={draft.name} maxLength={80} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Например: Хранитель северных ворот" /></label>
                        <label>Роль в проекте<textarea value={draft.summary} maxLength={500} onChange={(e) => setDraft({ ...draft, summary: e.target.value })} placeholder="Что этот reference должен удерживать неизменным" /></label>
                    </div>}

                    {step === 2 && <div className="reference-step">
                        <h3>Stable traits</h3>
                        <p>Только детали, которые обязаны пережить смену сцены, позы и художника.</p>
                        <label>Одна константа на строку<textarea autoFocus value={draft.stableTraits} onChange={(e) => setDraft({ ...draft, stableTraits: e.target.value })} placeholder="сломанный левый рог&#10;тёмно-зелёный плащ&#10;серебряная пряжка в форме луны" /></label>
                        <span className="reference-field-hint">До 8 traits. Настроение и случайный свет сюда не входят.</span>
                    </div>}

                    {step === 3 && <div className="reference-step">
                        <h3>Preview</h3>
                        <p>Компактный локальный thumbnail. Он не загружается во внешние сервисы.</p>
                        <div className={`reference-preview reference-wizard-preview is-${draft.kind}`}>
                            {draft.previewDataUrl ? <img src={draft.previewDataUrl} alt={`Preview: ${draft.name || KIND_LABELS[draft.kind]}`} /> : <span>{KIND_LABELS[draft.kind]}</span>}
                        </div>
                        <input ref={fileInputRef} type="file" hidden accept="image/png,image/jpeg,image/webp" onChange={readPreview} />
                        <div className="reference-board-actions">
                            <button type="button" className="reference-secondary-button" disabled={isReadingPreview} onClick={() => fileInputRef.current?.click()}>{isReadingPreview ? "Проверяем preview…" : "Выбрать PNG, JPEG или WebP"}</button>
                            {draft.previewDataUrl && <button type="button" className="reference-secondary-button" onClick={() => setDraft({ ...draft, previewDataUrl: null })}>Убрать preview</button>}
                        </div>
                        <span className="reference-field-hint">Максимум 256 КБ. SVG и внешние image URL намеренно запрещены.</span>
                    </div>}

                    {step === 4 && <div className="reference-step">
                        <h3>Provenance и статус</h3>
                        <p>Asset не становится approved без понятного происхождения и прав.</p>
                        <div className="reference-form-grid">
                            <label>Происхождение<select value={draft.provenanceKind} onChange={(e) => setDraft({ ...draft, provenanceKind: e.target.value as ReferenceProvenanceKind })}>{Object.entries(PROVENANCE_LABELS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
                            <label>Автор / инструмент<input value={draft.creator} maxLength={100} onChange={(e) => setDraft({ ...draft, creator: e.target.value })} /></label>
                            <label>HTTPS-источник<input type="url" value={draft.sourceUrl} maxLength={500} onChange={(e) => setDraft({ ...draft, sourceUrl: e.target.value })} placeholder="https://…" /></label>
                            <label>Лицензия / договор<input value={draft.license} maxLength={120} onChange={(e) => setDraft({ ...draft, license: e.target.value })} placeholder="Собственная работа, CC0, договор…" /></label>
                            <label className="reference-check is-wide"><input type="checkbox" checked={draft.containsRealPerson} onChange={(e) => setDraft({ ...draft, containsRealPerson: e.target.checked, consentEvidence: e.target.checked ? draft.consentEvidence : "" })} /> Preview содержит узнаваемого реального человека</label>
                            {draft.containsRealPerson && <label className="is-wide">Подтверждение согласия и прав<textarea value={draft.consentEvidence} maxLength={300} onChange={(e) => setDraft({ ...draft, consentEvidence: e.target.value })} placeholder="Кто дал согласие, на какое использование и где хранится подтверждение" /></label>}
                            <label>Статус<select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as Draft["status"] })}><option value="draft">Черновик</option><option value="review">Нужна проверка</option><option value="approved" disabled={rightsStatus !== "complete"}>Утверждено</option></select></label>
                            <div className={`reference-rights-check is-${rightsStatus}`}><strong>{rightsStatus === "complete" ? "Можно утверждать" : rightsStatus === "blocked" ? "Использование заблокировано" : "Нужна проверка provenance"}</strong><span>{rightsStatus === "blocked" ? "Реальное лицо требует явного подтверждения согласия." : rightsStatus === "review" ? "Заполните автора, источник и лицензию там, где они обязательны." : "Происхождение заполнено; финальное решение остаётся за человеком."}</span></div>
                        </div>
                    </div>}

                    <footer className="reference-wizard-actions">
                        <button type="button" className="reference-secondary-button" onClick={() => step === 1 ? setMode("board") : setStep(step - 1)}>{step === 1 ? "Отмена" : "Назад"}</button>
                        {step < 4
                            ? <button type="button" className="reference-primary-button" onClick={() => setStep(step + 1)} disabled={step === 1 && !draft.name.trim()}>Продолжить</button>
                            : <button type="button" className="reference-primary-button" onClick={saveAsset}>Сохранить asset</button>}
                    </footer>
                </div>
            )}
        </section>
    );
}
