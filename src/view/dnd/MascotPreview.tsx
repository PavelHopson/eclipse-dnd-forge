import { useState } from "react";
import "./MascotPreview.css";

type KverkState = "idle" | "greet" | "curious" | "delight" | "rest";

const ASSET_ROOT = `${import.meta.env.BASE_URL}mascots/kverk-v0.1.0/`;
const STATES: Array<{ id: KverkState; label: string; meaning: string }> = [
    { id: "idle", label: "Нейтральный", meaning: "Декоративный baseline" },
    { id: "greet", label: "Приветствие", meaning: "После явного появления" },
    { id: "curious", label: "Внимание", meaning: "Фокус или выбор" },
    { id: "delight", label: "Реакция", meaning: "После нажатия" },
    { id: "rest", label: "Покой", meaning: "Пауза или тишина" },
];

/** Local-only asset review. The mascot remains illustrative; text is the source of meaning. */
export default function MascotPreview() {
    const [selected, setSelected] = useState<KverkState>("idle");
    const [failed, setFailed] = useState<Record<string, boolean>>({});
    const current = STATES.find((item) => item.id === selected) ?? STATES[0];
    const imageFailed = failed[selected];

    const markFailed = (state: KverkState) => {
        setFailed((previous) => ({ ...previous, [state]: true }));
    };

    return (
        <main className="mascot-preview" aria-labelledby="mascot-preview-title">
            <header className="mascot-preview__header">
                <div>
                    <p className="mascot-preview__eyebrow">ECLIPSE DND FORGE / IDEA-028-DND</p>
                    <h1 id="mascot-preview-title">Кверк, тихий спутник</h1>
                    <p className="mascot-preview__lede">
                        Локальная примерка оригинального фамильяра. Он не сообщает состояние игры,
                        не запускает действия и не заменяет текстовые статусы.
                    </p>
                </div>
                <nav className="mascot-preview__nav" aria-label="Навигация по Forge">
                    <a href="#/">К кампаниям</a>
                    <a href="#/party">Общий стол</a>
                </nav>
            </header>

            <section className="mascot-preview__workspace" aria-labelledby="mascot-preview-state-title">
                <div className="mascot-preview__stage">
                    <div className="mascot-preview__stage-meta">
                        <span>SELECTED STATE</span>
                        <strong>{current.id}</strong>
                    </div>
                    <div className="mascot-preview__portrait" data-state={selected}>
                        {imageFailed ? (
                            <div className="mascot-preview__fallback" role="img" aria-label="Изображение Кверка недоступно">
                                Кверк остаётся доступен как текстовый статус.
                            </div>
                        ) : (
                            <img
                                src={`${ASSET_ROOT}${selected}.svg`}
                                width="256"
                                height="256"
                                alt=""
                                aria-hidden="true"
                                draggable={false}
                                onError={() => markFailed(selected)}
                            />
                        )}
                    </div>
                    <div className="mascot-preview__stage-copy">
                        <h2 id="mascot-preview-state-title">{current.label}</h2>
                        <p>{current.meaning}</p>
                    </div>
                </div>

                <div className="mascot-preview__controls">
                    <p className="mascot-preview__label">Проверка состояний</p>
                    <ul className="mascot-preview__state-list" aria-label="Состояния Кверка">
                        {STATES.map((item) => (
                            <li key={item.id}>
                                <button
                                    type="button"
                                    aria-pressed={selected === item.id}
                                    onClick={() => setSelected(item.id)}
                                >
                                    <span>{item.id}</span>
                                    <small>{item.label}</small>
                                </button>
                            </li>
                        ))}
                    </ul>
                    <dl className="mascot-preview__facts">
                        <div><dt>Источник</dt><dd>оригинальные SVG-эскизы A-40</dd></div>
                        <div><dt>Права</dt><dd>LicenseRef-Eclipse-Internal-Review</dd></div>
                        <div><dt>Версия</dt><dd>kverk-v0.1.0 · 256 × 256</dd></div>
                        <div><dt>Ограничение</dt><dd>только local preview, без публичной лицензии</dd></div>
                    </dl>
                </div>
            </section>

            <footer className="mascot-preview__footer">
                <span>Состояния — иллюстрация. Текст и подтверждённые события остаются источником истины.</span>
                <a href="#/">Вернуться к запуску</a>
            </footer>
        </main>
    );
}
