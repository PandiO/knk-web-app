import { FieldMetadataDto } from '../domain/dto/metadata/MetadataModels';

/**
 * Helper to find foreign key field name for a navigation property using entity metadata.
 * 
 * @param navigationPropertyName - The navigation property name
 * @param entityMetadata - Entity metadata from backend
 * @returns The foreign key field name or null if not found
 */
export function findForeignKeyFieldName(
    navigationPropertyName: string,
    entityMetadata: FieldMetadataDto[]
): string | null {
    // Look for a field that:
    // 1. Ends with "Id"
    // 2. Has the same base name as the navigation property
    const expectedFkName = navigationPropertyName + 'Id';
    
    const fkField = entityMetadata.find(m => 
        m.fieldName.toLowerCase() === expectedFkName.toLowerCase()
    );
    
    return fkField?.fieldName || null;
}

/**
 * Helper to find navigation property name for a foreign key using entity metadata.
 * 
 * @param foreignKeyName - The foreign key field name
 * @param entityMetadata - Entity metadata from backend
 * @returns The navigation property name or null if not found
 */
export function findNavigationPropertyName(
    foreignKeyName: string,
    entityMetadata: FieldMetadataDto[]
): string | null {
    if (!foreignKeyName.endsWith('Id')) {
        return null;
    }
    
    const expectedNavName = foreignKeyName.slice(0, -2);
    
    const navField = entityMetadata.find(m => 
        m.fieldName.toLowerCase() === expectedNavName.toLowerCase() &&
        m.isRelatedEntity
    );
    
    return navField?.fieldName || null;
}
