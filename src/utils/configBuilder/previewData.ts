// PandiO/knk-workspace#71 (CRUD-13): the values the builders' live preview shows (sample data or a real record).
import { FormFieldDto, FormStepDto } from '../../types/dtos/forms/FormModels';
import { DisplayConfigurationDto, DisplaySectionDto } from '../../types/dtos/displayConfig/DisplayModels';
import { FieldType } from '../enums';
import { mapFieldType } from '../fieldTypeMapper';

type Row = Record<string, unknown>;

/** A property of a record, whatever the casing (`townId`, `TownId`). */
export function readProperty(record: Row | null | undefined, name: string | undefined): unknown {
    if (!record || !name) return undefined;
    if (name in record) return record[name];
    const camel = name.charAt(0).toLowerCase() + name.slice(1);
    if (camel in record) return record[camel];
    const pascal = name.charAt(0).toUpperCase() + name.slice(1);
    if (pascal in record) return record[pascal];
    const lower = name.toLowerCase();
    const key = Object.keys(record).find(k => k.toLowerCase() === lower);
    return key ? record[key] : undefined;
}

const enumValuesOf = (field: FormFieldDto): string[] => {
    try {
        const settings = field.settingsJson ? JSON.parse(field.settingsJson) : {};
        return Array.isArray(settings.enumValues) ? settings.enumValues : [];
    } catch {
        return [];
    }
};

/** A believable value for an empty form field; pickers stay empty (nothing is looked up for a sample). */
export function sampleFormValue(field: FormFieldDto): unknown {
    switch (field.fieldType) {
        case FieldType.String:
            return field.defaultValue || `Sample ${field.label || field.fieldName}`.trim();
        case FieldType.Integer:
            return field.defaultValue != null && field.defaultValue !== '' ? Number(field.defaultValue) : 1;
        case FieldType.Decimal:
            return field.defaultValue != null && field.defaultValue !== '' ? Number(field.defaultValue) : 1.5;
        case FieldType.Boolean:
            return field.defaultValue != null ? field.defaultValue === 'true' : true;
        case FieldType.DateTime:
            return new Date().toISOString().slice(0, 16);
        case FieldType.Enum:
            return enumValuesOf(field)[0] ?? null;
        case FieldType.List:
            return [];
        default:
            return null;
    }
}

const allFields = (steps: FormStepDto[]): FormFieldDto[] =>
    steps.flatMap(step => [...step.fields, ...allFields(step.childFormSteps ?? [])]);

/** Values per field name: sample values, or a real record's (a picker shows the linked record by its name). */
export function previewFormValues(steps: FormStepDto[], record: Row | null): Record<string, unknown> {
    const values: Record<string, unknown> = {};
    for (const field of allFields(steps)) {
        if (!field.fieldName) continue;
        if (!record) {
            values[field.fieldName] = sampleFormValue(field);
            continue;
        }
        const raw = readProperty(record, field.fieldName);
        if (field.fieldType === FieldType.Object && /.Id$/.test(field.fieldName)) {
            // TownId → the embedded Town when the read DTO has it, else just the id.
            const embedded = readProperty(record, field.fieldName.slice(0, -2));
            values[field.fieldName] = embedded && typeof embedded === 'object'
                ? embedded
                : raw != null ? { id: raw, name: `#${raw}` } : null;
        } else if (field.fieldType === FieldType.DateTime && typeof raw === 'string') {
            values[field.fieldName] = raw.slice(0, 16);
        } else {
            values[field.fieldName] = raw ?? null;
        }
    }
    return values;
}

const sampleScalar = (fieldName: string, label: string, fieldType?: string): unknown => {
    switch (fieldType ? mapFieldType(fieldType) : FieldType.String) {
        case FieldType.Integer: return 12;
        case FieldType.Decimal: return 3.5;
        case FieldType.Boolean: return true;
        case FieldType.DateTime: return new Date().toISOString();
        default: return `Sample ${label || fieldName}`;
    }
};

const setPath = (target: Row, path: string, value: unknown) => {
    const parts = path.split('.');
    let node = target;
    parts.slice(0, -1).forEach(part => {
        if (!node[part] || typeof node[part] !== 'object') node[part] = {};
        node = node[part] as Row;
    });
    if (node[parts[parts.length - 1]] === undefined) node[parts[parts.length - 1]] = value;
};

function fillSection(record: Row, section: DisplaySectionDto) {
    const fill = (target: Row, s: DisplaySectionDto) => {
        s.fields.forEach(field => {
            const value = sampleScalar(field.fieldName ?? '', field.label, field.fieldType);
            if (field.relatedEntityPropertyName && field.fieldName) {
                const nested = (target[field.relatedEntityPropertyName] ??= { id: 1 }) as Row;
                setPath(nested, field.fieldName, value);
            } else if (field.fieldName) {
                setPath(target, field.fieldName, value);
            }
        });
    };
    if (section.relatedEntityPropertyName && section.isCollection) {
        const items = [1, 2].map(n => {
            const item: Row = { id: n };
            fill(item, section);
            Object.keys(item).forEach(k => {
                if (typeof item[k] === 'string') item[k] = `${item[k]} ${n}`;
            });
            (section.subSections ?? []).forEach(sub => fill(item, sub));
            return item;
        });
        record[section.relatedEntityPropertyName] = items;
        return;
    }
    if (section.relatedEntityPropertyName) {
        const related = (record[section.relatedEntityPropertyName] ??= { id: 1 }) as Row;
        fill(related, section);
    } else {
        fill(record, section);
    }
    (section.subSections ?? []).forEach(sub => fillSection(record, sub));
}

/** A made-up record with a value for every field the display shows (two items per collection). */
export function sampleDisplayRecord(config: DisplayConfigurationDto): Row {
    const record: Row = { id: 1, name: `Sample ${config.entityTypeName || 'record'}` };
    config.sections.forEach(section => fillSection(record, section));
    return record;
}
