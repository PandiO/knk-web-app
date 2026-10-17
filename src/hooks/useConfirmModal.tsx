import React from 'react';
import { FeedbackModal } from '../components/FeedbackModal';

export interface ConfirmModalOptions {
    title: string;
    message: string;
    /** Label of the confirming button (FeedbackModal's "Continue" by default). */
    continueLabel?: string;
}

/**
 * KNG-82: an in-app replacement for window.confirm. `confirm(options)` opens a FeedbackModal and
 * resolves true when its continue button is clicked, false when it is closed (Close, the X or a
 * click outside). Render the returned `modal` once in the component. Same pending-state pattern
 * as PlayerDiscoveriesPanel's reset prompt, usable in the middle of an async flow.
 */
export function useConfirmModal(): {
    confirm: (options: ConfirmModalOptions) => Promise<boolean>;
    modal: React.ReactElement;
} {
    const [pending, setPending] = React.useState<ConfirmModalOptions | null>(null);
    const resolveRef = React.useRef<((confirmed: boolean) => void) | null>(null);

    const settle = React.useCallback((confirmed: boolean) => {
        const resolve = resolveRef.current;
        resolveRef.current = null;
        setPending(null);
        resolve?.(confirmed);
    }, []);

    const confirm = React.useCallback((options: ConfirmModalOptions) => {
        // A newer prompt replaces one still open, which counts as cancelled.
        resolveRef.current?.(false);
        return new Promise<boolean>((resolve) => {
            resolveRef.current = resolve;
            setPending(options);
        });
    }, []);

    // Nobody is left to answer once the component is gone.
    React.useEffect(() => () => resolveRef.current?.(false), []);

    const modal = (
        <FeedbackModal
            open={pending !== null}
            title={pending?.title ?? ''}
            message={pending?.message ?? ''}
            continueLabel={pending?.continueLabel}
            onContinue={() => settle(true)}
            onClose={() => settle(false)}
        />
    );

    return { confirm, modal };
}
