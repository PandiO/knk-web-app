import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { logging } from '../utils';
import { resolveErrorMessage } from '../utils/errorMessages';
import {
    ACTION_TOAST_MIN_DURATION_MS,
    DEFAULT_TOAST_DURATION_MS,
    ToastAction,
    ToastKind,
    ToastRequest,
    toastRequests,
} from '../utils/toast';

// The visible end of logging.errorHandler (X-1, KNG-141) and of `toast.*` (utils/toast, #33). One toast
// per distinct kind and message (a repeat restarts its timer), at most MAX_TOASTS, in a polite live
// region. A toast waits while the pointer or keyboard focus is on it (WCAG 2.2.1), and an action keeps it
// open for at least ACTION_TOAST_MIN_DURATION_MS.

const MAX_TOASTS = 4;

interface Toast {
    id: number;
    kind: ToastKind;
    message: string;
    action?: ToastAction;
    /** null: until dismissed. */
    durationMs: number | null;
}

const STYLE: Record<ToastKind, { line: string; icon: React.ReactElement; label: string }> = {
    success: {
        line: 'border-success-line',
        icon: <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-success" aria-hidden="true" />,
        label: 'Success',
    },
    info: {
        line: 'border-info-line',
        icon: <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-info" aria-hidden="true" />,
        label: 'Information',
    },
    warning: {
        line: 'border-warning-line',
        icon: <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-warning" aria-hidden="true" />,
        label: 'Warning',
    },
    error: {
        line: 'border-danger-line',
        icon: <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-danger" aria-hidden="true" />,
        label: 'Error',
    },
};

function durationOf(request: ToastRequest): number | null {
    if (request.durationMs === null) return null;
    const base = request.durationMs ?? DEFAULT_TOAST_DURATION_MS[request.kind];
    return request.action ? Math.max(base, ACTION_TOAST_MIN_DURATION_MS) : base;
}

export const ToastRegion: React.FC = () => {
    const [toasts, setToasts] = React.useState<Toast[]>([]);
    // The list as last rendered plus pending changes, so the subscriber decides outside setState.
    const current = React.useRef<Toast[]>([]);
    const timers = React.useRef(new Map<number, ReturnType<typeof setTimeout>>());
    // Toasts under the pointer or holding focus: their timer waits.
    const held = React.useRef(new Set<number>());
    const nextId = React.useRef(1);

    const update = React.useCallback((next: Toast[]) => {
        current.current = next;
        setToasts(next);
    }, []);

    const clearTimer = React.useCallback((id: number) => {
        const timer = timers.current.get(id);
        if (timer) clearTimeout(timer);
        timers.current.delete(id);
    }, []);

    const dismiss = React.useCallback((id: number) => {
        clearTimer(id);
        held.current.delete(id);
        update(current.current.filter(toast => toast.id !== id));
    }, [clearTimer, update]);

    const startTimer = React.useCallback((toast: Toast) => {
        clearTimer(toast.id);
        if (toast.durationMs === null || held.current.has(toast.id)) return;
        timers.current.set(toast.id, setTimeout(() => dismiss(toast.id), toast.durationMs));
    }, [clearTimer, dismiss]);

    const hold = React.useCallback((id: number) => {
        held.current.add(id);
        clearTimer(id);
    }, [clearTimer]);

    const release = React.useCallback((id: number) => {
        held.current.delete(id);
        const toast = current.current.find(t => t.id === id);
        if (toast) startTimer(toast);
    }, [startTimer]);

    React.useEffect(() => {
        const activeTimers = timers.current;
        const show = (request: ToastRequest) => {
            const existing = current.current.find(t => t.kind === request.kind && t.message === request.message);
            const toast: Toast = {
                id: existing ? existing.id : nextId.current++,
                kind: request.kind,
                message: request.message,
                action: request.action,
                durationMs: durationOf(request),
            };
            startTimer(toast);
            if (existing) {
                // Same text again: one toast, with the newest action and a fresh timer.
                update(current.current.map(t => (t.id === toast.id ? toast : t)));
                return;
            }
            const next = [...current.current, toast];
            for (const dropped of next.slice(0, Math.max(0, next.length - MAX_TOASTS))) {
                clearTimer(dropped.id);
                held.current.delete(dropped.id);
            }
            update(next.slice(-MAX_TOASTS));
        };
        const errors = logging.errorHandler.subscribe((data: unknown) =>
            show({ kind: 'error', message: resolveErrorMessage(data) }));
        const requests = toastRequests.subscribe(show);
        return () => {
            errors.unsubscribe();
            requests.unsubscribe();
            activeTimers.forEach(timer => clearTimeout(timer));
            activeTimers.clear();
        };
    }, [clearTimer, startTimer, update]);

    return (
        <div
            role="status"
            aria-live="polite"
            data-dialog-allow-focus
            className="fixed bottom-4 right-4 z-[100] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2"
        >
            {toasts.map(toast => {
                const style = STYLE[toast.kind];
                return (
                    <div
                        key={toast.id}
                        data-kind={toast.kind}
                        onMouseEnter={() => hold(toast.id)}
                        onMouseLeave={() => release(toast.id)}
                        onFocus={() => hold(toast.id)}
                        onBlur={event => {
                            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) release(toast.id);
                        }}
                        className={`flex items-start gap-3 rounded-md border bg-surface p-3 text-sm text-fg shadow-lg ${style.line}`}
                    >
                        {style.icon}
                        <p className="flex-1">
                            <span className="sr-only">{style.label}: </span>
                            {toast.message}
                        </p>
                        {toast.action && (
                            <button
                                type="button"
                                onClick={() => {
                                    const { onClick } = toast.action!;
                                    dismiss(toast.id);
                                    onClick();
                                }}
                                className="rounded font-medium text-primary underline-offset-2 hover:text-primary-dark hover:underline focus:outline-none focus:ring-2 focus:ring-focus"
                            >
                                {toast.action.label}
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => dismiss(toast.id)}
                            className="rounded text-muted hover:text-fg focus:outline-none focus:ring-2 focus:ring-focus"
                            aria-label="Dismiss"
                        >
                            <X className="h-4 w-4" aria-hidden="true" />
                        </button>
                    </div>
                );
            })}
        </div>
    );
};
