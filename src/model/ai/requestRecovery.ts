export class AiModuleLoadError extends Error {
    constructor() { super("AI module unavailable"); this.name = "AiModuleLoadError"; }
}

/** Bound the entire DM operation, including module loading and a stalled stream. */
export async function withAiDeadline<T>(
    operation: (signal: AbortSignal) => Promise<T>,
    parent?: AbortSignal,
    timeoutMs = 45_000,
): Promise<T> {
    const controller = new AbortController();
    const cancel = () => controller.abort(parent?.reason ?? new DOMException("Cancelled", "AbortError"));
    if (parent?.aborted) cancel();
    else parent?.addEventListener("abort", cancel, { once: true });
    const timer = setTimeout(() => controller.abort(new DOMException("Deadline exceeded", "TimeoutError")), timeoutMs);
    let onAbort: () => void = () => {};
    const aborted = new Promise<never>((_, reject) => {
        onAbort = () => reject(controller.signal.reason);
        if (controller.signal.aborted) onAbort();
        else controller.signal.addEventListener("abort", onAbort, { once: true });
    });
    try {
        return await Promise.race([aborted, Promise.resolve().then(() => {
            controller.signal.throwIfAborted();
            return operation(controller.signal);
        })]);
    } finally {
        clearTimeout(timer);
        parent?.removeEventListener("abort", cancel);
        controller.signal.removeEventListener("abort", onAbort);
        // Also suppress callbacks from a provider that ignores cancellation.
        controller.abort();
    }
}

/** Never render provider bodies, URLs, keys or SDK error details to the player. */
export function aiRecoveryMessage(error: unknown): string {
    const value = error as { name?: string; message?: string; status?: number } | null;
    if (value?.name === "AiModuleLoadError") return "Не удалось загрузить AI-модуль. Восстановите соединение и сохраните данные перед перезагрузкой.";
    if (value?.name === "TimeoutError") return "AI не ответил за 45 секунд. Запрос сохранён; можно повторить или изменить его.";
    if (value?.name === "AbortError" || value?.name === "APIUserAbortError") return "Ответ остановлен. Запрос сохранён; историю и мир не изменяли.";
    const status = value?.status ?? Number(value?.message?.match(/\bHTTP (\d{3})\b/)?.[1]);
    if (status === 401 || status === 403) return "AI отклонил доступ. Проверьте вход и настройки провайдера, затем повторите запрос.";
    if (status === 429) return "AI временно ограничил запросы. Подождите и повторите вручную.";
    if (status >= 500) return "Сервис AI временно недоступен. Запрос сохранён; повторите позже.";
    if (value?.name === "TypeError" && /fetch|network|load/i.test(value.message ?? "")) return "Не удалось связаться с AI. Проверьте соединение и доступность провайдера, затем повторите.";
    return "Не удалось получить полный корректный ответ AI. Запрос сохранён; проверьте настройки и повторите.";
}
