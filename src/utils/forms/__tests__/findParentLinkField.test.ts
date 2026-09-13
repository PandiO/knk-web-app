import { findParentLinkField } from '../findParentLinkField';
import { FormConfigurationDto, FormFieldDto } from '../../../types/dtos/forms/FormModels';
import { FieldType } from '../../enums';

const baseField = (overrides: Partial<FormFieldDto>): FormFieldDto => ({
    fieldName: 'example',
    label: 'Example',
    fieldType: FieldType.String,
    isRequired: false,
    isReadOnly: false,
    order: 0,
    isReusable: false,
    isLinkedToSource: false,
    hasCompatibilityIssues: false,
    validations: [],
    ...overrides
});

const configWithFields = (fields: FormFieldDto[]): FormConfigurationDto => ({
    entityTypeName: 'GateDoor',
    configurationName: 'Gate Door Configuration',
    isDefault: true,
    isActive: true,
    steps: [
        {
            stepName: 'General Information',
            order: 0,
            isReusable: false,
            isLinkedToSource: false,
            hasCompatibilityIssues: false,
            isManyToManyRelationship: false,
            childFormSteps: [],
            conditions: [],
            fields
        }
    ]
});

describe('findParentLinkField', () => {
    it('finds the Object-type field whose objectType matches the parent entity type', () => {
        const config = configWithFields([
            baseField({ fieldName: 'Name' }),
            baseField({ fieldName: 'GateStructureId', fieldType: FieldType.Object, objectType: 'GateStructure' }),
            baseField({ fieldName: 'AnchorPointId', fieldType: FieldType.Object, objectType: 'Location' })
        ]);

        const result = findParentLinkField(config, 'GateStructure');

        expect(result?.fieldName).toBe('GateStructureId');
    });

    it('searches across every step, not just the first', () => {
        const config: FormConfigurationDto = {
            entityTypeName: 'GateDoor',
            configurationName: 'Gate Door Configuration',
            isDefault: true,
            isActive: true,
            steps: [
                {
                    stepName: 'Step 1',
                    order: 0,
                    isReusable: false,
                    isLinkedToSource: false,
                    hasCompatibilityIssues: false,
                    isManyToManyRelationship: false,
                    childFormSteps: [],
                    conditions: [],
                    fields: [baseField({ fieldName: 'Name' })]
                },
                {
                    stepName: 'Step 2',
                    order: 1,
                    isReusable: false,
                    isLinkedToSource: false,
                    hasCompatibilityIssues: false,
                    isManyToManyRelationship: false,
                    childFormSteps: [],
                    conditions: [],
                    fields: [baseField({ fieldName: 'GateStructureId', fieldType: FieldType.Object, objectType: 'GateStructure' })]
                }
            ]
        };

        const result = findParentLinkField(config, 'GateStructure');

        expect(result?.fieldName).toBe('GateStructureId');
    });

    it('returns null when no field references the parent type', () => {
        const config = configWithFields([
            baseField({ fieldName: 'Name' }),
            baseField({ fieldName: 'AnchorPointId', fieldType: FieldType.Object, objectType: 'Location' })
        ]);

        expect(findParentLinkField(config, 'GateStructure')).toBeNull();
    });

    it('returns null when the config or parent type is missing', () => {
        const config = configWithFields([
            baseField({ fieldName: 'GateStructureId', fieldType: FieldType.Object, objectType: 'GateStructure' })
        ]);

        expect(findParentLinkField(null, 'GateStructure')).toBeNull();
        expect(findParentLinkField(config, undefined)).toBeNull();
    });

    it('ignores a non-Object field that happens to share the objectType-shaped name', () => {
        const config = configWithFields([
            baseField({ fieldName: 'GateStructureId', fieldType: FieldType.Integer })
        ]);

        expect(findParentLinkField(config, 'GateStructure')).toBeNull();
    });
});
