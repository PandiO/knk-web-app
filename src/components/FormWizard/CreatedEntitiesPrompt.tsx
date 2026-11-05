import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Dialog } from '../Dialog';
import { CreatedEntityRecord, describeCreatedEntity } from '../../utils/forms/createdEntities';
import { CreatedEntityDeleteResult, describeDeleteResult } from '../../utils/forms/deleteCreatedEntities';
import { failureReason } from '../../utils/apiRefusalReason';

/**
 * KNG-162 (decision D2): "Created while filling out this form: ..." with Keep (the default) or
 * Delete. Used by the wizard's Cancel and by deleting a draft from Saved Progress. On the shared
 * Dialog (#33); after a Delete it shows what happened to each entity before closing.
 */
interface Props {
    open: boolean;
    title: string;
    intro: string;
    note?: string;
    records: CreatedEntityRecord[];
    keepLabel: string;
    deleteLabel: string;
    /** Keep: the caller finishes (leaves the form, deletes the draft). */
    onKeep: () => void | Promise<void>;
    /** Delete: the caller deletes and returns what happened, shown before onDone. */
    onDelete: () => Promise<CreatedEntityDeleteResult[]>;
    onDone: (results: CreatedEntityDeleteResult[]) => void;
    /** Dismiss without choosing (stay in the form / keep the draft). */
    onClose: () => void;
}

type Phase = 'choose' | 'working' | 'report';

export const CreatedEntitiesPrompt: React.FC<Props> = ({
    open,
    title,
    intro,
    note,
    records,
    keepLabel,
    deleteLabel,
    onKeep,
    onDelete,
    onDone,
    onClose
}) => {
    const [phase, setPhase] = useState<Phase>('choose');
    const [results, setResults] = useState<CreatedEntityDeleteResult[]>([]);
    const [error, setError] = useState<string | null>(null);
    const keepRef = useRef<HTMLButtonElement>(null);
    const doneRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (open) {
            setPhase('choose');
            setResults([]);
            setError(null);
        }
    }, [open]);

    // The report replaces the buttons: focus moves to Done.
    useEffect(() => {
        if (phase === 'report') doneRef.current?.focus();
    }, [phase]);

    if (!open) return null;

    const dismiss = () => {
        if (phase === 'choose') onClose();
    };

    const keep = async () => {
        setPhase('working');
        setError(null);
        try {
            await onKeep();
        } catch (err) {
            setError(failureReason(err) ?? 'Something went wrong.');
            setPhase('choose');
        }
    };

    const remove = async () => {
        setPhase('working');
        setError(null);
        try {
            setResults(await onDelete());
            setPhase('report');
        } catch (err) {
            setError(failureReason(err) ?? 'Something went wrong.');
            setPhase('choose');
        }
    };

    const deletedCount = results.filter(result => result.outcome === 'deleted').length;

    return (
        <Dialog
            open
            onClose={dismiss}
            title={title}
            icon={<AlertTriangle className="h-6 w-6 text-warning" />}
            role="alertdialog"
            size="lg"
            closeOnBackdrop
            dismissible={phase === 'choose'}
            hideCloseButton={phase !== 'choose'}
            initialFocusRef={phase === 'report' ? doneRef : keepRef}
            panelClassName="border-t-4 border-t-warning"
            headerClassName="pb-0"
            bodyClassName="px-6 pb-2 pl-[3.75rem]"
            footerClassName="pb-4"
            footer={phase === 'report' ? (
                <button ref={doneRef} type="button" onClick={() => onDone(results)} className="btn-primary">
                    Done
                </button>
            ) : (
                <>
                    <button type="button" onClick={remove} disabled={phase === 'working'} className="btn-danger">
                        {deleteLabel}
                    </button>
                    <button ref={keepRef} type="button" onClick={keep} disabled={phase === 'working'} className="btn-primary">
                        {phase === 'working' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                        {keepLabel}
                    </button>
                </>
            )}
        >
            {phase === 'report' ? (
                <>
                    <p className="text-sm text-fg">
                        Deleted {deletedCount} of {results.length}.
                    </p>
                    <ul className="mt-2 list-disc pl-5 text-sm text-fg" aria-label="Delete results">
                        {results.map(result => (
                            <li key={`${result.record.entityTypeName}:${result.record.id}`}>{describeDeleteResult(result)}</li>
                        ))}
                    </ul>
                </>
            ) : (
                <>
                    <p className="text-sm text-fg">{intro}</p>
                    <ul className="mt-2 list-disc pl-5 text-sm text-fg" aria-label="Created entities">
                        {records.map(record => (
                            <li key={`${record.entityTypeName}:${record.id}`}>{describeCreatedEntity(record)}</li>
                        ))}
                    </ul>
                    {note && <p className="mt-2 text-xs text-muted">{note}</p>}
                </>
            )}
            {error && <p className="mt-2 text-sm text-danger-strong" role="alert">{error}</p>}
        </Dialog>
    );
};
