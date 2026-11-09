import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, XCircle, Info } from 'lucide-react';
import { Dialog } from './Dialog';

type FeedbackStatus = 'success' | 'error' | 'info';

interface FeedbackModalProps {
    open: boolean;
    title: string;
    message: string;
    status?: FeedbackStatus;
    onClose: () => void;
    onContinue?: () => void | Promise<void>;
    continueLabel?: string;
    /** Closes (after onContinue) by itself. Prefer `toast.success` for news that needs no answer (#33). */
    autoCloseMs?: number;
    onSecondary?: () => void;
    secondaryLabel?: string;
    /** Label of the button that closes without continuing, shown next to the action (default "Close"). */
    cancelLabel?: string;
    /** The action destroys something (a delete): its button is red. */
    danger?: boolean;
}

const ICON: Record<FeedbackStatus, JSX.Element> = {
    success: <CheckCircle2 className="h-6 w-6 text-success" />,
    error: <XCircle className="h-6 w-6 text-danger" />,
    info: <Info className="h-6 w-6 text-info" />,
};

const BORDER: Record<FeedbackStatus, string> = {
    success: 'border-t-4 border-t-success',
    error: 'border-t-4 border-t-danger',
    info: 'border-t-4 border-t-info',
};

/**
 * A message or a question in the accessible Dialog (#33): Escape, the × and a click outside close it,
 * focus starts on the first button and returns to where it was. Errors and questions are an
 * `alertdialog`. A failing onContinue (it throws) keeps the dialog open for the error the parent shows.
 */
export const FeedbackModal: React.FC<FeedbackModalProps> = ({
    open,
    title,
    message,
    status = 'info',
    onClose,
    onContinue,
    continueLabel,
    autoCloseMs,
    onSecondary,
    secondaryLabel,
    cancelLabel = 'Close',
    danger = false
}) => {
    const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);
    const [busy, setBusy] = useState(false);
    const mounted = useRef(true);
    useEffect(() => () => { mounted.current = false; }, []);

    useEffect(() => {
        if (!open || !autoCloseMs) {
            setSecondsRemaining(null);
            return;
        }

        setSecondsRemaining(Math.ceil(autoCloseMs / 1000));

        const countdownInterval = window.setInterval(() => {
            setSecondsRemaining(prev => {
                if (prev === null || prev <= 1) {
                    window.clearInterval(countdownInterval);
                    return null;
                }
                return prev - 1;
            });
        }, 1000);

        const timerId = window.setTimeout(() => {
            // Prefer continue action when provided, otherwise just close
            if (onContinue) {
                onContinue();
            }
            onClose();
        }, autoCloseMs);

        return () => {
            window.clearTimeout(timerId);
            window.clearInterval(countdownInterval);
        };
    }, [open, autoCloseMs, onClose, onContinue]);

    const handleContinue = async () => {
        if (busy) return;
        setBusy(true);
        try {
            if (onContinue) {
                await onContinue();
            }
            onClose();
        } catch {
            // Keep modal open to show error feedback set by parent
        } finally {
            if (mounted.current) setBusy(false);
        }
    };

    const isQuestion = !!onContinue;

    return (
        <Dialog
            open={open}
            onClose={onClose}
            title={title}
            description={message}
            icon={ICON[status]}
            role={status === 'error' || isQuestion ? 'alertdialog' : 'dialog'}
            size="md"
            closeOnBackdrop
            dismissible={!busy}
            panelClassName={BORDER[status]}
            headerClassName="pb-2"
            footerClassName="pb-4"
            footer={
                <>
                    {autoCloseMs && secondsRemaining !== null && (
                        <span className="mr-auto self-center text-xs text-muted">Closing in {secondsRemaining}s...</span>
                    )}
                    {onSecondary && secondaryLabel && (
                        <button
                            type="button"
                            onClick={() => {
                                onSecondary();
                                onClose();
                            }}
                            className="btn-secondary"
                        >
                            {secondaryLabel}
                        </button>
                    )}
                    {/* With nothing to continue to, one button closes (no "Close" next to a second "Close"). */}
                    {isQuestion && (
                        <button type="button" onClick={onClose} disabled={busy} className="btn-secondary">
                            {cancelLabel}
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={handleContinue}
                        disabled={busy}
                        className={danger ? 'btn-danger' : 'btn-primary'}
                    >
                        {continueLabel ?? (isQuestion ? 'Continue' : 'Close')}
                    </button>
                </>
            }
        />
    );
};
