import React, { useEffect, useId, useRef, useState } from 'react';
import { AlertTriangle, HelpCircle } from 'lucide-react';
import { Dialog } from './Dialog';

/** A reason typed in the confirm (MOD-2: a moderation action whose reason reaches the audit log). */
export interface ConfirmReasonOptions {
    /** The field's label (default "Reason"). */
    label?: string;
    placeholder?: string;
    /** A line under the field, e.g. "Saved in the audit log and shown to other staff." */
    hint?: string;
    /** The action button stays unusable without a reason (default true). */
    required?: boolean;
    /** Shortest reason accepted, after trimming (default 1 when required). */
    minLength?: number;
    /** Longest reason (default 500). */
    maxLength?: number;
    /** Pre-filled text. */
    defaultValue?: string;
}

export interface ConfirmOptions {
    title: string;
    /** One or two plain sentences: what happens, and what goes with it. */
    message: string;
    /** The action button, e.g. "Delete" (default "Continue"). */
    confirmLabel?: string;
    /** The button that answers no (default "Cancel"). */
    cancelLabel?: string;
    /** A destructive action (a delete): the action button is red and focus starts on Cancel. */
    danger?: boolean;
    /** Ask for a reason in the dialog (`confirmWithReason` of useConfirm returns it). */
    reason?: ConfirmReasonOptions;
}

interface ConfirmDialogProps {
    open: boolean;
    options: ConfirmOptions | null;
    /** `reason` is the trimmed text when the options ask for one. */
    onAnswer: (confirmed: boolean, reason?: string) => void;
}

const DEFAULT_MAX_REASON = 500;

/**
 * The confirm of the web app (#33): an `alertdialog` on the shared Dialog. Usually reached through
 * `useConfirm()`; render it directly when the question is part of the page's state.
 */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({ open, options, onAnswer }) => {
    const reasonId = useId();
    const hintId = useId();
    const errorId = useId();
    const reasonRef = useRef<HTMLTextAreaElement>(null);
    const cancelRef = useRef<HTMLButtonElement>(null);
    const confirmRef = useRef<HTMLButtonElement>(null);
    const [reason, setReason] = useState('');
    const [showError, setShowError] = useState(false);

    const reasonOptions = options?.reason;
    useEffect(() => {
        if (open) {
            setReason(reasonOptions?.defaultValue ?? '');
            setShowError(false);
        }
    }, [open, reasonOptions]);

    const danger = !!options?.danger;
    const required = reasonOptions ? reasonOptions.required !== false : false;
    const minLength = reasonOptions?.minLength ?? (required ? 1 : 0);
    const maxLength = reasonOptions?.maxLength ?? DEFAULT_MAX_REASON;
    const trimmed = reason.trim();
    const reasonError = reasonOptions && trimmed.length < minLength
        ? (minLength <= 1 ? `Enter a ${(reasonOptions.label ?? 'reason').toLowerCase()}.` : `Enter at least ${minLength} characters.`)
        : null;

    const submit = () => {
        if (reasonError) {
            setShowError(true);
            reasonRef.current?.focus();
            return;
        }
        onAnswer(true, reasonOptions ? trimmed : undefined);
    };

    const icon = danger
        ? <AlertTriangle className="h-6 w-6 text-danger" />
        : <HelpCircle className="h-6 w-6 text-info" />;

    const describedBy = [reasonOptions?.hint ? hintId : null, showError && reasonError ? errorId : null]
        .filter(Boolean).join(' ') || undefined;

    return (
        <Dialog
            open={open && options !== null}
            onClose={() => onAnswer(false)}
            title={options?.title ?? ''}
            description={options?.message}
            icon={icon}
            role="alertdialog"
            size="md"
            // Without a reason a click outside answers no; with one it would throw the text away.
            closeOnBackdrop={!reasonOptions}
            initialFocusRef={reasonOptions ? reasonRef : danger ? cancelRef : confirmRef}
            panelClassName={danger ? 'border-t-4 border-t-danger' : ''}
            headerClassName={reasonOptions ? '' : 'pb-2'}
            bodyClassName="px-6 pb-2"
            footerClassName="pb-4"
            data-testid="confirm-dialog"
            footer={
                <>
                    <button ref={cancelRef} type="button" className="btn-secondary" onClick={() => onAnswer(false)}>
                        {options?.cancelLabel ?? 'Cancel'}
                    </button>
                    <button
                        ref={confirmRef}
                        type="button"
                        className={danger ? 'btn-danger' : 'btn-primary'}
                        onClick={submit}
                    >
                        {options?.confirmLabel ?? 'Continue'}
                    </button>
                </>
            }
        >
            {reasonOptions ? (
                <div className="space-y-1">
                    <label htmlFor={reasonId} className="block text-sm font-medium text-fg">
                        {reasonOptions.label ?? 'Reason'}
                        {required ? <span className="text-danger" aria-hidden="true"> *</span> : <span className="font-normal text-muted"> (optional)</span>}
                    </label>
                    <textarea
                        ref={reasonRef}
                        id={reasonId}
                        value={reason}
                        onChange={event => {
                            setReason(event.target.value);
                            if (showError) setShowError(false);
                        }}
                        rows={3}
                        maxLength={maxLength}
                        placeholder={reasonOptions.placeholder}
                        aria-required={required || undefined}
                        aria-invalid={showError && !!reasonError ? true : undefined}
                        aria-describedby={describedBy}
                        className={`input ${showError && reasonError ? 'border-danger' : ''}`}
                    />
                    {reasonOptions.hint && <p id={hintId} className="text-xs text-muted">{reasonOptions.hint}</p>}
                    {showError && reasonError && (
                        <p id={errorId} className="field-error text-sm" role="alert">
                            {reasonError}
                        </p>
                    )}
                </div>
            ) : null}
        </Dialog>
    );
};
