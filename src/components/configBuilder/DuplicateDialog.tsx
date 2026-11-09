import React, { useEffect, useState } from 'react';
import { CopyPlus, Loader2 } from 'lucide-react';
import { Dialog } from '../Dialog';
import { Field } from '../Field';

export interface DuplicateDialogProps {
    open: boolean;
    /** "form" / "display page". */
    noun: string;
    sourceName: string;
    /** The builder has saved or unsaved changes that aren't published: the copy leaves them out. */
    hasUnpublishedChanges: boolean;
    duplicating: boolean;
    error: string | null;
    onDuplicate: (name: string) => void;
    onClose: () => void;
}

/** PandiO/knk-workspace#71 (CRUD-12): "Duplicate": a copy of the published version as a new draft, with its own name. */
export const DuplicateDialog: React.FC<DuplicateDialogProps> = ({
    open, noun, sourceName, hasUnpublishedChanges, duplicating, error, onDuplicate, onClose,
}) => {
    const [name, setName] = useState(`${sourceName} (copy)`);
    useEffect(() => {
        if (open) setName(`${sourceName} (copy)`);
    }, [open, sourceName]);
    const trimmed = name.trim();

    return (
        <Dialog
            open={open}
            onClose={onClose}
            dismissible={!duplicating}
            size="md"
            title={`Duplicate "${sourceName}"`}
            description={`A copy of the published version (steps, fields, conditions and rules) as a new draft. Staff can't use it until you publish it.`}
            icon={<CopyPlus className="h-5 w-5 text-primary" aria-hidden="true" />}
            footer={(
                <div className="flex flex-wrap justify-end gap-2">
                    <button type="button" className="btn-secondary" onClick={onClose} disabled={duplicating}>Cancel</button>
                    <button
                        type="button"
                        className="btn-primary"
                        onClick={() => onDuplicate(trimmed)}
                        disabled={duplicating || !trimmed}
                        aria-busy={duplicating || undefined}
                    >
                        {duplicating ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CopyPlus className="h-4 w-4" aria-hidden="true" />}
                        Duplicate
                    </button>
                </div>
            )}
        >
            <form
                className="space-y-3"
                onSubmit={event => {
                    event.preventDefault();
                    if (trimmed && !duplicating) onDuplicate(trimmed);
                }}
            >
                <Field label={`Name of the new ${noun}`} required error={!trimmed ? 'Give the copy a name.' : error ?? undefined}>
                    <input type="text" className="input w-full px-3 py-2" value={name} maxLength={200} onChange={e => setName(e.target.value)} />
                </Field>
                {hasUnpublishedChanges && (
                    <p className="text-sm text-muted">
                        Changes to "{sourceName}" that aren't published stay here; the copy starts from the published version.
                    </p>
                )}
            </form>
        </Dialog>
    );
};
