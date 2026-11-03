import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * PandiO/knk-workspace#39 (CRUD-1 / NAV-6): a page's selected tab in the URL (`?tab=odds`), so Back,
 * a refresh and a shared link open the same tab. The fallback tab is left out of the URL; an unknown
 * value reads as the fallback. Switching tabs replaces the history entry (Back leaves the page
 * instead of stepping through tabs) and keeps the page's other parameters.
 */
export function useTabParam<T extends string>(
    tabs: readonly T[],
    fallback: T,
    param = 'tab'
): [T, (tab: T) => void] {
    const [searchParams, setSearchParams] = useSearchParams();
    const raw = searchParams.get(param);
    const tab = raw !== null && (tabs as readonly string[]).includes(raw) ? (raw as T) : fallback;

    const setTab = useCallback((next: T) => {
        setSearchParams(previous => {
            const params = new URLSearchParams(previous);
            if (next === fallback) params.delete(param);
            else params.set(param, next);
            return params;
        }, { replace: true });
    }, [setSearchParams, fallback, param]);

    return [tab, setTab];
}
