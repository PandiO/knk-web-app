import { withLiveEnumOptions } from '../enumFieldMetadata';
import { FormFieldDto } from '../../../types/dtos/forms/FormModels';
import { FieldMetadataDto } from '../../../types/dtos/metadata/MetadataModels';
import { FieldType } from '../../enums';

const baseField: FormFieldDto = {
    fieldName: 'MotionType',
    label: 'Motion Type',
    fieldType: FieldType.Enum,
    isRequired: true,
    isReadOnly: false,
    order: 0,
    isReusable: false,
    isLinkedToSource: false,
    hasCompatibilityIssues: false,
    validations: []
};

describe('withLiveEnumOptions', () => {
    it('replaces a stale settingsJson enum snapshot with live metadata values', () => {
        // Regression test: GateStructure.MotionType was configured in the form builder before
        // ROTATION was added to the backend enum, so its settingsJson snapshot only ever had
        // VERTICAL/LATERAL. Live metadata (reflected off the real enum) must win.
        const staleField: FormFieldDto = {
            ...baseField,
            settingsJson: JSON.stringify({ enumValues: ['VERTICAL', 'LATERAL'] })
        };
        const metadataFields: FieldMetadataDto[] = [{
            fieldName: 'MotionType',
            fieldType: 'Enum',
            isNullable: false,
            isRelatedEntity: false,
            hasDefaultValue: false,
            isEnum: true,
            enumValues: ['VERTICAL', 'LATERAL', 'ROTATION']
        }];

        const result = withLiveEnumOptions(staleField, metadataFields);

        expect(JSON.parse(result.settingsJson!)).toEqual({ enumValues: ['VERTICAL', 'LATERAL', 'ROTATION'] });
    });

    it('preserves other settingsJson keys while updating enumValues', () => {
        const fieldWithExtraSettings: FormFieldDto = {
            ...baseField,
            settingsJson: JSON.stringify({ enumValues: ['VERTICAL'], categoryFilter: 'GATE' })
        };
        const metadataFields: FieldMetadataDto[] = [{
            fieldName: 'MotionType',
            fieldType: 'Enum',
            isNullable: false,
            isRelatedEntity: false,
            hasDefaultValue: false,
            isEnum: true,
            enumValues: ['VERTICAL', 'LATERAL', 'ROTATION']
        }];

        const result = withLiveEnumOptions(fieldWithExtraSettings, metadataFields);

        expect(JSON.parse(result.settingsJson!)).toEqual({
            enumValues: ['VERTICAL', 'LATERAL', 'ROTATION'],
            categoryFilter: 'GATE'
        });
    });

    it('leaves non-enum fields untouched', () => {
        const textField: FormFieldDto = { ...baseField, fieldType: FieldType.String };

        const result = withLiveEnumOptions(textField, [{
            fieldName: 'MotionType',
            fieldType: 'Enum',
            isNullable: false,
            isRelatedEntity: false,
            hasDefaultValue: false,
            isEnum: true,
            enumValues: ['VERTICAL', 'LATERAL', 'ROTATION']
        }]);

        expect(result).toBe(textField);
    });

    it('leaves the field untouched when metadata is unavailable or has no matching field', () => {
        expect(withLiveEnumOptions(baseField, undefined)).toBe(baseField);
        expect(withLiveEnumOptions(baseField, [])).toBe(baseField);
        expect(withLiveEnumOptions(baseField, [{
            fieldName: 'FaceDirection',
            fieldType: 'Enum',
            isNullable: false,
            isRelatedEntity: false,
            hasDefaultValue: false,
            isEnum: true,
            enumValues: ['north', 'south']
        }])).toBe(baseField);
    });

    it('matches field names case-insensitively', () => {
        const field: FormFieldDto = { ...baseField, fieldName: 'motionType' };
        const metadataFields: FieldMetadataDto[] = [{
            fieldName: 'MotionType',
            fieldType: 'Enum',
            isNullable: false,
            isRelatedEntity: false,
            hasDefaultValue: false,
            isEnum: true,
            enumValues: ['VERTICAL', 'LATERAL', 'ROTATION']
        }];

        const result = withLiveEnumOptions(field, metadataFields);

        expect(JSON.parse(result.settingsJson!)).toEqual({ enumValues: ['VERTICAL', 'LATERAL', 'ROTATION'] });
    });

    it('keeps an authored subset (enumValuesSubset) instead of every live value', () => {
        const field: FormFieldDto = {
            ...baseField,
            fieldName: 'InitialState',
            settingsJson: JSON.stringify({ enumValues: ['OPEN', 'CLOSED', 'REMOVED'], enumValuesSubset: true })
        };
        const metadataFields: FieldMetadataDto[] = [{
            fieldName: 'InitialState',
            fieldType: 'Enum',
            isNullable: false,
            isRelatedEntity: false,
            hasDefaultValue: false,
            isEnum: true,
            enumValues: ['CLOSED', 'OPENING', 'OPEN', 'CLOSING', 'JAMMED']
        }];

        const result = withLiveEnumOptions(field, metadataFields);

        // A value the live enum no longer has is dropped; the transient states stay hidden.
        expect(JSON.parse(result.settingsJson!)).toEqual({ enumValues: ['OPEN', 'CLOSED'], enumValuesSubset: true });
    });
});
