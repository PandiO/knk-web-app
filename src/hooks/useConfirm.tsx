import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FeedbackModal } from '../components/FeedbackModal';

export interface ConfirmOptions {
    title: string;
    /** One or two plain sentences: what happens, and what goes with it. */
    message: string;
    /** The action button, e.g. "Delete" (default "Continue"). */
    confirmLabel?: string;
    /** The button that answers no (default "Cancel"). */
    cancelLabel?: string;
    /** A destructive action (a delete): the action button is red. */
    danger?: boolean;
}

export type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

/**
 * KNG-169: asks a question in a FeedbackModal instead of the browser's confirm box. Returns
 * `confirm(options)`, which resolves true when the action button is pressed and false on Cancel,
 * the X or a click outside, plus the modal element to render once in the component.
 *
 *     const [confirm, confirmModal] = useConfirm();
 *     if (!(await confirm({ title: 'Delete this rule?', message: '…', confirmLabel: 'Delete', danger: true }))) return;
 *     …
 *     return <>{…}{confirmModal}</>;
 */
export function useConfirm(): [ConfirmFn, React.ReactElement] {
    const [options, setOptions] = useState<ConfirmOptions | null>(null);
    const resolver = useRef<((confirmed: boolean) => void) | null>(null);

    const answer = useCallback((confirmed: boolean) => {
        const resolve = resolver.current;
        resolver.current = null;
        setOptions(null);
        resolve?.(confirmed);
    }, []);

    const confirm = useCallback<ConfirmFn>(next => {
        // A second question replaces an unanswered one, which counts as no.
        resolver.current?.(false);
        return new Promise<boolean>(resolve => {
            resolver.current = resolve;
            setOptions(next);
        });
    }, []);

    // Unmounting with a question open answers no, so an awaiting handler doesn't hang.
    useEffect(() => () => resolver.current?.(false), []);

    const modal = (
        <FeedbackModal
            open={options !== null}
            title={options?.title ?? ''}
            message={options?.message ?? ''}
            status="info"
            onClose={() => answer(false)}
            onContinue={() => answer(true)}
            continueLabel={options?.confirmLabel ?? 'Continue'}
            cancelLabel={options?.cancelLabel ?? 'Cancel'}
            danger={options?.danger}
        />
    );

    return [confirm, modal];
}
