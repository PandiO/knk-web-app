import React, { useState } from 'react';
import { XCircle } from 'lucide-react';
import { useFormSession } from '../../contexts/FormSessionContext';
import { FeedbackModal } from '../FeedbackModal';
import { CreatedEntitiesPrompt } from './CreatedEntitiesPrompt';
import { CreatedEntityRecord, toCreatedEntityRecords } from '../../utils/forms/createdEntities';
import { DeleteCreatedEntitiesDeps, deleteCreatedEntities } from '../../utils/forms/deleteCreatedEntities';
import { createdEntityDeleteDeps } from '../../utils/forms/createdEntityDeleteDeps';

/**
 * KNG-162: the explicit cancel of a root form (decision D2). Rendered by FormWizardPage in the
 * wizard's footer (#109), inside the same form session (FormSessionRoot), so it sees what the child
 * forms saved.
 *
 * - Nothing created and nothing changed (#109): leaves at once.
 * - Nothing created, unsaved changes: "Leave this form?" (a saved draft stays in Saved Progress).
 * - Something created: the keep/delete prompt; Keep is the default, Delete goes newest first
 *   through the normal delete endpoints and skips anything in use.
 *
 * Cancelling never deletes the draft: it stays in Saved Progress (the reversible default, L5-1).
 */
interface Props {
    /** Leaves the form (the page closes the wizard). */
    onLeave: () => void;
    /** While the form is being submitted (#177 link 1). */
    disabled?: boolean;
    /** Unsaved changes (#109); without them, and with nothing created, Cancel leaves without asking. */
    dirty?: boolean;
    deps?: DeleteCreatedEntitiesDeps;
}

export const FormCancelAction: React.FC<Props> = ({ onLeave, disabled = false, dirty = true, deps = createdEntityDeleteDeps }) => {
    const formSession = useFormSession();
    const [records, setRecords] = useState<CreatedEntityRecord[] | null>(null);

    const open = () => {
        const created = formSession ? toCreatedEntityRecords(formSession.createdEntities()) : [];
        if (created.length === 0 && !dirty) {
            onLeave();
            return;
        }
        setRecords(created);
    };
    const close = () => setRecords(null);
    const leave = () => {
        setRecords(null);
        onLeave();
    };

    return (
        <>
            <button
                type="button"
                onClick={open}
                disabled={disabled}
                className="w-full md:w-auto inline-flex items-center justify-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <XCircle className="h-4 w-4 mr-1" />
                Cancel form
            </button>

            <FeedbackModal
                open={records !== null && records.length === 0}
                title="Leave this form?"
                message="Changes you haven't saved are lost. A saved draft stays in Saved Progress."
                status="info"
                onClose={close}
                onContinue={leave}
                continueLabel="Leave form"
                cancelLabel="Stay"
            />

            <CreatedEntitiesPrompt
                open={records !== null && records.length > 0}
                title="Cancel this form?"
                intro="Created while filling out this form:"
                note="They are complete records and stay unless you delete them. Delete removes them newest first through their normal delete; anything used elsewhere is skipped. A saved draft stays in Saved Progress."
                records={records ?? []}
                keepLabel="Keep them"
                deleteLabel="Delete them"
                onKeep={leave}
                onDelete={() => deleteCreatedEntities(records ?? [], deps)}
                onDone={leave}
                onClose={close}
            />
        </>
    );
};
