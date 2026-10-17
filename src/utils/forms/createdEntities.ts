import type { SessionEntity } from '../../contexts/FormSessionContext';

/**
 * KNG-162 (decisions D2/D3, knk-workspace docs/specs/form-configurations/FORM_WIZARD_SESSION_CONCEPTS.md §4):
 * what a root form's child forms saved on their own, in the shape kept in the root progress's
 * `createdEntitiesJson`. Read by the cancel / delete-draft prompt and used to re-seed the form
 * session registry when the draft is resumed.
 */
export interface CreatedEntityRecord {
    entityTypeName: string;
    id: number | string;
    /** A few label fields (name, displayName, ...) for the prompt and pinned picker rows; may be stale (L2-1). */
    display: Record<string, unknown>;
    origin: { formPath: string[]; fieldName: string };
    /** Creation order (1 = first). Deleting goes from the highest down. */
    sequence: number;
}

const LABEL_FIELDS = ['name', 'displayName', 'title', 'label', 'key', 'resolvedName'] as const;

const hasId = (id: unknown): id is number | string =>
    (typeof id === 'number' && Number.isFinite(id)) || (typeof id === 'string' && id.trim() !== '');

export const createdEntityKey = (record: Pick<CreatedEntityRecord, 'entityTypeName' | 'id'>): string =>
    `${record.entityTypeName.toLowerCase()}:${String(record.id)}`;

/** Only the label fields: the record is a pointer to a database row, not a copy of it. */
export function pickLabelFields(source: Record<string, unknown> | undefined): Record<string, unknown> {
    const display: Record<string, unknown> = {};
    if (!source) return display;
    for (const field of LABEL_FIELDS) {
        const value = source[field];
        if (typeof value === 'string' && value.trim() !== '') display[field] = value;
        else if (typeof value === 'number') display[field] = value;
    }
    return display;
}

export function createdEntityLabel(record: Pick<CreatedEntityRecord, 'display' | 'id'>): string {
    for (const field of LABEL_FIELDS) {
        const value = record.display?.[field];
        if ((typeof value === 'string' && value.trim() !== '') || typeof value === 'number') return String(value);
    }
    return `#${String(record.id)}`;
}

/** "District 'Oostwijk'". */
export const describeCreatedEntity = (record: CreatedEntityRecord): string =>
    `${record.entityTypeName} '${createdEntityLabel(record)}'`;

/** Registry entries (FormSessionContext createdEntities()) to records, oldest first. */
export function toCreatedEntityRecords(entities: SessionEntity[]): CreatedEntityRecord[] {
    return entities
        .filter(entry => entry.status === 'created' && !entry.embedded && hasId(entry.id))
        .sort((a, b) => a.sequence - b.sequence)
        .map(entry => ({
            entityTypeName: entry.entityTypeName,
            id: entry.id as number | string,
            display: pickLabelFields(entry.display),
            origin: { formPath: [...entry.origin.formPath], fieldName: entry.origin.fieldName },
            sequence: entry.sequence
        }));
}

export const serializeCreatedEntities = (records: CreatedEntityRecord[]): string => JSON.stringify(records);

/** Tolerant: anything that isn't a usable record is dropped; a broken string gives []. Sorted oldest first. */
export function parseCreatedEntitiesJson(json: string | null | undefined): CreatedEntityRecord[] {
    if (!json || !json.trim()) return [];
    let parsed: unknown;
    try {
        parsed = JSON.parse(json);
    } catch {
        return [];
    }
    if (!Array.isArray(parsed)) return [];
    const records: CreatedEntityRecord[] = [];
    parsed.forEach((item, index) => {
        if (!item || typeof item !== 'object') return;
        const raw = item as Record<string, unknown>;
        const entityTypeName = typeof raw.entityTypeName === 'string' ? raw.entityTypeName.trim() : '';
        if (!entityTypeName || !hasId(raw.id)) return;
        const origin = (raw.origin && typeof raw.origin === 'object' ? raw.origin : {}) as Record<string, unknown>;
        records.push({
            entityTypeName,
            id: raw.id,
            display: pickLabelFields(raw.display as Record<string, unknown> | undefined),
            origin: {
                formPath: Array.isArray(origin.formPath) ? origin.formPath.filter((p): p is string => typeof p === 'string') : [],
                fieldName: typeof origin.fieldName === 'string' ? origin.fieldName : ''
            },
            sequence: typeof raw.sequence === 'number' && Number.isFinite(raw.sequence) ? raw.sequence : index + 1
        });
    });
    return records.sort((a, b) => a.sequence - b.sequence);
}

/**
 * Delete order: newest first. An entity saved later can reference one saved earlier (the Street
 * references the District created inside it), never the other way round, so this removes the
 * reference before its target. (The issue says "deepest-first"; the District is the deeper form but
 * the Street points at it, so it has to go second.)
 */
export const deletionOrder = (records: CreatedEntityRecord[]): CreatedEntityRecord[] =>
    [...records].sort((a, b) => b.sequence - a.sequence);
