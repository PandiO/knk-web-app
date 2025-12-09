import { FormConfigurationDto, FormFieldDto } from '../domain/dto/forms/FormModels';
import { FieldType } from '../enums';
import { FieldMetadataDto } from '../domain/dto/metadata/MetadataModels';

/**
 * Arguments for normalizing form submission data.
 */
export interface NormalizeFormSubmissionArgs {
    /** The entity type name (e.g., 'Category', 'Shop', 'Item') */
    entityTypeName: string;
    /** The form configuration that defines the structure */
    formConfiguration: FormConfigurationDto;
    /** The raw form values collected from the FormWizard */
    rawFormValue: Record<string, any>;
    /** Optional entity metadata from the backend (for relationship info) */
    entityMetadata?: FieldMetadataDto[];
}

/**
 * Maps a field name to its corresponding foreign key field name.
 * Convention: navigation property "parentCategory" -> foreign key "parentCategoryId"
 * 
 * @param navigationPropertyName - The navigation property name (e.g., "parentCategory")
 * @returns The foreign key field name (e.g., "parentCategoryId")
 */
function toForeignKeyFieldName(navigationPropertyName: string): string {
    // Handle both camelCase and PascalCase
    const suffix = 'Id';
    
    // If already ends with Id, return as-is
    if (navigationPropertyName.endsWith(suffix)) {
        return navigationPropertyName;
    }
    
    // Preserve original casing for first character
    return navigationPropertyName + suffix;
}

/**
 * Checks if a field represents a foreign key relationship based on metadata.
 * 
 * @param field - The form field configuration
 * @param entityMetadata - Optional entity metadata from backend
 * @returns True if this field is a foreign relationship
 */
function isRelationshipField(field: FormFieldDto, entityMetadata?: FieldMetadataDto[]): boolean {
    // Check FormFieldDto properties
    if (field.fieldType === FieldType.Object) {
        return true;
    }
    
    if (field.fieldType === FieldType.List && field.objectType) {
        return true;
    }
    
    // Check backend metadata if available
    if (entityMetadata) {
        const meta = entityMetadata.find(m => 
            m.fieldName.toLowerCase() === field.fieldName.toLowerCase()
        );
        if (meta?.isRelatedEntity) {
            return true;
        }
    }
    
    return false;
}

/**
 * Extracts the ID from a nested object or returns the value as-is if it's already an ID.
 * 
 * @param value - The value to extract ID from
 * @returns The extracted ID or the original value, or null if value is an object without an id
 */
function extractId(value: any): any {
    if (value === null || value === undefined) {
        return value;
    }
    
    // Check if it's a plain object (not array, Date, etc.)
    const isPlainObject = typeof value === 'object' && 
                          value !== null && 
                          value.constructor === Object && 
                          !Array.isArray(value);
    
    if (isPlainObject) {
        // It's an object - try to extract the id property
        if ('id' in value && value.id !== undefined && value.id !== null) {
            return value.id;
        }
        // Object exists but has no valid id - return null since we can't normalize it
        return null;
    }
    
    // If it's already a primitive (string/number), assume it's the ID
    return value;
}

/** Extract id / namespaceKey for hybrid material/block picker values */
function extractHybridIdentifiers(value: any): { id?: any; namespaceKey?: string } {
    if (value === null || value === undefined) return {};

    if (typeof value === 'number' || typeof value === 'string') {
        return { id: value };
    }

    if (typeof value === 'object') {
        const id = (value as any).id ?? (value as any).Id;
        const namespaceKey = (value as any).namespaceKey ?? (value as any).NamespaceKey;
        return { id, namespaceKey };
    }

    return {};
}

/**
 * Normalizes form submission data by converting nested objects to foreign key IDs.
 * 
 * This function handles:
 * - Single object relationships: { parentCategory: {...} } -> { parentCategoryId: "123" }
 * - Collection relationships: { items: [{...}, {...}] } -> { itemIds: ["1", "2"] }
 * - Direct ID fields: { parentCategoryId: "123" } -> { parentCategoryId: "123" } (unchanged)
 * - Scalar fields: { name: "Test" } -> { name: "Test" } (unchanged)
 * - Hybrid material/block picker: populates Id (or Ids) plus NamespaceKey fallback when id missing
 * 
 * @param args - The normalization arguments
 * @returns The normalized payload ready for API submission
 */
export function normalizeFormSubmission(args: NormalizeFormSubmissionArgs): Record<string, any> {
    const { formConfiguration, rawFormValue, entityMetadata } = args;
    
    const normalized: Record<string, any> = {};
    
    // Collect all fields from all steps
    const allFields: FormFieldDto[] = [];
    formConfiguration.steps.forEach(step => {
        allFields.push(...step.fields);
    });
    
    // Process each field in the configuration
    allFields.forEach(field => {
        const fieldName = field.fieldName;
        const rawValue = rawFormValue[fieldName];
        
        // Skip if no value provided
        if (rawValue === undefined) {
            return;
        }
        
        // Special handling for hybrid Minecraft material/block picker
        if (field.fieldType === FieldType.HybridMinecraftMaterialRefPicker) {
            handleHybridMaterialField(field, fieldName, rawValue, normalized);
            return;
        }

        const isRelationship = isRelationshipField(field, entityMetadata);
        
        if (!isRelationship) {
            // Simple scalar field - copy as-is
            normalized[fieldName] = rawValue;
            return;
        }
        
        // Handle relationship fields
        if (field.fieldType === FieldType.Object) {
            // Single object relationship
            handleSingleObjectRelationship(field, fieldName, rawValue, normalized);
        } else if (field.fieldType === FieldType.List && field.objectType) {
            // Collection relationship
            handleCollectionRelationship(field, fieldName, rawValue, normalized);
        } else {
            // Fallback: copy as-is
            normalized[fieldName] = rawValue;
        }
    });
    
    // Also copy any properties in rawFormValue that weren't in the field configuration
    // (e.g., id for updates, or other backend-generated fields)
    // IMPORTANT: Extract IDs from any objects to handle foreign key fields
    Object.keys(rawFormValue).forEach(key => {
        if (!(key in normalized)) {
            const value = rawFormValue[key];
            
            // Check if this looks like a foreign key field (ends with 'Id')
            if (key.endsWith('Id') && typeof value === 'object' && value !== null) {
                // Extract the ID from the object
                normalized[key] = extractId(value);
            } else {
                // Copy as-is for non-relationship fields
                normalized[key] = value;
            }
        }
    });
    
    return normalized;
}

/**
 * Handles normalization of a single object relationship field.
 * 
 * @param fieldName - The field name in rawFormValue
 * @param rawValue - The raw value from the form
 * @param normalized - The normalized payload being built
 */
function handleSingleObjectRelationship(
    _field: FormFieldDto,
    fieldName: string,
    rawValue: any,
    normalized: Record<string, any>
): void {
    // Determine if this field is already a foreign key field (ends with "Id")
    const isForeignKeyField = fieldName.endsWith('Id');
    const extractedId = extractId(rawValue);
    
    if (isForeignKeyField) {
        // Field is already the foreign key (e.g., parentCategoryId)
        // Only add to normalized if we successfully extracted an ID
        if (extractedId !== null && extractedId !== undefined) {
            normalized[fieldName] = extractedId;
        }
    } else {
        // Field is a navigation property (e.g., parentCategory)
        // Only convert to foreign key format if we can extract a valid ID
        if (extractedId !== null && extractedId !== undefined) {
            const foreignKeyFieldName = toForeignKeyFieldName(fieldName);
            normalized[foreignKeyFieldName] = extractedId;
        }
        // If no valid ID could be extracted, skip this field
        // (don't include the navigation property in the payload)
    }
}

/**
 * Handles normalization of a collection relationship field.
 * 
 * @param fieldName - The field name in rawFormValue
 * @param rawValue - The raw value from the form (array)
 * @param normalized - The normalized payload being built
 */
function handleCollectionRelationship(
    _field: FormFieldDto,
    fieldName: string,
    rawValue: any,
    normalized: Record<string, any>
): void {
    if (!Array.isArray(rawValue)) {
        // If not an array, copy as-is or skip
        normalized[fieldName] = rawValue;
        return;
    }
    
    // Determine the target field name for the array of IDs
    // Convention: "items" -> "itemIds", "categories" -> "categoryIds"
    let targetFieldName: string;
    
    if (fieldName.endsWith('Ids')) {
        // Already in the correct format
        targetFieldName = fieldName;
    } else if (fieldName.endsWith('s')) {
        // Plural navigation property -> append "Ids" but remove plural "s" first
        // "items" -> "itemIds", "categories" -> "categoryIds"
        targetFieldName = fieldName.slice(0, -1) + 'Ids';
    } else {
        // Singular or unknown format -> just append "Ids"
        targetFieldName = fieldName + 'Ids';
    }
    
    // Extract IDs from each object in the array
    const ids = rawValue.map(item => extractId(item)).filter(id => id !== null && id !== undefined);
    
    normalized[targetFieldName] = ids;
    
    // DO NOT include the navigation property array itself
}

/**
 * Handles normalization for HybridMinecraftMaterialRefPicker fields.
 * Supports single or multi-select, and falls back to namespaceKey when id is missing.
 * 
 * For single selection: Outputs both `{fieldName}Id` and `{fieldName}NamespaceKey`
 * For multi selection: Outputs both `{fieldName}Ids` and `{fieldName}NamespaceKeys`
 * 
 * This allows the backend to create new MinecraftMaterialRef/MinecraftBlockRef entities
 * when only namespaceKey is provided (unpersisted catalog items).
 */
function handleHybridMaterialField(
    _field: FormFieldDto,
    fieldName: string,
    rawValue: any,
    normalized: Record<string, any>
): void {
    const isArray = Array.isArray(rawValue);

    if (isArray) {
        // Multi-select case
        const items = rawValue as any[];
        const ids: any[] = [];
        const namespaceKeys: string[] = [];

        items.forEach(item => {
            const { id, namespaceKey } = extractHybridIdentifiers(item);
            if (id !== null && id !== undefined) ids.push(id);
            if (namespaceKey) namespaceKeys.push(namespaceKey);
        });

        // Determine target field names for IDs array
        const targetIdsField = fieldName.endsWith('Ids')
            ? fieldName
            : fieldName.endsWith('s')
                ? fieldName.slice(0, -1) + 'Ids'
                : fieldName + 'Ids';

        // Determine target field name for NamespaceKeys array
        const targetNamespaceField = targetIdsField.endsWith('Ids')
            ? targetIdsField.slice(0, -3) + 'NamespaceKeys'
            : targetIdsField + 'NamespaceKeys';

        if (ids.length > 0) {
            normalized[targetIdsField] = ids;
        }
        if (namespaceKeys.length > 0) {
            normalized[targetNamespaceField] = namespaceKeys;
        }
        return;
    }

    // Single-select case
    const { id, namespaceKey } = extractHybridIdentifiers(rawValue);

    // Determine target field name for ID
    const targetIdField = fieldName.endsWith('Id')
        ? fieldName
        : toForeignKeyFieldName(fieldName);

    // Determine target field name for NamespaceKey
    const targetNamespaceField = targetIdField.endsWith('Id')
        ? targetIdField.slice(0, -2) + 'NamespaceKey'
        : targetIdField + 'NamespaceKey';

    if (id !== null && id !== undefined) {
        normalized[targetIdField] = id;
    }

    if (namespaceKey) {
        normalized[targetNamespaceField] = namespaceKey;
    }
}

/**
 * Optional: Validates that required fields are present in the normalized payload.
 * 
 * @param normalized - The normalized payload
 * @param entityMetadata - Entity metadata with required field info
 * @param entityTypeName - The entity type name for error messages
 * @throws Error if required fields are missing
 */
export function validateRequiredFields(
    normalized: Record<string, any>,
    entityMetadata: FieldMetadataDto[],
    entityTypeName: string
): void {
    const missingFields: string[] = [];
    
    entityMetadata.forEach(meta => {
        if (!meta.isNullable) {
            const value = normalized[meta.fieldName];
            if (value === null || value === undefined || value === '') {
                missingFields.push(meta.fieldName);
            }
        }
    });
    
    if (missingFields.length > 0) {
        throw new Error(
            `Missing required fields for ${entityTypeName}: ${missingFields.join(', ')}`
        );
    }
}
