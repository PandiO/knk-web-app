import { FormFieldDto, FormStepDto } from '../../../types/dtos/forms/FormModels';
import { DisplayConfigurationDto } from '../../../types/dtos/displayConfig/DisplayModels';
import { FieldType } from '../../enums';
import { previewFormValues, readProperty, sampleDisplayRecord, sampleFormValue } from '../previewData';

const field = (fieldName: string, fieldType: FieldType, extra: Partial<FormFieldDto> = {}): FormFieldDto => ({
    fieldName, label: fieldName, fieldType, isRequired: false, isReadOnly: false, order: 0, isReusable: false,
    isLinkedToSource: false, hasCompatibilityIssues: false, validations: [], ...extra,
});

const steps: FormStepDto[] = [{
    stepName: 'General', order: 0, isReusable: false, isLinkedToSource: false, hasCompatibilityIssues: false,
    isManyToManyRelationship: false, conditions: [],
    fields: [
        field('Name', FieldType.String),
        field('Population', FieldType.Integer),
        field('IsCapital', FieldType.Boolean),
        field('Kind', FieldType.Enum, { settingsJson: JSON.stringify({ enumValues: ['City', 'Village'] }) }),
        field('TownId', FieldType.Object, { objectType: 'Town' }),
    ],
    childFormSteps: [{
        stepName: 'Child', order: 0, isReusable: false, isLinkedToSource: false, hasCompatibilityIssues: false,
        isManyToManyRelationship: false, conditions: [], childFormSteps: [], fields: [field('Motto', FieldType.String, { defaultValue: 'Onwards' })],
    }],
}];

describe('form preview values', () => {
    it('makes up a value per field type; pickers stay empty', () => {
        expect(previewFormValues(steps, null)).toEqual({
            Name: 'Sample Name', Population: 1, IsCapital: true, Kind: 'City', TownId: null, Motto: 'Onwards',
        });
        expect(sampleFormValue(field('Price', FieldType.Decimal, { defaultValue: '2.5' }))).toBe(2.5);
    });

    it("reads a real record's values, a link through its embedded record", () => {
        const record = { name: 'Cinix', population: 40, isCapital: false, kind: 'City', townId: 4, town: { id: 4, name: 'Valoria' } };
        expect(previewFormValues(steps, record)).toEqual({
            Name: 'Cinix', Population: 40, IsCapital: false, Kind: 'City', TownId: { id: 4, name: 'Valoria' }, Motto: null,
        });
        expect(previewFormValues(steps, { townId: 9 }).TownId).toEqual({ id: 9, name: '#9' });
    });

    it('finds a property whatever its casing', () => {
        expect(readProperty({ TownId: 1 }, 'townId')).toBe(1);
        expect(readProperty({ townid: 2 }, 'TownId')).toBe(2);
        expect(readProperty(null, 'x')).toBeUndefined();
    });
});

describe('display sample record', () => {
    it('fills values, related records and two items per collection', () => {
        const config: DisplayConfigurationDto = {
            name: 'Town page', entityTypeName: 'Town', isDefault: false, isDraft: true,
            sections: [
                {
                    sectionName: 'Details', isReusable: false, isLinkedToSource: false, isCollection: false, subSections: [],
                    fields: [
                        { label: 'Name', fieldName: 'Name', isReusable: false, isLinkedToSource: false },
                        { label: 'Size', fieldName: 'Size', fieldType: 'Integer', isReusable: false, isLinkedToSource: false },
                        { label: 'Mayor', fieldName: 'Username', relatedEntityPropertyName: 'Mayor', isReusable: false, isLinkedToSource: false },
                    ],
                },
                {
                    sectionName: 'Streets', isReusable: false, isLinkedToSource: false, isCollection: true,
                    relatedEntityPropertyName: 'Streets', subSections: [],
                    fields: [{ label: 'Name', fieldName: 'Name', isReusable: false, isLinkedToSource: false }],
                },
            ],
        };
        const record = sampleDisplayRecord(config);
        expect(record).toMatchObject({
            id: 1, Name: 'Sample Name', Size: 12, Mayor: { id: 1, Username: 'Sample Mayor' },
            Streets: [{ id: 1, Name: 'Sample Name 1' }, { id: 2, Name: 'Sample Name 2' }],
        });
    });
});
