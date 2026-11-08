import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ConfirmDialog, ConfirmOptions, ConfirmReasonOptions } from '../components/ConfirmDialog';

export type { ConfirmOptions, ConfirmReasonOptions };

export type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

/** Resolves the trimmed reason when the action button is pressed, null on Cancel. */
export type ConfirmWithReasonFn = (options: ConfirmOptions & { reason?: ConfirmReasonOptions }) => Promise<string | null>;

interface Pending {
    options: ConfirmOptions;
    resolve: (confirmed: boolean, reason?: string) => void;
}

/**
 * KNG-169, #33: asks a question in the accessible ConfirmDialog instead of the browser's confirm box.
 * Returns `confirm(options)`, which resolves true when the action button is pressed and false on Cancel,
 * the ×, Escape or a click outside; the dialog element to render once in the component; and
 * `confirmWithReason(options)`, which also asks for a reason (required unless `reason.required` is false)
 * and resolves it, or null when the answer is no (MOD-2: the reason goes into the audit log).
 *
 *     const [confirm, confirmModal, confirmWithReason] = useConfirm();
 *     if (!(await confirm({ title: 'Delete this rule?', message: '…', confirmLabel: 'Delete', danger: true }))) return;
 *     const reason = await confirmWithReason({ title: 'Freeze Steve?', message: '…', confirmLabel: 'Freeze',
 *                                             danger: true, reason: { hint: 'Saved in the audit log.' } });
 *     if (reason === null) return;
 *     …
 *     return <>{…}{confirmModal}</>;
 */
export function useConfirm(): [ConfirmFn, React.ReactElement, ConfirmWithReasonFn] {
    const [pending, setPending] = useState<Pending | null>(null);
    const current = useRef<Pending | null>(null);

    const ask = useCallback((options: ConfirmOptions, resolve: Pending['resolve']) => {
        // A second question replaces an unanswered one, which counts as no.
        current.current?.resolve(false);
        const next = { options, resolve };
        current.current = next;
        setPending(next);
    }, []);

    const answer = useCallback((confirmed: boolean, reason?: string) => {
        const open = current.current;
        current.current = null;
        setPending(null);
        open?.resolve(confirmed, reason);
    }, []);

    const confirm = useCallback<ConfirmFn>(
        options => new Promise<boolean>(resolve => ask(options, confirmed => resolve(confirmed))),
        [ask]
    );

    const confirmWithReason = useCallback<ConfirmWithReasonFn>(
        options => new Promise<string | null>(resolve =>
            ask({ ...options, reason: options.reason ?? {} }, (confirmed, reason) => resolve(confirmed ? reason ?? '' : null))),
        [ask]
    );

    // Unmounting with a question open answers no, so an awaiting handler doesn't hang.
    useEffect(() => () => current.current?.resolve(false), []);

    const modal = <ConfirmDialog open={pending !== null} options={pending?.options ?? null} onAnswer={answer} />;

    return [confirm, modal, confirmWithReason];
}
