import React from 'react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';
import { logging } from '../utils';
import { resolveErrorMessage } from '../utils/errorMessages';
import { successToasts } from '../utils/toast';

// The visible end of logging.errorHandler (X-1, KNG-141). Before this, App kept the messages in a
// ref the page never rendered, so about 45 error call sites failed silently. One toast per
// distinct message (a repeat restarts its timer), at most MAX_TOASTS, in a polite live region.
// Since #177 link 1 also `toast.success()` (utils/toast), e.g. after a form was submitted.

const DISMISS_AFTER_MS: Record<ToastKind, number> = { error: 8000, success: 5000 };
const MAX_TOASTS = 4;

type ToastKind = 'error' | 'success';

interface Toast {
    id: number;
    kind: ToastKind;
    message: string;
}

export const ToastRegion: React.FC = () => {
    const [toasts, setToasts] = React.useState<Toast[]>([]);
    // The list as last rendered plus pending changes, so the subscriber decides outside setState.
    const current = React.useRef<Toast[]>([]);
    const timers = React.useRef(new Map<number, ReturnType<typeof setTimeout>>());
    const nextId = React.useRef(1);

    const update = React.useCallback((next: Toast[]) => {
        current.current = next;
        setToasts(next);
    }, []);

    const dismiss = React.useCallback((id: number) => {
        const timer = timers.current.get(id);
        if (timer) clearTimeout(timer);
        timers.current.delete(id);
        update(current.current.filter(toast => toast.id !== id));
    }, [update]);

    React.useEffect(() => {
        const activeTimers = timers.current;
        const show = (kind: ToastKind, message: string) => {
            const existing = current.current.find(toast => toast.kind === kind && toast.message === message);
            const id = existing ? existing.id : nextId.current++;
            const previous = activeTimers.get(id);
            if (previous) clearTimeout(previous);
            activeTimers.set(id, setTimeout(() => dismiss(id), DISMISS_AFTER_MS[kind]));
            if (existing) {
                return;
            }
            const next = [...current.current, { id, kind, message }];
            for (const dropped of next.slice(0, Math.max(0, next.length - MAX_TOASTS))) {
                const timer = activeTimers.get(dropped.id);
                if (timer) clearTimeout(timer);
                activeTimers.delete(dropped.id);
            }
            update(next.slice(-MAX_TOASTS));
        };
        const errors = logging.errorHandler.subscribe((data: unknown) => show('error', resolveErrorMessage(data)));
        const successes = successToasts.subscribe(message => show('success', message));
        return () => {
            errors.unsubscribe();
            successes.unsubscribe();
            activeTimers.forEach(timer => clearTimeout(timer));
            activeTimers.clear();
        };
    }, [dismiss, update]);

    return (
        <div
            role="status"
            aria-live="polite"
            className="fixed bottom-4 right-4 z-[100] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2"
        >
            {toasts.map(toast => (
                <div
                    key={toast.id}
                    data-kind={toast.kind}
                    className={`flex items-start gap-3 rounded-md border bg-white p-3 text-sm text-gray-900 shadow-lg ${
                        toast.kind === 'success' ? 'border-green-200' : 'border-red-200'
                    }`}
                >
                    {toast.kind === 'success' ? (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" aria-hidden="true" />
                    ) : (
                        <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600" aria-hidden="true" />
                    )}
                    <p className="flex-1">{toast.message}</p>
                    <button
                        type="button"
                        onClick={() => dismiss(toast.id)}
                        className="text-gray-500 hover:text-gray-900"
                        aria-label="Dismiss"
                    >
                        <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                </div>
            ))}
        </div>
    );
};
