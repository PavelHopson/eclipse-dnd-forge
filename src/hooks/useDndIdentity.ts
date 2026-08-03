import { useCallback, useEffect, useState } from "react";
import {
    beginEclipseSignIn,
    getDndSession,
    signOutDnd,
    type DndSession,
} from "../model/auth/dndSession";

export function useDndIdentity(enabled = true) {
    const [session, setSession] = useState<DndSession | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        if (!enabled) {
            setSession(null);
            setError(null);
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            setSession(await getDndSession(true));
        } catch (cause) {
            setSession(null);
            setError(cause instanceof Error ? cause.message : "Не удалось проверить вход");
        } finally {
            setLoading(false);
        }
    }, [enabled]);

    useEffect(() => { void refresh(); }, [refresh]);

    return {
        session,
        loading,
        error,
        signIn: beginEclipseSignIn,
        signOut: async () => {
            setLoading(true);
            try {
                await signOutDnd();
                setSession(null);
                setError(null);
            } finally {
                setLoading(false);
            }
        },
        refresh,
    };
}
