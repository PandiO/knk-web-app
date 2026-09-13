import { useCallback, useEffect, useState } from 'react';
import { formSubmissionClient } from '../apiClients/formSubmissionClient';
import { formConfigClient } from '../apiClients/formConfigClient';
import { FormSubmissionStatus } from '../utils/enums';
import { findParentLinkField } from '../utils/forms/findParentLinkField';

export interface RelationshipDraft {
    progressId: string;
    createdByUsername: string;
    updatedAt?: string;
    createdAt?: string;
}

/**
 * Finds every admin's in-progress/paused draft submission of childEntityTypeName that's "for"
 * this specific parent - matched via whatever the draft already saved for the field on the
 * child's own form that links back to parentEntityTypeName (e.g. GateDoor's "GateStructureId",
 * discovered the same way ChildFormModal's parent-identity prefill does, via
 * findParentLinkField). Used to show drafts inline alongside already-saved entities in a
 * parent's relationship field, so an admin can see (and resume) work a colleague already
 * started instead of duplicating it.
 *
 * Returns nothing (skips fetching) until all three inputs are available - notably
 * parentEntityId, which is only known once the parent itself is saved.
 */
export function useRelationshipDrafts(
    childEntityTypeName: string | null | undefined,
    parentEntityTypeName: string | null | undefined,
    parentEntityId: string | number | null | undefined
): { drafts: RelationshipDraft[]; loading: boolean; refresh: () => void } {
    const [drafts, setDrafts] = useState<RelationshipDraft[]>([]);
    const [loading, setLoading] = useState(false);
    const [refreshCounter, setRefreshCounter] = useState(0);

    const refresh = useCallback(() => setRefreshCounter(c => c + 1), []);

    useEffect(() => {
        if (!childEntityTypeName || !parentEntityTypeName || parentEntityId == null || parentEntityId === '') {
            setDrafts([]);
            return;
        }

        let cancelled = false;

        const load = async () => {
            setLoading(true);
            try {
                const childConfigResult = await formConfigClient.getByEntityTypeName(childEntityTypeName, true);
                const childConfig = Array.isArray(childConfigResult) ? childConfigResult[0] : childConfigResult;
                const linkField = findParentLinkField(childConfig, parentEntityTypeName);
                if (!linkField) {
                    if (!cancelled) setDrafts([]);
                    return;
                }

                const summaries = await formSubmissionClient.getByEntityTypeNameFiltered(
                    childEntityTypeName,
                    linkField.fieldName,
                    String(parentEntityId)
                );
                if (cancelled) return;

                const draftStatuses: FormSubmissionStatus[] = [FormSubmissionStatus.InProgress, FormSubmissionStatus.Paused];
                setDrafts(
                    summaries
                        .filter(s => draftStatuses.includes(s.status))
                        .filter((s): s is typeof s & { id: string } => !!s.id)
                        .map(s => ({
                            progressId: s.id,
                            createdByUsername: s.createdByUsername || 'Unknown user',
                            updatedAt: s.updatedAt,
                            createdAt: s.createdAt
                        }))
                );
            } catch (err) {
                console.error('Failed to load relationship drafts:', err);
                if (!cancelled) setDrafts([]);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        void load();

        return () => {
            cancelled = true;
        };
    }, [childEntityTypeName, parentEntityTypeName, parentEntityId, refreshCounter]);

    return { drafts, loading, refresh };
}
