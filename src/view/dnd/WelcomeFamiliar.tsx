import { useEffect, useId, useRef, useState } from "react";
import "./WelcomeFamiliar.css";

const HIDDEN_KEY = "eclivarium_welcome_familiar_hidden_v1";
const ASSET_ROOT = `${import.meta.env.BASE_URL}mascots/kverk-v0.1.0/`;
function wasHidden() {
    try { return localStorage.getItem(HIDDEN_KEY) === "true"; } catch { return false; }
}

/** Welcome-only companion. Decorative reactions never represent AI/game state. */
export default function WelcomeFamiliar() {
    const [hidden, setHidden] = useState(wasHidden);
    const [paused, setPaused] = useState(false);
    const [reduced, setReduced] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const [pageVisible, setPageVisible] = useState(() => !document.hidden);
    const [greeting, setGreeting] = useState(false);
    const [focused, setFocused] = useState(false);
    const [imageFailure, setImageFailure] = useState<"none" | "fallback" | "hidden">("none");
    const [welcoming, setWelcoming] = useState(true);
    const greetRef = useRef<HTMLButtonElement>(null);
    const showRef = useRef<HTMLButtonElement>(null);
    const focusAfterToggle = useRef(false);
    const descriptionId = useId();
    const still = paused || reduced || !pageVisible;
    const pose = still ? "rest" : greeting ? "delight" : focused ? "curious" : welcoming ? "greet" : "idle";
    const imageSrc = `${ASSET_ROOT}${imageFailure === "fallback" ? "idle" : pose}.svg`;
    const imageAvailable = imageFailure !== "hidden";

    useEffect(() => {
        const media = window.matchMedia("(prefers-reduced-motion: reduce)");
        const onMotion = () => setReduced(media.matches);
        const onVisibility = () => {
            setPageVisible(!document.hidden);
            if (document.hidden) { setGreeting(false); setWelcoming(false); }
        };
        media.addEventListener("change", onMotion);
        document.addEventListener("visibilitychange", onVisibility);
        return () => {
            media.removeEventListener("change", onMotion);
            document.removeEventListener("visibilitychange", onVisibility);
        };
    }, []);

    useEffect(() => {
        if (!welcoming && !greeting) return;
        const timer = window.setTimeout(() => { setWelcoming(false); setGreeting(false); }, 900);
        return () => window.clearTimeout(timer);
    }, [welcoming, greeting]);

    useEffect(() => {
        if (!focusAfterToggle.current) return;
        focusAfterToggle.current = false;
        (hidden ? showRef : greetRef).current?.focus();
    }, [hidden]);

    const toggleHidden = (next: boolean) => {
        focusAfterToggle.current = true;
        setGreeting(false);
        setWelcoming(false);
        setHidden(next);
        // Optional UI preference only; failure never blocks the launcher.
        try { localStorage.setItem(HIDDEN_KEY, String(next)); } catch { /* In-memory hide remains available. */ }
    };

    if (hidden) return <div className="welcome-familiar welcome-familiar--hidden">
        <button ref={showRef} type="button" className="welcome-familiar__control" onClick={() => toggleHidden(false)}>Показать фамильяра</button>
    </div>;

    return <section className="welcome-familiar" aria-label="Фамильяр приветственного экрана"
        data-motion={still ? "still" : "enabled"} data-state={greeting ? "greeting" : focused ? "attention" : welcoming ? "welcome" : "rest"}>
        <button ref={greetRef} type="button" className="welcome-familiar__portrait" aria-label="Поздороваться с фамильяром"
            aria-describedby={descriptionId} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
            onClick={() => { setGreeting(true); setWelcoming(false); }}>
            <span className="welcome-familiar__figure" aria-hidden="true">
                {imageAvailable
                    ? <img src={imageSrc} width="96" height="96" alt="" draggable={false}
                        onError={() => setImageFailure(imageFailure === "fallback" || pose === "idle" ? "hidden" : "fallback")} />
                    : <span className="welcome-familiar__fallback">Поздороваться</span>}
            </span>
        </button>
        <div className="welcome-familiar__copy">
            <div className="welcome-familiar__heading"><strong>Кверк · тихий спутник</strong><span>Эскиз · локальная примерка</span></div>
            <p id={descriptionId}>Выберите кампанию. Я останусь здесь и не буду мешать игре.</p>
            <p className="welcome-familiar__reply" aria-live="polite" aria-atomic="true">{greeting ? "Рад встрече. Пусть история начнётся." : imageAvailable ? "Фамильяр отдыхает у порога." : "Изображение недоступно. Приветствие работает без него."}</p>
            <div className="welcome-familiar__controls">
                <button type="button" className="welcome-familiar__control" aria-pressed={paused || reduced} disabled={reduced}
                    onClick={() => setPaused(!paused)}>{reduced ? "Без анимации · система" : paused ? "Оживить" : "Покой"}</button>
                <button type="button" className="welcome-familiar__control" onClick={() => toggleHidden(true)}>Скрыть фамильяра</button>
            <a className="welcome-familiar__link" href="#/mascots-directions">Смотреть направления</a>
            </div>
        </div>
    </section>;
}
