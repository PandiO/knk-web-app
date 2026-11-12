import { Subject } from 'rxjs';
import { logging } from './logging';

/**
 * Non-blocking feedback in ToastRegion (PandiO/knk-workspace#33; the first `success` kind came with #177
 * link 1). Use a toast for news that needs no answer: "Town saved", "Copied", an undoable change (with an
 * action). Use the Dialog / `useConfirm` for a question, and a field message for an input error.
 *
 *     toast.success('Town saved');
 *     toast.info('Draft restored', { action: { label: 'Discard', onClick: discardDraft } });
 *     toast.error('Could not load towns');     // same as logging.errorHandler.next(...)
 *
 * Errors still flow through `logging.errorHandler` (about 45 call sites send there); `toast.error` with no
 * options is a shortcut to it, so both paths look the same. A toast stays 5 s (errors 8 s, with an action
 * 10 s), longer while the pointer or focus is on it; `durationMs: null` keeps it until it is dismissed.
 * The same kind and text shown twice is one toast whose timer restarts.
 */

export type ToastKind = 'success' | 'info' | 'warning' | 'error';

export interface ToastAction {
    /** The button text, e.g. "Undo" or "View". */
    label: string;
    /** Runs on click; the toast then closes. */
    onClick: () => void;
}

export interface ToastOptions {
    action?: ToastAction;
    /** How long it stays, in ms; `null` until dismissed. Default per kind (see DEFAULT_TOAST_DURATION_MS). */
    durationMs?: number | null;
}

export interface ToastRequest extends ToastOptions {
    kind: ToastKind;
    message: string;
}

export const DEFAULT_TOAST_DURATION_MS: Record<ToastKind, number> = {
    success: 5000,
    info: 5000,
    warning: 8000,
    error: 8000,
};

/** A toast with an action stays at least this long, so there is time to reach the button. */
export const ACTION_TOAST_MIN_DURATION_MS = 10000;

/** Every toast except the plain errors (those come through logging.errorHandler). */
export const toastRequests = new Subject<ToastRequest>();

const show = (kind: ToastKind) => (message: string, options: ToastOptions = {}) =>
    toastRequests.next({ kind, message, ...options });

export const toast = {
    show: (request: ToastRequest) => toastRequests.next(request),
    success: show('success'),
    info: show('info'),
    warning: show('warning'),
    error: (message: string, options?: ToastOptions) =>
        options ? toastRequests.next({ kind: 'error', message, ...options }) : logging.errorHandler.next(message),
};
