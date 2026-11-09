import React from 'react';
import { AlertTriangle, Loader2, Rocket } from 'lucide-react';
import { Dialog } from '../Dialog';
import { PublishSummary } from '../../utils/configBuilder/publishSummary';

export interface PublishDialogProps {
    open: boolean;
    /** "form" / "display page". */
    noun: string;
    /** "New Town" / "Town detail pages": who gets the change. */
    audience: string;
    name: string;
    entityLabel: string;
    firstPublish: boolean;
    summary: PublishSummary | null;
    /** The entity's published default, when publishing as default replaces it. */
    replacesDefault?: string | null;
    /** Saved wizard drafts on this form (forms only). */
    openDraftCount?: number;
    publishing: boolean;
    error: string | null;
    onPublish: () => void;
    onClose: () => void;
}

/**
 * PandiO/knk-workspace#71 (CRUD-14): the confirmation of what Publish changes for staff: the step/section and field
 * changes against the published version, the default, and saved wizard drafts that continue on the new version.
 */
export const PublishDialog: React.FC<PublishDialogProps> = ({
    open, noun, audience, name, entityLabel, firstPublish, summary, replacesDefault, openDraftCount = 0,
    publishing, error, onPublish, onClose,
}) => {
    const lines = summary?.lines ?? [];
    const becomesDefault = summary?.defaultChange === true;
    const stopsBeingDefault = summary?.defaultChange === false;

    return (
        <Dialog
            open={open}
            onClose={onClose}
            dismissible={!publishing}
            role="alertdialog"
            size="lg"
            title={firstPublish ? `Publish "${name}"?` : `Publish the changes to "${name}"?`}
            description={firstPublish
                ? `From now on staff can use this ${noun} (${audience}).`
                : `Staff get this version from now on (${audience}); until then they keep the published one.`}
            icon={<Rocket className="h-5 w-5 text-primary" aria-hidden="true" />}
            footer={(
                <div className="flex flex-wrap justify-end gap-2">
                    <button type="button" className="btn-secondary" onClick={onClose} disabled={publishing}>Cancel</button>
                    <button type="button" className="btn-primary" onClick={onPublish} disabled={publishing} aria-busy={publishing || undefined}>
                        {publishing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Rocket className="h-4 w-4" aria-hidden="true" />}
                        Publish
                    </button>
                </div>
            )}
        >
            <div className="space-y-3 text-sm text-fg" data-testid="publish-summary">
                <h3 className="font-semibold text-fg">What changes for staff</h3>
                {lines.length > 0 ? (
                    <ul className="list-disc space-y-1 pl-5">
                        {lines.map(line => <li key={line}>{line}</li>)}
                    </ul>
                ) : (
                    <p className="text-muted">
                        {firstPublish ? `The ${noun} as it is in the builder.` : 'No step or field changes; only the settings below.'}
                    </p>
                )}
                {becomesDefault && (
                    <p>
                        It becomes the default {noun} for {entityLabel}
                        {replacesDefault ? <>, replacing <strong>"{replacesDefault}"</strong></> : null}.
                    </p>
                )}
                {stopsBeingDefault && (
                    <p>It stops being the default {noun} for {entityLabel}; staff choose a {noun} themselves until another is the default.</p>
                )}
                {openDraftCount > 0 && (
                    <p className="flex gap-2 rounded-md border border-warning-line bg-warning-soft p-3 text-warning-strong">
                        <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
                        <span>
                            {openDraftCount === 1 ? '1 saved draft continues' : `${openDraftCount} saved drafts continue`} on the new
                            version; values of removed fields aren't used.
                        </span>
                    </p>
                )}
                {error && <p className="field-error" role="alert">{error}</p>}
            </div>
        </Dialog>
    );
};
