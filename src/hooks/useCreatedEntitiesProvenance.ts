import { useCallback } from 'react';
import type { FormSessionValue } from '../contexts/FormSessionContext';
import type { FormSubmissionProgressDto } from '../types/dtos/forms/FormModels';
import { parseCreatedEntitiesJson, serializeCreatedEntities, toCreatedEntityRecords } from '../utils/forms/createdEntities';

/**
 * KNG-162 (decision D3): the root wizard keeps what its child forms created in its own progress
 * (`createdEntitiesJson`) and, when that draft is resumed, seeds the session registry from it so the
 * pickers pin those entities again and the cancel prompt still knows about them.
 *
 * Only the root form of a session does this (the first wizard in it, not opened as a child form);
 * child wizards leave the field out, which the API reads as "keep what is recorded".
 */
export function isRootFormOfSession(formSession: FormSessionValue | null, parentProgressId?: string): boolean {
    return !!formSession && formSession.formPath.length === 1 && !parentProgressId;
}

export function useCreatedEntitiesProvenance(formSession: FormSessionValue | null, parentProgressId?: string) {
    const isRoot = isRootFormOfSession(formSession, parentProgressId);

    /** The value to send with a progress save: the registry's created entities, or undefined (not root). */
    const createdEntitiesJson = useCallback((): string | undefined => {
        if (!isRoot || !formSession) return undefined;
        return serializeCreatedEntities(toCreatedEntityRecords(formSession.createdEntities()));
    }, [isRoot, formSession]);

    /** Seeds the registry from a loaded root progress. */
    const seedFromProgress = useCallback((progress: Pick<FormSubmissionProgressDto, 'createdEntitiesJson'> | null | undefined) => {
        if (!isRoot || !formSession || !progress) return;
        const recorded = parseCreatedEntitiesJson(progress.createdEntitiesJson);
        // seed() skips entities the registry already holds.
        if (recorded.length > 0) formSession.seed(recorded);
    }, [isRoot, formSession]);

    return { isRoot, createdEntitiesJson, seedFromProgress };
}
