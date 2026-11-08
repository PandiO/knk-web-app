import { act, renderHook } from '@testing-library/react';
import { REDUCED_MOTION_QUERY, usePrefersReducedMotion } from '../usePrefersReducedMotion';

describe('usePrefersReducedMotion (#258)', () => {
    afterEach(() => {
        delete (window as { matchMedia?: unknown }).matchMedia;
    });

    it('is false without matchMedia', () => {
        delete (window as { matchMedia?: unknown }).matchMedia;
        expect(renderHook(() => usePrefersReducedMotion()).result.current).toBe(false);
    });

    it('follows the system setting, also when it changes', () => {
        let matches = true;
        const listeners: Array<() => void> = [];
        const removeEventListener = jest.fn();
        Object.defineProperty(window, 'matchMedia', {
            configurable: true,
            writable: true,
            value: (query: string) => ({
                get matches() { return query === REDUCED_MOTION_QUERY && matches; },
                media: query,
                addEventListener: (_: string, listener: () => void) => listeners.push(listener),
                removeEventListener,
            }),
        });

        const { result, unmount } = renderHook(() => usePrefersReducedMotion());
        expect(result.current).toBe(true);

        matches = false;
        act(() => listeners.forEach(listener => listener()));
        expect(result.current).toBe(false);

        unmount();
        expect(removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    });
});
