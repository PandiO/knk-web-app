/**
 * Normalizes field names to lowercase for case-insensitive comparison
 */
export const normalizeFieldName = (fieldName: string): string => {
    return fieldName.toLowerCase();
};

/**
 * Finds a value in an object using case-insensitive field name matching
 * Useful when backend returns lowerCamelCase but frontend uses UpperCamelCase
 */
export const findValueByFieldName = (obj: Record<string, any>, fieldName: string): any => {
    // Try exact match first (most performant)
    if (Object.prototype.hasOwnProperty.call(obj, fieldName)) {
        return obj[fieldName];
    }

    // Try case-insensitive match
    const normalizedFieldName = normalizeFieldName(fieldName);
    const matchingKey = Object.keys(obj).find(
        key => normalizeFieldName(key) === normalizedFieldName
    );

    return matchingKey !== undefined ? obj[matchingKey] : undefined;
};

/**
 * Maps entity data to form field data using case-insensitive matching
 * @param entityData - The entity data from the API (lowerCamelCase)
 * @param fieldNames - Array of field names from form configuration (UpperCamelCase)
 * @returns Mapped object with form field names as keys
 */
export const mapEntityDataToFormFields = (
    entityData: Record<string, any>,
    fieldNames: string[]
): Record<string, any> => {
    const mapped: Record<string, any> = {};
    
    fieldNames.forEach(fieldName => {
        const value = findValueByFieldName(entityData, fieldName);
        mapped[fieldName] = value !== undefined ? value : null;
    });
    
    return mapped;
};
