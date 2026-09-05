export interface CampaignSession {
    id: string;
    name: string;
    startedAt: number;
    endedAt?: number;
    text: string;
    recap?: string;
}
export interface SessionArchive { sessions: CampaignSession[]; nextSessionNumber: number }
export function readSessionArchive(raw: string): SessionArchive {
    const value = JSON.parse(raw);
    const validNumber = (n: unknown) => typeof n === "number" && Number.isSafeInteger(n) && n >= 0;
    const validString = (s: unknown, max: number) => typeof s === "string" && s.length <= max;
    if (!value || !Array.isArray(value.sessions) || value.sessions.length > 100 ||
        !validNumber(value.nextSessionNumber) || value.nextSessionNumber < 1 ||
        Object.keys(value).some((key) => !["sessions", "nextSessionNumber"].includes(key))) throw new Error("Архив сессий повреждён. Исходник не изменён.");
    const ids = new Set();
    for (const s of value.sessions) {
        if (!s || typeof s !== "object" || Array.isArray(s) || !validString(s.id, 180) || !s.id || ids.has(s.id) ||
            !validString(s.name, 500) || !validString(s.text, 1_000_000) || !validNumber(s.startedAt) ||
            (s.endedAt !== undefined && !validNumber(s.endedAt)) || (s.recap !== undefined && !validString(s.recap, 100000)) ||
            Object.keys(s).some((key) => !["id", "name", "text", "recap", "startedAt", "endedAt"].includes(key))) throw new Error("Архив сессий повреждён. Исходник не изменён.");
        ids.add(s.id);
    }
    return value;
}
