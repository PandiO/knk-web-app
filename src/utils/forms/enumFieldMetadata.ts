import { FormFieldDto } from '../../types/dtos/forms/FormModels';
import { FieldMetadataDto } from '../../types/dtos/metadata/MetadataModels';
import { FieldType } from '../enums';

/**
 * Enum-type fields render their <select> options from field.settingsJson.enumValues (see
 * FieldRenderers.tsx getEnumValues) - a snapshot copied in by the form builder the moment an
 * admin picked the field's name (see FormConfigBuilder/FieldEditor.tsx handleFieldNameChange).
 * There is no UI to edit or refresh that snapshot afterward, so it goes stale as soon as the
 * backend enum gains a value - exactly what happened to GateStructure.MotionType after ROTATION
 * was added. Entity metadata is reflected live off the real enum on every request (see
 * MetadataService.cs, Enum.GetNames), so prefer it here whenever it's available for the field,
 * rather than the frozen settingsJson copy.
 */
export const withLiveEnumOptions = (
    field: FormFieldDto,
    metadataFields: FieldMetadataDto[] | undefined
): FormFieldDto => {
    if (field.fieldType !== FieldType.Enum || !metadataFields) {
        return field;
    }

    const metaField = metadataFields.find(
        mf => mf.fieldName.toLowerCase() === field.fieldName.toLowerCase()
    );
    if (!metaField?.isEnum || !metaField.enumValues || metaField.enumValues.length === 0) {
        return field;
    }

    let baseSettings: Record<string, unknown> = {};
    try {
        baseSettings = field.settingsJson ? JSON.parse(field.settingsJson) : {};
    } catch {
        baseSettings = {};
    }

    return {
        ...field,
        settingsJson: JSON.stringify({ ...baseSettings, enumValues: metaField.enumValues })
    };
};
