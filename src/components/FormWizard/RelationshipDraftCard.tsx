import React from 'react';
import { RelationshipDraft } from '../../hooks/useRelationshipDrafts';

interface RelationshipDraftCardProps {
    draft: RelationshipDraft;
    onContinue: (draft: RelationshipDraft) => void;
}

/**
 * Renders one in-progress/paused FormSubmissionProgress inline next to a relationship field's
 * real, already-saved entities - visually distinct (amber, "DRAFT" badge) so it's never mistaken
 * for live data, labeled with who started it, with a one-click way to resume it. Shared by
 * ListField (one-to-many "owned child collection" fields) and ManyToManyRelationshipEditor.
 */
export const RelationshipDraftCard: React.FC<RelationshipDraftCardProps> = ({ draft, onContinue }) => {
    const lastSaved = draft.updatedAt || draft.createdAt;
    const lastSavedLabel = lastSaved ? new Date(lastSaved).toLocaleString() : undefined;

    return (
        <div
            className="p-2 bg-warning-soft border border-warning-line rounded-md flex items-center justify-between"
            data-testid="relationship-draft-card"
        >
            <div className="flex items-center space-x-2 flex-1 min-w-0">
                <div className="flex-shrink-0 h-6 w-6 rounded-full bg-warning-muted flex items-center justify-center">
                    <span className="text-warning font-medium text-xs">?</span>
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-warning-strong truncate flex items-center gap-2">
                        <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-warning-line text-warning-strong">
                            Draft
                        </span>
                        <span>not yet saved</span>
                    </p>
                    <p className="text-xs text-warning">
                        Started by {draft.createdByUsername}
                        {lastSavedLabel ? ` · last saved ${lastSavedLabel}` : ''}
                    </p>
                </div>
            </div>
            <button
                type="button"
                onClick={() => onContinue(draft)}
                className="btn-secondary whitespace-nowrap ml-2"
            >
                Continue
            </button>
        </div>
    );
};
