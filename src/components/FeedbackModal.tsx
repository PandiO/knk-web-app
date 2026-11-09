import React, { useEffect, useId, useRef, useState } from 'react';
import { CheckCircle2, XCircle, Info, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { Dialog } from './Dialog';
import { apiRefusalReason } from '../utils/apiRefusalReason';

/**
 * Extra information behind a "Show details" button (PandiO/knk-workspace#44), e.g. which structures still use a
 * street: `load` runs only when the button is pressed (once; Hide/Show again keeps the answer), with a spinner, and its
 * result shows under the message in the scrolling body, so the footer stays in view. A failure shows an error line
 * with Try again.
 */
export interface FeedbackDetails {
    /** The button's text (default "Show details"). */
    label?: string;
    load: () => Promise<React.ReactNode>;
}

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
    /** "Show details" (#44): fetched only on request. */
    details?: FeedbackDetails;
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
    danger = false,
    details
}) => {
    const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);
    const [busy, setBusy] = useState(false);
    const mounted = useRef(true);
    useEffect(() => () => { mounted.current = false; }, []);
    // With a details button in the body, focus still starts on the footer's first button (#44).
    const firstFooterButton = useRef<HTMLButtonElement>(null);

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
    const firstIs = onSecondary && secondaryLabel ? 'secondary' : isQuestion ? 'cancel' : 'continue';

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
            bodyClassName="px-6 pb-2 pt-0"
            initialFocusRef={details ? (firstFooterButton as React.RefObject<HTMLElement>) : undefined}
            footer={
                <>
                    {autoCloseMs && secondsRemaining !== null && (
                        <span className="mr-auto self-center text-xs text-muted">Closing in {secondsRemaining}s...</span>
                    )}
                    {onSecondary && secondaryLabel && (
                        <button
                            type="button"
                            ref={firstIs === 'secondary' ? firstFooterButton : undefined}
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
                        <button type="button" ref={firstIs === 'cancel' ? firstFooterButton : undefined} onClick={onClose} disabled={busy} className="btn-secondary">
                            {cancelLabel}
                        </button>
                    )}
                    <button
                        type="button"
                        ref={firstIs === 'continue' ? firstFooterButton : undefined}
                        onClick={handleContinue}
                        disabled={busy}
                        className={danger ? 'btn-danger' : 'btn-primary'}
                    >
                        {continueLabel ?? (isQuestion ? 'Continue' : 'Close')}
                    </button>
                </>
            }
        >
            {details ? <DetailsDisclosure details={details} /> : undefined}
        </Dialog>
    );
};

type DetailsState =
    | { kind: 'idle' }
    | { kind: 'loading' }
    | { kind: 'loaded'; content: React.ReactNode }
    | { kind: 'error'; message: string };

/** The button with `aria-expanded` and the region it opens; loads once, on the first press. */
const DetailsDisclosure: React.FC<{ details: FeedbackDetails }> = ({ details }) => {
    const [expanded, setExpanded] = useState(false);
    const [state, setState] = useState<DetailsState>({ kind: 'idle' });
    const regionId = useId();
    const alive = useRef(true);
    useEffect(() => () => { alive.current = false; }, []);

    const load = async () => {
        setState({ kind: 'loading' });
        try {
            const content = await details.load();
            if (alive.current) setState({ kind: 'loaded', content });
        } catch (error) {
            if (alive.current) {
                setState({ kind: 'error', message: apiRefusalReason(error) ?? "The details couldn't be loaded." });
            }
        }
    };

    const toggle = () => {
        const next = !expanded;
        setExpanded(next);
        if (next && (state.kind === 'idle' || state.kind === 'error')) void load();
    };

    const label = details.label ?? 'Show details';
    const Chevron = expanded ? ChevronDown : ChevronRight;
    return (
        <div className="border-t border-line pt-2">
            <button
                type="button"
                onClick={toggle}
                aria-expanded={expanded}
                aria-controls={regionId}
                className="btn-tertiary inline-flex items-center gap-1 text-sm"
                data-testid="feedback-details-toggle"
            >
                <Chevron className="h-4 w-4" aria-hidden="true" />
                {expanded ? 'Hide details' : label}
            </button>
            <div id={regionId} hidden={!expanded} className="mt-2" aria-live="polite">
                {state.kind === 'loading' && (
                    <p className="inline-flex items-center gap-2 text-sm text-muted" role="status">
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        Loading details…
                    </p>
                )}
                {state.kind === 'error' && (
                    <p className="flex flex-wrap items-center gap-2 text-sm text-danger" role="alert">
                        {state.message}
                        <button type="button" className="btn-tertiary text-sm" onClick={() => void load()}>Try again</button>
                    </p>
                )}
                {state.kind === 'loaded' && state.content}
            </div>
        </div>
    );
};
