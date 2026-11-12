import React, { useId, useState } from 'react';
import { CopyPlus, Eye, EyeOff, Loader2, MoreHorizontal, RotateCcw, Rocket, Save, Sparkles, X } from 'lucide-react';
import { formatDateTime } from '../../utils/format';

/** What the builder holds, for the status line (PandiO/knk-workspace#71). */
export interface BuilderStatus {
    /** Not saved yet (no id). */
    isNew: boolean;
    isPublished: boolean;
    /** Saved changes the wizard / detail pages don't use yet. */
    hasUnpublishedChanges: boolean;
    draftSavedAt?: string | null;
    publishedAt?: string | null;
}

export type BuilderBusy = null | 'saving' | 'publishing' | 'discarding' | 'duplicating';

/** A disabled action says why: "Requires knk.admin.content" (#280) or what is missing first. */
export interface ToolbarGate {
    allowed: boolean;
    reason: string | null;
}

export interface BuilderToolbarProps {
    /** "Form builder" / "Display builder". */
    title: string;
    /** The configuration's name, under the title. */
    name?: string;
    /** "form" / "display page": used in the status words. */
    noun: string;
    status: BuilderStatus;
    dirty: boolean;
    busy: BuilderBusy;
    /** The builder's write node (knk.admin.content): Save, Publish, Duplicate and Discard need it. */
    writeGate: ToolbarGate;
    /** Publish's own condition (nothing to publish yet). */
    publishGate: ToolbarGate;
    duplicateGate: ToolbarGate;
    generateGate: ToolbarGate;
    onSave: () => void;
    onSaveAndClose: () => void;
    onPublish: () => void;
    onDuplicate: () => void;
    onDiscard: () => void;
    onGenerate: () => void;
    onClose: () => void;
    previewOpen: boolean;
    onTogglePreview: () => void;
}

export function statusText(status: BuilderStatus, noun: string): { label: string; tone: 'success' | 'warning' | 'info'; detail: string | null } {
    const saved = status.draftSavedAt ? `Draft saved ${formatDateTime(status.draftSavedAt)}.` : null;
    if (status.isNew) return { label: 'New', tone: 'info', detail: `Not saved yet. Staff can't use this ${noun} until you publish it.` };
    if (!status.isPublished) {
        return { label: 'Draft', tone: 'warning', detail: [`Never published: staff can't use this ${noun} yet.`, saved].filter(Boolean).join(' ') };
    }
    if (status.hasUnpublishedChanges) {
        return { label: 'Published · changes not published', tone: 'warning', detail: [`Staff still get the published version.`, saved].filter(Boolean).join(' ') };
    }
    return {
        label: 'Published',
        tone: 'success',
        detail: status.publishedAt ? `Published ${formatDateTime(status.publishedAt)}; staff use this version.` : 'Staff use this version.',
    };
}

const TONE: Record<'success' | 'warning' | 'info', string> = {
    success: 'bg-success-muted text-success-strong',
    warning: 'bg-warning-muted text-warning-strong',
    info: 'bg-info-muted text-info-strong',
};

const gateOf = (write: ToolbarGate, own?: ToolbarGate): ToolbarGate =>
    !write.allowed ? write : own && !own.allowed ? own : { allowed: true, reason: null };

/**
 * The builders' sticky header (#71): status (draft / published / unpublished changes), unsaved changes, and Save,
 * Save and close, Publish, Preview, plus Generate from metadata, Duplicate and Discard under "More". Buttons the
 * person can't use are disabled with the reason underneath.
 */
export const BuilderToolbar: React.FC<BuilderToolbarProps> = ({
    title, name, noun, status, dirty, busy, writeGate, publishGate, duplicateGate, generateGate,
    onSave, onSaveAndClose, onPublish, onDuplicate, onDiscard, onGenerate, onClose, previewOpen, onTogglePreview,
}) => {
    const [moreOpen, setMoreOpen] = useState(false);
    const hintId = useId();
    const menuId = useId();
    const text = statusText(status, noun);
    const save = gateOf(writeGate, dirty || status.isNew ? undefined : { allowed: false, reason: 'No unsaved changes.' });
    const publish = gateOf(writeGate, publishGate);
    const duplicate = gateOf(writeGate, duplicateGate);
    const generate = gateOf(writeGate, generateGate);
    const canDiscard = status.isPublished && (status.hasUnpublishedChanges || dirty);
    const discard = gateOf(writeGate, canDiscard ? undefined : { allowed: false, reason: 'Nothing to discard.' });
    const isBusy = busy !== null;

    // One visible line per reason the main buttons are off (not "No unsaved changes": the status says that).
    const hints = Array.from(new Set([
        !writeGate.allowed ? `Save, Publish and Duplicate: ${writeGate.reason}` : null,
        writeGate.allowed && !publishGate.allowed && publishGate.reason ? `Publish: ${publishGate.reason}` : null,
    ].filter((h): h is string => !!h)));

    const item = (label: string, icon: React.ReactNode, gate: ToolbarGate, action: () => void, danger = false) => (
        <li role="none">
            <button
                type="button"
                role="menuitem"
                disabled={!gate.allowed || isBusy}
                title={!gate.allowed && gate.reason ? gate.reason : undefined}
                onClick={() => { setMoreOpen(false); action(); }}
                className={`flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-surface-alt disabled:opacity-50 disabled:hover:bg-transparent ${danger ? 'text-danger' : 'text-fg'}`}
            >
                <span className="mt-0.5 flex-shrink-0">{icon}</span>
                <span className="min-w-0">
                    <span className="block">{label}</span>
                    {!gate.allowed && gate.reason && <span className="block text-xs text-muted">{gate.reason}</span>}
                </span>
            </button>
        </li>
    );

    return (
        <header
            aria-label={title}
            className="md:sticky md:top-16 z-30 panel bg-surface px-4 py-3 md:px-6 md:py-4 shadow-md"
            data-testid="builder-toolbar"
        >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                    <h1 className="text-xl sm:text-2xl font-bold text-fg truncate">
                        {title}{name ? <span className="font-normal text-muted">: {name}</span> : null}
                    </h1>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 font-semibold ${TONE[text.tone]}`} data-testid="builder-status">
                            {text.label}
                        </span>
                        {text.detail && <span className="hidden sm:inline">{text.detail}</span>}
                        <span aria-live="polite" className={dirty ? 'font-semibold text-warning-strong' : ''}>
                            {dirty ? 'Unsaved changes.' : status.isNew ? '' : 'No unsaved changes.'}
                        </span>
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                    <button
                        type="button"
                        onClick={onTogglePreview}
                        aria-pressed={previewOpen}
                        className="btn-secondary text-sm whitespace-nowrap"
                    >
                        {previewOpen ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                        Preview
                    </button>
                    <button
                        type="button"
                        onClick={onSave}
                        disabled={!save.allowed || isBusy}
                        aria-busy={busy === 'saving' || undefined}
                        aria-describedby={hints.length ? hintId : undefined}
                        title={!save.allowed && save.reason ? save.reason : undefined}
                        className="btn-secondary text-sm whitespace-nowrap disabled:opacity-50"
                    >
                        {busy === 'saving' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
                        Save
                    </button>
                    <button
                        type="button"
                        onClick={onSaveAndClose}
                        disabled={!save.allowed || isBusy}
                        title={!save.allowed && save.reason ? save.reason : undefined}
                        className="btn-secondary text-sm whitespace-nowrap disabled:opacity-50"
                    >
                        Save and close
                    </button>
                    <button
                        type="button"
                        onClick={onPublish}
                        disabled={!publish.allowed || isBusy}
                        aria-busy={busy === 'publishing' || undefined}
                        aria-describedby={hints.length ? hintId : undefined}
                        title={!publish.allowed && publish.reason ? publish.reason : undefined}
                        className="btn-primary text-sm whitespace-nowrap disabled:opacity-50"
                    >
                        {busy === 'publishing' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Rocket className="h-4 w-4" aria-hidden="true" />}
                        Publish…
                    </button>
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => setMoreOpen(open => !open)}
                            aria-haspopup="menu"
                            aria-expanded={moreOpen}
                            aria-controls={moreOpen ? menuId : undefined}
                            className="btn-secondary text-sm"
                        >
                            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                            More
                        </button>
                        {moreOpen && (
                            <ul
                                id={menuId}
                                role="menu"
                                aria-label="More builder actions"
                                className="absolute right-0 z-40 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-md border border-line bg-surface py-1 shadow-lg"
                                onKeyDown={event => { if (event.key === 'Escape') setMoreOpen(false); }}
                            >
                                {item('Generate from metadata…', <Sparkles className="h-4 w-4" aria-hidden="true" />, generate, onGenerate)}
                                {item('Duplicate…', <CopyPlus className="h-4 w-4" aria-hidden="true" />, duplicate, onDuplicate)}
                                {item('Discard unpublished changes…', <RotateCcw className="h-4 w-4" aria-hidden="true" />, discard, onDiscard, true)}
                            </ul>
                        )}
                    </div>
                    <button type="button" onClick={onClose} className="btn-tertiary text-sm" aria-label={`Close the ${noun} builder`}>
                        <X className="h-4 w-4" aria-hidden="true" />
                        <span aria-hidden="true">Close</span>
                    </button>
                </div>
            </div>
            {hints.length > 0 && (
                <p id={hintId} className="mt-2 text-xs text-muted" data-testid="action-hint">{hints.join(' ')}</p>
            )}
        </header>
    );
};
