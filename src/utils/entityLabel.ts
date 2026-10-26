/**
 * The name a person knows an entity by (#81, #177 link 2): the detail page heading, the breadcrumb
 * and the delete confirmation use it. The first non-empty text of the usual name fields, else
 * "#{id}".
 */
const NAME_FIELDS = ['displayName', 'name', 'title', 'username', 'label', 'key', 'code'] as const;

export function entityDisplayLabel(entity: unknown, entityId?: string | number | null): string {
    if (entity && typeof entity === 'object') {
        const record = entity as Record<string, unknown>;
        for (const field of NAME_FIELDS) {
            const value = record[field];
            if (typeof value === 'string' && value.trim()) return value.trim();
        }
        if (entityId == null && (typeof record.id === 'string' || typeof record.id === 'number')) {
            return `#${record.id}`;
        }
    }
    return entityId != null && String(entityId) !== '' ? `#${entityId}` : '';
}

/** "GateStructure" → "Gate Structure", for types without a metadata display name. */
export function entityTypeFallbackLabel(entityTypeName: string): string {
    return entityTypeName
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/[_-]/g, ' ')
        .replace(/^./, char => char.toUpperCase())
        .trim();
}

/** Labels of entity types from the metadata (display name), matched without regard to case. */
export function typeLabelFor(
    metadata: ReadonlyArray<{ entityName: string; displayName?: string | null }>
): (entityTypeName: string) => string {
    return (entityTypeName: string) => {
        const wanted = entityTypeName.toLowerCase();
        const meta = metadata.find(candidate => candidate.entityName.toLowerCase() === wanted);
        return meta?.displayName || meta?.entityName || entityTypeFallbackLabel(entityTypeName);
    };
}
