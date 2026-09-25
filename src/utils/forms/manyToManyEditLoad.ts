import { EntityMetadataDto, FieldMetadataDto } from '../../types/dtos/metadata/MetadataModels';

/**
 * Edit-mode support for many-to-many steps (siege Phase 3, verification item 3).
 *
 * A saved entity's join rows come back as plain read-DTO rows in camelCase, e.g. a siege scenario's
 * gates: { siegeScenarioId, gateStructureId, gateStructureName, initialOwnerTeamId, initialState,
 * damageable }. The relationship editor and the join-entry modal expect the shape a freshly added
 * entry has: metadata-cased join fields ("GateStructureId", "InitialState", ...) plus relatedEntityId
 * and relatedEntity for the card. Before this, every saved row showed "Missing Entity", its card had
 * no summary, and "Edit Join Entry" started from the form defaults.
 */

const isIdField = (field: FieldMetadataDto) => field.fieldName.toLowerCase().endsWith('id');

/**
 * The join entity's "other side" navigation field and its FK - the first related field that isn't
 * the parent (the same rule handleJoinEntryComplete/normalizeFormSubmission use). With a join entity
 * carrying more than one related field (SiegeScenarioGate: GateStructure + InitialOwnerTeam) this
 * relies on metadata's declaration order, where the selected entity comes first.
 */
export const resolveJoinRelatedFields = (
    joinMetadata: EntityMetadataDto,
    parentEntityTypeName: string
): { navField?: FieldMetadataDto; idField?: FieldMetadataDto } => {
    const navField = joinMetadata.fields.find(f =>
        f.isRelatedEntity && f.relatedEntityType && f.relatedEntityType !== parentEntityTypeName && !isIdField(f));
    const idField = navField
        ? joinMetadata.fields.find(f => f.isRelatedEntity && f.relatedEntityType === navField.relatedEntityType && isIdField(f))
        : undefined;
    return { navField, idField };
};

const findKey = (row: Record<string, unknown>, name: string): string | undefined =>
    Object.keys(row).find(key => key.toLowerCase() === name.toLowerCase());

export const hydrateJoinRowsForEdit = (
    rows: Array<Record<string, unknown>>,
    joinMetadata: EntityMetadataDto,
    parentEntityTypeName: string
): Array<Record<string, unknown>> => {
    const { navField, idField } = resolveJoinRelatedFields(joinMetadata, parentEntityTypeName);

    return rows.map(row => {
        if (!row || typeof row !== 'object') return row;

        // Re-key to the metadata's field names so the card summary and the join-entry form (both
        // keyed by metadata names) find the values, and a later merge can't leave the same field
        // twice in different casings.
        const hydrated: Record<string, unknown> = {};
        Object.entries(row).forEach(([key, value]) => {
            const metaField = joinMetadata.fields.find(f => f.fieldName.toLowerCase() === key.toLowerCase());
            hydrated[metaField ? metaField.fieldName : key] = value;
        });

        if (!navField || !idField) return hydrated;

        const relatedId = hydrated[idField.fieldName];
        if (hydrated.relatedEntityId === undefined && relatedId !== undefined && relatedId !== null) {
            hydrated.relatedEntityId = relatedId;
        }

        if (!hydrated.relatedEntity && relatedId !== undefined && relatedId !== null) {
            const navValue = hydrated[navField.fieldName];
            if (navValue && typeof navValue === 'object') {
                hydrated.relatedEntity = navValue;
            } else {
                // Read DTOs usually carry a "<navigation>Name" column (gateStructureName, districtName).
                const nameKey = findKey(row, `${navField.fieldName}Name`);
                const name = nameKey ? row[nameKey] : undefined;
                hydrated.relatedEntity = {
                    id: relatedId,
                    name: typeof name === 'string' && name.length > 0 ? name : `${navField.relatedEntityType} #${relatedId}`
                };
            }
        }

        return hydrated;
    });
};

/**
 * The saved join values of a relationship entry, keyed by the join entity's field names - the
 * initial values for "Edit Join Entry" on a saved row. Skips the parent side, the related side
 * (seeded separately), bookkeeping keys, and navigation objects.
 */
export const joinFieldSeedValues = (
    relationship: Record<string, unknown> | undefined,
    joinMetadata: EntityMetadataDto,
    parentEntityTypeName: string
): Record<string, unknown> => {
    if (!relationship) return {};
    const { navField, idField } = resolveJoinRelatedFields(joinMetadata, parentEntityTypeName);
    const seeds: Record<string, unknown> = {};

    joinMetadata.fields.forEach(field => {
        if (field.isRelatedEntity && field.relatedEntityType === parentEntityTypeName) return;
        if (field === navField || field === idField) return;
        if (field.isRelatedEntity && !isIdField(field)) return;

        const key = findKey(relationship, field.fieldName);
        if (key === undefined) return;
        const value = relationship[key];
        if (value !== undefined && value !== null && value !== '') {
            seeds[field.fieldName] = value;
        }
    });

    return seeds;
};
