import { useState } from "react";
import "./MascotDirectionBoard.css";

type DirectionId = "a" | "b";

const ASSET_ROOT = `${import.meta.env.BASE_URL}mascots/kverk-v0.1.0/`;
const DIRECTIONS: Array<{
    id: DirectionId;
    name: string;
    short: string;
    description: string;
    silhouette: string;
    asset: string;
}> = [
    {
        id: "a",
        name: "Гранёный ворон",
        short: "Кверк / A",
        description: "Сдержанный спутник исследования с клиновидным клювом и пером-компасом.",
        silhouette: "Собранный, геометричный, с направлением взгляда вперёд.",
        asset: "idle.svg",
    },
    {
        id: "b",
        name: "Оригинальный фамильяр",
        short: "Вариант B",
        description: "Более мягкий силуэт птицы-фамильяра для тёплого входа в живой мир.",
        silhouette: "Низкий широкий силуэт; характер ещё нужно проверить в игровом масштабе.",
        asset: "alternative.svg",
    },
];

/**
 * Direction review is deliberately a candidate picker, not an approval control.
 * The explicit status keeps an exploratory asset from being mistaken for production art.
 */
export default function MascotDirectionBoard() {
    const [selected, setSelected] = useState<DirectionId>("a");
    const [failed, setFailed] = useState<Partial<Record<DirectionId, boolean>>>({});
    const current = DIRECTIONS.find((direction) => direction.id === selected) ?? DIRECTIONS[0];

    return (
        <main className="mascot-direction-board" aria-labelledby="mascot-direction-title">
            <header className="mascot-direction-board__header">
                <div>
                    <p className="mascot-direction-board__eyebrow">ECLIPSE DND FORGE / IDEA-028-DND</p>
                    <h1 id="mascot-direction-title">Сначала выбираем направление</h1>
                    <p className="mascot-direction-board__lede">
                        Две оригинальные идеи фамильяра для DnD Forge. Это локальные vector sketches:
                        не финальный арт, не игровой сигнал и не approval.
                    </p>
                </div>
                <nav className="mascot-direction-board__nav" aria-label="Навигация по Forge">
                    <a href="#/">К кампаниям</a>
                    <a href="#/mascots-preview">Состояния A</a>
                </nav>
            </header>

            <section className="mascot-direction-board__workspace" aria-labelledby="mascot-direction-choice-title">
                <div className="mascot-direction-board__stage">
                    <div className="mascot-direction-board__stage-meta">
                        <span>КАНДИДАТ</span>
                        <strong>{current.short}</strong>
                    </div>
                    <figure className="mascot-direction-board__portrait">
                        {failed[selected] ? (
                            <figcaption className="mascot-direction-board__fallback">
                                Эскиз недоступен. Выбор остаётся доступен как текстовый статус: {current.name}.
                            </figcaption>
                        ) : (
                            <img
                                src={`${ASSET_ROOT}${current.asset}`}
                                width="256"
                                height="256"
                                alt={`${current.name}, локальный оригинальный эскиз`}
                                draggable={false}
                                onError={() => setFailed((previous) => ({ ...previous, [selected]: true }))}
                            />
                        )}
                    </figure>
                    <div className="mascot-direction-board__caption" aria-live="polite">
                        <h2>{current.name}</h2>
                        <p>{current.description}</p>
                        <p className="mascot-direction-board__silhouette">{current.silhouette}</p>
                    </div>
                </div>

                <fieldset className="mascot-direction-board__choices">
                    <legend id="mascot-direction-choice-title">Две визуальные идеи</legend>
                    <p className="mascot-direction-board__choice-note">
                        Выбор меняет только локальный preview. Ничего не сохраняется в кампанию.
                    </p>
                    <ul>
                        {DIRECTIONS.map((direction) => (
                            <li key={direction.id}>
                                <button
                                    type="button"
                                    aria-pressed={selected === direction.id}
                                    onClick={() => setSelected(direction.id)}
                                >
                                    <span>{direction.short}</span>
                                    <small>{direction.name}</small>
                                </button>
                            </li>
                        ))}
                    </ul>

                    <dl className="mascot-direction-board__facts">
                        <div><dt>Статус</dt><dd>working-vector-sketch · не утверждено</dd></div>
                        <div><dt>Происхождение</dt><dd>оригинальные SVG-эскизы A-40</dd></div>
                        <div><dt>Права</dt><dd>LicenseRef-Eclipse-Internal-Review</dd></div>
                        <div><dt>Границы</dt><dd>без Koboyo, D&amp;D IP, приватных фото и публичной лицензии</dd></div>
                    </dl>
                </fieldset>
            </section>

            <footer className="mascot-direction-board__footer">
                <span>Следующий слой — Taz/Taskagotchi: отдельный familiar, который получает состояния из подтверждённых Campaign events.</span>
                <a href="#/">Вернуться к запуску</a>
            </footer>
        </main>
    );
}
