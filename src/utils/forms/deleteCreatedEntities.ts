import type { EntityReferencesDto } from '../../types/dtos/forms/FormModels';
import { CreatedEntityRecord, deletionOrder, describeCreatedEntity } from './createdEntities';
import { failureReason } from '../apiRefusalReason';

/**
 * KNG-162 (decision D2): delete what a cancelled form's child forms created, newest first, through
 * each entity's normal delete endpoint. Anything still referenced elsewhere is skipped and reported,
 * never force-deleted: the API's reference check runs first, and a 409 from the delete itself (a
 * constraint the check didn't see) is reported the same way.
 */

export type CreatedEntityDeleteOutcome = 'deleted' | 'in-use' | 'already-gone' | 'failed';

export interface CreatedEntityDeleteResult {
    record: CreatedEntityRecord;
    outcome: CreatedEntityDeleteOutcome;
    /** Why it was skipped or failed, for the admin. */
    detail?: string;
}

export interface DeleteCreatedEntitiesDeps {
    checkReferences: (entityTypeName: string, id: number | string, ignore: string[]) => Promise<EntityReferencesDto>;
    /** The entity's normal delete call, or null when the web app has none for this type. */
    getDeleteFunction: (entityTypeName: string) => ((id: number | string) => Promise<unknown>) | null;
}

const statusOf = (error: unknown): number | undefined => {
    const status = (error as { status?: unknown } | null)?.status;
    return typeof status === 'number' ? status : undefined;
};

// The API's reason for a refusal; never a bare "HTTP 500: …", a timeout or a network error (KNG-169).
const messageOf = (error: unknown): string => failureReason(error) ?? 'the request did not go through';

const ignoreEntry = (record: CreatedEntityRecord) => `${record.entityTypeName}:${String(record.id)}`;

export const describeReferences = (references: EntityReferencesDto['references']): string =>
    references.map(ref => (ref.count > 1 ? `${ref.referencedBy} (${ref.count})` : ref.referencedBy)).join(', ');

export async function deleteCreatedEntities(
    records: CreatedEntityRecord[],
    deps: DeleteCreatedEntitiesDeps
): Promise<CreatedEntityDeleteResult[]> {
    const ordered = deletionOrder(records);
    const results: CreatedEntityDeleteResult[] = [];

    for (let index = 0; index < ordered.length; index++) {
        const record = ordered[index];
        // Links to entities still waiting in this run don't count (the Street and its new District).
        // Ones already handled do: a skipped Street still uses its District.
        const pending = ordered.slice(index + 1).map(ignoreEntry);

        const remove = deps.getDeleteFunction(record.entityTypeName);
        if (!remove) {
            results.push({ record, outcome: 'failed', detail: `the web app has no delete for ${record.entityTypeName}` });
            continue;
        }

        try {
            const references = await deps.checkReferences(record.entityTypeName, record.id, pending);
            if (references?.inUse) {
                results.push({ record, outcome: 'in-use', detail: `used by ${describeReferences(references.references)}` });
                continue;
            }
        } catch (error) {
            // Without the check nothing is deleted (404 = the API doesn't know this entity type).
            const reason = statusOf(error) === 404 ? `the API can't check ${record.entityTypeName}` : messageOf(error);
            results.push({ record, outcome: 'failed', detail: `couldn't check whether it is in use: ${reason}` });
            continue;
        }

        try {
            await remove(record.id);
            results.push({ record, outcome: 'deleted' });
        } catch (error) {
            const status = statusOf(error);
            if (status === 409) results.push({ record, outcome: 'in-use', detail: messageOf(error) });
            else if (status === 404) results.push({ record, outcome: 'already-gone' });
            else results.push({ record, outcome: 'failed', detail: messageOf(error) });
        }
    }

    return results;
}

const OUTCOME_TEXT: Record<CreatedEntityDeleteOutcome, string> = {
    deleted: 'deleted',
    'in-use': 'skipped: in use',
    'already-gone': 'already deleted',
    failed: 'not deleted'
};

/** "District 'Oostwijk': skipped: in use (used by Structure.DistrictId)". */
export const describeDeleteResult = (result: CreatedEntityDeleteResult): string =>
    `${describeCreatedEntity(result.record)}: ${OUTCOME_TEXT[result.outcome]}${result.detail ? ` (${result.detail})` : ''}`;

/** Records still in the database afterwards (skipped or failed), for the draft's provenance. */
export const remainingAfterDelete = (results: CreatedEntityDeleteResult[]): CreatedEntityRecord[] =>
    results
        .filter(result => result.outcome === 'in-use' || result.outcome === 'failed')
        .map(result => result.record)
        .sort((a, b) => a.sequence - b.sequence);
