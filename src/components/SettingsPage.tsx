import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { BlockerFunction } from 'react-router-dom';
import { Loader2, RefreshCcw, RotateCcw, Save } from 'lucide-react';
import { ConfirmOptions, useConfirm } from '../hooks/useConfirm';
import { NavigationBlocker, useHasDataRouter } from '../hooks/useLeaveGuard';
import { apiRefusalReason } from '../utils/apiRefusalReason';
import { DateInput, formatDateTime } from '../utils/format';
import { toast } from '../utils/toast';

/**
 * PandiO/knk-workspace#187 (SET-4, SET-7): the one save model for settings pages. A sticky header with the
 * title, when (and by whom) it was last saved, the number of unsaved changes, Discard and Save (n); section
 * cards (`SettingsSection`) below it. With unsaved changes:
 * - leaving the page in the app asks first (W2's `useConfirm`, red "Leave", focus on Stay); a reload or
 *   closing the tab gets the browser's own question;
 * - Discard and Reload ask before they throw the changes away.
 * Save runs `onSave`; success is a toast (its message, or "Saved n changes."), a refusal stays in the header
 * (`role="alert"`) until the next save. The page keeps its own values and counts its changes (`dirtyCount`);
 * Siege's pattern (mark changed fields, send only those) is the model (SET-4).
 *
 * #26: `confirmSave` asks a danger question before a save that switches something risky (the payments kill
 * switch, lootboxes off); No keeps the changes and saves nothing. `embedded` puts the shell inside a tab of a
 * page that has its own h1 (Lootboxes → Settings): the title is an h2 and the column is the tab's. A tab
 * switch changes the URL (`?tab=`), so with changes it asks "Leave without saving?" like any other navigation.
 *
 *     <SettingsPage title="Siege configuration" lastSaved={{ at: config.updatedAt }}
 *                   dirtyCount={changed.length} canSave={!hasErrors}
 *                   onSave={async () => { apply(await client.update(changes)); }} onDiscard={reset}
 *                   onReload={load} loading={loading} loadError={loadError} onRetry={load}>
 *       <SettingsSection title="Capture" description="…">…fields…</SettingsSection>
 *     </SettingsPage>
 */
export interface SettingsPageProps {
    title: string;
    description?: React.ReactNode;
    /** "Last saved {when} by {who}"; nothing without a time. */
    lastSaved?: { at?: DateInput; by?: string | null };
    /** How many settings differ from the saved ones; 0 = nothing to save. */
    dirtyCount: number;
    /** False while a value is invalid: Save is off (the field shows why). Default true. */
    canSave?: boolean;
    /** Saves the changes; may resolve the success message. Throwing keeps the changes and shows the reason. */
    onSave: () => Promise<string | void>;
    /** Puts the saved values back. */
    onDiscard: () => void;
    /** Loads the saved values again (a Reload button); asks first when something changed. */
    onReload?: () => void | Promise<void>;
    /** The refusal text for a failed save; default the API's reason or "The changes could not be saved.". */
    saveErrorMessage?: (error: unknown) => string;
    /** The first load: a spinner in place of the sections. */
    loading?: boolean;
    loadingLabel?: string;
    /** The load failed: this message with Retry, no form (nothing can be saved over the real values). */
    loadError?: React.ReactNode;
    onRetry?: () => void;
    /** More buttons in the header, before Reload. */
    headerActions?: React.ReactNode;
    /** Width of the page column; default `max-w-4xl`. */
    width?: 'max-w-4xl' | 'max-w-5xl' | 'max-w-7xl';
    /**
     * A question to ask before saving, or null to save at once (#26: risky switches). Called with the changes
     * as they are; No keeps them and saves nothing.
     */
    confirmSave?: () => ConfirmOptions | null | undefined;
    /** Inside a tab of a page with its own h1: the title is an h2 and the shell fills the tab (#26). */
    embedded?: boolean;
    children?: React.ReactNode;
}

export const LEAVE_SETTINGS_TITLE = 'Leave without saving?';
const changesText = (count: number) => `${count} unsaved change${count === 1 ? '' : 's'}`;

const defaultSaveError = (error: unknown) => apiRefusalReason(error) ?? 'The changes could not be saved.';

export const SettingsPage: React.FC<SettingsPageProps> = ({
    title,
    description,
    lastSaved,
    dirtyCount,
    canSave = true,
    onSave,
    onDiscard,
    onReload,
    saveErrorMessage = defaultSaveError,
    loading = false,
    loadingLabel = 'Loading settings…',
    loadError,
    onRetry,
    headerActions,
    width = 'max-w-4xl',
    confirmSave,
    embedded = false,
    children,
}) => {
    const [confirm, confirmModal] = useConfirm();
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const hasDataRouter = useHasDataRouter();
    const dirty = dirtyCount > 0;
    const dirtyRef = useRef(dirty);
    dirtyRef.current = dirty;
    const titleId = 'settings-page-title';

    // A reload or closing the tab: the browser asks (it shows its own text).
    useEffect(() => {
        if (!dirty) return undefined;
        const onBeforeUnload = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            event.returnValue = '';
        };
        window.addEventListener('beforeunload', onBeforeUnload);
        return () => window.removeEventListener('beforeunload', onBeforeUnload);
    }, [dirty]);

    const shouldBlock = useCallback<BlockerFunction>(({ currentLocation, nextLocation }) =>
        dirtyRef.current
        && (currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search), []);

    const askToLeave = useCallback((count: number) => confirm({
        title: LEAVE_SETTINGS_TITLE,
        message: embedded
            ? `${changesText(count)} in ${title} will be lost.`
            : `${changesText(count)} on this page will be lost.`,
        confirmLabel: 'Leave',
        cancelLabel: 'Stay',
        danger: true,
    }), [confirm, embedded, title]);

    const countRef = useRef(dirtyCount);
    countRef.current = dirtyCount;
    const onBlocked = useCallback((proceed: () => void, cancel: () => void) => {
        void askToLeave(countRef.current).then(leave => (leave ? proceed() : cancel()));
    }, [askToLeave]);

    const handleSave = async () => {
        if (saving || !dirty || !canSave) return;
        const question = confirmSave?.();
        if (question && !(await confirm({ danger: true, ...question }))) return;
        setSaving(true);
        setSaveError(null);
        const count = dirtyCount;
        try {
            const message = await onSave();
            toast.success(message || `Saved ${count} change${count === 1 ? '' : 's'}.`);
        } catch (error) {
            setSaveError(saveErrorMessage(error));
        } finally {
            setSaving(false);
        }
    };

    const handleDiscard = async () => {
        if (!dirty) return;
        const ok = await confirm({
            title: `Discard ${changesText(dirtyCount)}?`,
            message: 'The page goes back to the saved settings.',
            confirmLabel: 'Discard',
            danger: true,
        });
        if (!ok) return;
        setSaveError(null);
        onDiscard();
    };

    const handleReload = async () => {
        if (!onReload) return;
        if (dirty) {
            const ok = await confirm({
                title: 'Reload and discard your changes?',
                message: `${changesText(dirtyCount)} will be lost; the page shows the saved settings again.`,
                confirmLabel: 'Reload',
                danger: true,
            });
            if (!ok) return;
        }
        setSaveError(null);
        await onReload();
    };

    if (loadError) {
        return (
            <div className="max-w-xl mx-auto mt-16 panel border-danger-line p-6" role="alert">
                <h1 className="text-xl font-semibold text-fg">{loadError}</h1>
                <p className="mt-2 text-sm text-muted">
                    The settings are not shown, so nothing can be saved over the real values by accident.
                    Check that the API is running, then try again.
                </p>
                {onRetry && (
                    <button type="button" className="btn-primary text-sm mt-4" onClick={onRetry}>
                        Retry
                    </button>
                )}
            </div>
        );
    }

    const lastSavedText = lastSaved?.at
        ? `Last saved ${formatDateTime(lastSaved.at)}${lastSaved.by ? ` by ${lastSaved.by}` : ''}.`
        : null;

    return (
        <div className={embedded ? 'space-y-6' : `${width} mx-auto space-y-6`}>
            {hasDataRouter && <NavigationBlocker shouldBlock={shouldBlock} onBlocked={onBlocked} />}
            <header
                aria-labelledby={titleId}
                className="sticky top-16 z-30 panel bg-surface px-4 py-3 md:px-6 md:py-4 shadow-md"
            >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                        {embedded
                            ? <h2 id={titleId} className="text-lg sm:text-xl font-semibold text-fg">{title}</h2>
                            : <h1 id={titleId} className="text-xl sm:text-2xl font-bold text-fg">{title}</h1>}
                        {/* On a phone the sticky header stays small: no description there. */}
                        {description && <div className="mt-1 hidden sm:block text-sm text-muted">{description}</div>}
                        <p className="mt-1 text-xs text-muted">
                            {lastSavedText}
                            {lastSavedText && ' '}
                            <span aria-live="polite" className={dirty ? 'font-semibold text-warning-strong' : ''}>
                                {dirty ? `${changesText(dirtyCount)}.` : 'No unsaved changes.'}
                            </span>
                        </p>
                    </div>
                    <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 md:justify-end">
                        {headerActions}
                        {onReload && (
                            <button
                                type="button"
                                onClick={() => void handleReload()}
                                disabled={loading || saving}
                                className="btn-secondary text-sm whitespace-nowrap disabled:opacity-50"
                            >
                                <RefreshCcw className="h-4 w-4" aria-hidden="true" /> <span className="sr-only sm:not-sr-only">Reload</span>
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => void handleDiscard()}
                            disabled={!dirty || saving}
                            className="btn-secondary text-sm whitespace-nowrap disabled:opacity-50"
                        >
                            <RotateCcw className="h-4 w-4" aria-hidden="true" /> Discard
                        </button>
                        <button
                            type="button"
                            onClick={() => void handleSave()}
                            disabled={!dirty || !canSave || saving || loading}
                            aria-busy={saving || undefined}
                            className="btn-primary text-sm whitespace-nowrap disabled:opacity-50"
                        >
                            {saving
                                ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                                : <Save className="h-4 w-4" aria-hidden="true" />}
                            Save{dirty ? ` (${dirtyCount})` : ''}
                        </button>
                    </div>
                </div>
                {saveError && (
                    <p className="mt-2 text-sm field-error" role="alert">{saveError}</p>
                )}
            </header>

            {loading ? (
                <div className="flex items-center justify-center py-16 text-muted" role="status">
                    <Loader2 className="h-6 w-6 mr-2 animate-spin" aria-hidden="true" /> {loadingLabel}
                </div>
            ) : children}
            {confirmModal}
        </div>
    );
};

/** A card on a settings page: a titled `<section>`; `changed` adds a "Changed" mark next to the title. */
export const SettingsSection: React.FC<{
    title: React.ReactNode;
    description?: React.ReactNode;
    changed?: boolean;
    className?: string;
    children?: React.ReactNode;
}> = ({ title, description, changed = false, className = '', children }) => {
    const id = React.useId();
    return (
        <section aria-labelledby={id} className={`panel p-4 md:p-6 space-y-4 ${className}`}>
            <div>
                <div className="flex flex-wrap items-center gap-2">
                    <h2 id={id} className="text-lg font-semibold text-fg">{title}</h2>
                    {changed && (
                        <span className="inline-flex items-center rounded-full bg-warning-muted px-2 py-0.5 text-xs font-medium text-warning-strong">
                            Changed
                        </span>
                    )}
                </div>
                {description && <div className="text-sm text-muted mt-1">{description}</div>}
            </div>
            {children}
        </section>
    );
};
