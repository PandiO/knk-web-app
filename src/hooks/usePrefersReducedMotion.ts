import { useEffect, useState } from 'react';

export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

const matches = () =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(REDUCED_MOTION_QUERY).matches;

/**
 * True while the operating system asks for reduced motion (`prefers-reduced-motion: reduce`); follows changes of
 * that setting without a reload. False where matchMedia is missing (jsdom, very old browsers).
 */
export function usePrefersReducedMotion(): boolean {
    const [reduced, setReduced] = useState(matches);

    useEffect(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
        const query = window.matchMedia(REDUCED_MOTION_QUERY);
        const onChange = () => setReduced(query.matches);
        onChange();
        // Safari < 14 only has addListener.
        if (typeof query.addEventListener === 'function') {
            query.addEventListener('change', onChange);
            return () => query.removeEventListener('change', onChange);
        }
        query.addListener(onChange);
        return () => query.removeListener(onChange);
    }, []);

    return reduced;
}
