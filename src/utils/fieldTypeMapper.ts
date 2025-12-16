import { FieldType } from './enums';

/**
 * Maps backend field type strings to FieldType enum values
 * Handles various backend type representations (int, int32, int64, etc.)
 */
export function mapFieldType(backendType: string): FieldType {
    const typeMap: Record<string, FieldType> = {
        'string': FieldType.String,
        'int': FieldType.Integer,
        'int32': FieldType.Integer,
        'int64': FieldType.Integer,
        'bool': FieldType.Boolean,
        'boolean': FieldType.Boolean,
        'datetime': FieldType.DateTime,
        'decimal': FieldType.Decimal,
        'double': FieldType.Decimal,
        'float': FieldType.Decimal,
        'list': FieldType.List,
    };
    const normalized = backendType.toLowerCase();
    return typeMap[normalized] || FieldType.Object;
}
