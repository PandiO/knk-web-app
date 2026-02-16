import { FieldType } from './enums';

/**
 * Maps backend field type strings to FieldType enum values
 * Handles various backend type representations (int, int32, int64, float, single, etc.)
 * The mapping is case-insensitive and handles both friendly names and .NET CLR type names.
 */
export function mapFieldType(backendType: string): FieldType {
    const typeMap: Record<string, FieldType> = {
        // String types
        'string': FieldType.String,
        
        // Integer types (all map to Integer)
        'int': FieldType.Integer,
        'int32': FieldType.Integer,
        'int64': FieldType.Integer,
        'int16': FieldType.Integer,
        'integer': FieldType.Integer,
        
        // Boolean types
        'bool': FieldType.Boolean,
        'boolean': FieldType.Boolean,
        
        // DateTime types
        'datetime': FieldType.DateTime,
        'date': FieldType.DateTime,
        
        // Decimal/Floating point types (all map to Decimal)
        'decimal': FieldType.Decimal,
        'double': FieldType.Decimal,
        'float': FieldType.Decimal,
        'single': FieldType.Decimal,  // CLR name for float
        
        // Collection types
        'list': FieldType.List,
        'collection': FieldType.List,
    };
    const normalized = backendType.toLowerCase();
    return typeMap[normalized] || FieldType.Object;
}
