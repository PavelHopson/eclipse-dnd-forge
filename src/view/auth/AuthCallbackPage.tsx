import { Button, Card, CardBody } from "@nextui-org/react";
import { useEffect, useRef, useState } from "react";
import { completeEclipseSignIn } from "../../model/auth/dndSession";

export default function AuthCallbackPage() {
    const started = useRef(false);
    const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
    const [message, setMessage] = useState("Подтверждаем безопасный вход…");
    const [returnTo, setReturnTo] = useState<"/" | "/auth/canary">("/");

    useEffect(() => {
        if (started.current) return;
        started.current = true;
        void completeEclipseSignIn().then((result) => {
            setReturnTo(result.returnTo);
            setStatus("success");
            setMessage("Вход подтверждён. Пароль, токены и история чатов не передавались в DnD Forge.");
        }).catch((cause) => {
            setStatus("error");
            setMessage(cause instanceof Error ? cause.message : "Не удалось завершить вход");
        });
    }, []);

    return (
        <main className="auth-callback-shell">
            <Card className="auth-callback-card">
                <CardBody>
                    <p className="auth-callback-kicker">ECLIPSE IDENTITY</p>
                    <h1>{status === "loading" ? "Подключаем DnD Forge" : status === "success" ? "Подключение готово" : "Вход не завершён"}</h1>
                    <p role={status === "error" ? "alert" : "status"}>{message}</p>
                    {status !== "loading" && (
                        <Button color="primary" onPress={() => { window.location.hash = returnTo; }}>
                            {status === "success"
                                ? returnTo === "/auth/canary" ? "Показать результат проверки" : "Перейти к кампании"
                                : "Вернуться и попробовать снова"}
                        </Button>
                    )}
                </CardBody>
            </Card>
        </main>
    );
}
