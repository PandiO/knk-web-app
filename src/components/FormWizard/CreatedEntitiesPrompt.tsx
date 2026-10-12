import React, { useEffect, useState } from 'react';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import { CreatedEntityRecord, describeCreatedEntity } from '../../utils/forms/createdEntities';
import { CreatedEntityDeleteResult, describeDeleteResult } from '../../utils/forms/deleteCreatedEntities';
import { failureReason } from '../../utils/apiRefusalReason';

/**
 * KNG-162 (decision D2): "Created while filling out this form: ..." with Keep (the default) or
 * Delete. Used by the wizard's Cancel and by deleting a draft from Saved Progress. Styled like
 * FeedbackModal; after a Delete it shows what happened to each entity before closing.
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

    useEffect(() => {
        if (open) {
            setPhase('choose');
            setResults([]);
            setError(null);
        }
    }, [open]);

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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4" onClick={dismiss}>
            <div
                role="dialog"
                aria-label={title}
                className="w-full max-w-lg rounded-lg shadow-lg border border-yellow-100 bg-yellow-50 relative"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-start justify-between px-5 py-4">
                    <div className="flex items-start space-x-3">
                        <AlertTriangle className="h-6 w-6 text-yellow-600 flex-shrink-0" />
                        <div>
                            <h3 className="text-lg font-semibold text-yellow-800">{title}</h3>
                            {phase === 'report' ? (
                                <>
                                    <p className="mt-1 text-sm text-gray-700">
                                        Deleted {deletedCount} of {results.length}.
                                    </p>
                                    <ul className="mt-2 list-disc pl-5 text-sm text-gray-700" aria-label="Delete results">
                                        {results.map(result => (
                                            <li key={`${result.record.entityTypeName}:${result.record.id}`}>{describeDeleteResult(result)}</li>
                                        ))}
                                    </ul>
                                </>
                            ) : (
                                <>
                                    <p className="mt-1 text-sm text-gray-700">{intro}</p>
                                    <ul className="mt-2 list-disc pl-5 text-sm text-gray-700" aria-label="Created entities">
                                        {records.map(record => (
                                            <li key={`${record.entityTypeName}:${record.id}`}>{describeCreatedEntity(record)}</li>
                                        ))}
                                    </ul>
                                    {note && <p className="mt-2 text-xs text-gray-500">{note}</p>}
                                </>
                            )}
                            {error && <p className="mt-2 text-sm text-red-700" role="alert">{error}</p>}
                        </div>
                    </div>
                    {phase === 'choose' && (
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close dialog">
                            <X className="h-5 w-5" />
                        </button>
                    )}
                </div>
                <div className="px-5 pb-4 flex justify-end space-x-3">
                    {phase === 'report' ? (
                        <button
                            onClick={() => onDone(results)}
                            className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-dark rounded-md"
                        >
                            Done
                        </button>
                    ) : (
                        <>
                            <button
                                onClick={remove}
                                disabled={phase === 'working'}
                                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md disabled:opacity-50"
                            >
                                {deleteLabel}
                            </button>
                            <button
                                onClick={keep}
                                disabled={phase === 'working'}
                                autoFocus
                                className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-dark rounded-md disabled:opacity-50 inline-flex items-center"
                            >
                                {phase === 'working' && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                                {keepLabel}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
