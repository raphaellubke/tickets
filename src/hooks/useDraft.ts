'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface DraftState<T> {
    hasDraft: boolean;
    draftSavedAt: string | null;
    restoreDraft: () => T | null;
    clearDraft: () => void;
    saveStatus: 'idle' | 'saved';
}

/**
 * Auto-saves `data` to localStorage under `key` whenever it changes (debounced).
 * Only saves when `enabled` is true (e.g., not in the middle of loading from DB).
 */
export function useDraft<T>(
    key: string,
    data: T,
    enabled: boolean,
): DraftState<T> {
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle');
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isFirstRender = useRef(true);

    const [hasDraft] = useState<boolean>(() => {
        if (typeof window === 'undefined') return false;
        return !!localStorage.getItem(key);
    });

    const [draftSavedAt] = useState<string | null>(() => {
        if (typeof window === 'undefined') return null;
        try {
            const raw = localStorage.getItem(key);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            return parsed.__savedAt || null;
        } catch { return null; }
    });

    // Debounced save whenever data changes
    useEffect(() => {
        if (!enabled) return;
        if (isFirstRender.current) { isFirstRender.current = false; return; }

        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
            try {
                localStorage.setItem(key, JSON.stringify({ ...data as any, __savedAt: new Date().toISOString() }));
                setSaveStatus('saved');
                if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
                statusTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2500);
            } catch {}
        }, 1000);

        return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    }, [data, enabled, key]);

    const restoreDraft = useCallback((): T | null => {
        try {
            const raw = localStorage.getItem(key);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            delete parsed.__savedAt;
            return parsed as T;
        } catch { return null; }
    }, [key]);

    const clearDraft = useCallback(() => {
        localStorage.removeItem(key);
    }, [key]);

    return { hasDraft, draftSavedAt, restoreDraft, clearDraft, saveStatus };
}
