import { Button, Card, CardBody } from "@nextui-org/react";
import { useEffect, useState } from "react";
import {
    beginEclipseSignIn,
    DndApiError,
    getDndSession,
    IDENTITY_CANARY_ENABLED,
    signOutDnd,
    type DndSession,
} from "../../model/auth/dndSession";

type CanaryState = "loading" | "ready" | "success" | "error" | "disabled";

function readableError(cause: unknown, fallback: string): string {
    return cause instanceof DndApiError ? cause.message : fallback;
}

export default function IdentityCanaryPage() {
    const [state, setState] = useState<CanaryState>(IDENTITY_CANARY_ENABLED ? "loading" : "disabled");
    const [session, setSession] = useState<DndSession | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    useEffect(() => {
        if (!IDENTITY_CANARY_ENABLED) return;
        let cancelled = false;
        void getDndSession(true).then((current) => {
            if (cancelled) return;
            setSession(current);
            setState(current ? "success" : "ready");
        }).catch((cause) => {
            if (cancelled) return;
            setMessage(readableError(
                cause,
                "Сервис входа временно недоступен. Проверьте соединение и повторите попытку.",
            ));
            setState("error");
        });
        return () => { cancelled = true; };
    }, []);

    async function startCanary() {
        setMessage(null);
        setState("loading");
        try {
            await beginEclipseSignIn("canary");
        } catch (cause) {
            setMessage(readableError(cause, "Не удалось открыть Eclipse Chat. Повторите попытку через минуту."));
            setState("error");
        }
    }

    async function clearSession() {
        setMessage(null);
        setState("loading");
        try {
            await signOutDnd();
            setSession(null);
            setState("ready");
        } catch (cause) {
            setMessage(readableError(cause, "Не удалось завершить DnD-сессию. Повторите попытку."));
            setState("error");
        }
    }

    return (
        <main className="identity-canary-shell">
            <Card className="identity-canary-card">
                <CardBody>
                    <p className="auth-callback-kicker">ECLIPSE IDENTITY · CANARY</p>
                    {state === "loading" ? (
                        <div className="identity-canary-loading" role="status" aria-label="Проверяем безопасный вход">
                            <span />
                            <span />
                            <span />
                        </div>
                    ) : state === "disabled" ? (
                        <>
                            <h1>Проверка сейчас выключена</h1>
                            <p>Основной DnD Forge продолжает работать. Этот служебный экран не включает AI.</p>
                            <Button color="primary" onPress={() => { window.location.hash = "/"; }}>
                                Вернуться в DnD Forge
                            </Button>
                        </>
                    ) : state === "success" && session ? (
                        <>
                            <div className="identity-canary-status" aria-hidden="true"><span /></div>
                            <h1>Безопасный вход работает</h1>
                            <p>
                                Eclipse Chat подтвердил аккаунт <strong>{session.user.displayName}</strong>.
                                DnD Forge получил только имя и внутренний ID.
                            </p>
                            <ul className="identity-canary-checks" aria-label="Результаты проверки">
                                <li><span aria-hidden="true" />PKCE-код принят один раз</li>
                                <li><span aria-hidden="true" />Защищённая DnD-сессия создана</li>
                                <li><span aria-hidden="true" />Managed AI остался выключен</li>
                            </ul>
                            <div className="identity-canary-actions">
                                <Button color="primary" onPress={() => void startCanary()}>
                                    Повторить проверку входа
                                </Button>
                                <Button variant="bordered" onPress={() => void clearSession()}>
                                    Завершить DnD-сессию
                                </Button>
                            </div>
                        </>
                    ) : (
                        <>
                            <h1>{state === "error" ? "Проверка не завершена" : "Проверить вход через Eclipse Chat"}</h1>
                            <p>
                                Chat подтвердит аккаунт и вернёт вас на этот экран. Пароль, токены и история чатов
                                не передаются в DnD Forge, а AI не включается.
                            </p>
                            {message && <p className="identity-error" role="alert">{message}</p>}
                            <div className="identity-canary-actions">
                                <Button color="primary" onPress={() => void startCanary()}>
                                    Начать безопасную проверку
                                </Button>
                                <Button variant="bordered" onPress={() => { window.location.hash = "/"; }}>
                                    Вернуться в DnD Forge
                                </Button>
                            </div>
                        </>
                    )}
                </CardBody>
            </Card>
        </main>
    );
}
