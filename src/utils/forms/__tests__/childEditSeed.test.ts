import { buildChildEditSeedValues, isSeedableInstance, overlayChildEditValues } from '../childEditSeed';
import { FormConfigurationDto, FormFieldDto } from '../../../types/dtos/forms/FormModels';
import { FieldType } from '../../enums';

const field = (overrides: Partial<FormFieldDto>): FormFieldDto => ({
    fieldName: 'Name',
    label: 'Name',
    fieldType: FieldType.String,
    isRequired: false,
    isReadOnly: false,
    order: 0,
    isReusable: false,
    isLinkedToSource: false,
    hasCompatibilityIssues: false,
    validations: [],
    ...overrides
} as FormFieldDto);

const config = (steps: Array<{ fields: FormFieldDto[]; isManyToManyRelationship?: boolean }>): FormConfigurationDto => ({
    id: '1',
    entityTypeName: 'Location',
    configurationName: 'Location - Default',
    isDefault: true,
    steps: steps.map((step, index) => ({
        id: String(index),
        stepName: `Step ${index}`,
        order: index,
        fields: step.fields,
        childFormSteps: [],
        conditions: [],
        isReusable: false,
        isLinkedToSource: false,
        hasCompatibilityIssues: false,
        isManyToManyRelationship: !!step.isManyToManyRelationship
    }))
} as unknown as FormConfigurationDto);

const LOCATION_CONFIG = config([{
    fields: [
        field({ fieldName: 'Name', defaultValue: 'Location' }),
        field({ fieldName: 'X', fieldType: FieldType.Decimal }),
        field({ fieldName: 'Y', fieldType: FieldType.Decimal }),
        field({ fieldName: 'Z', fieldType: FieldType.Decimal }),
        field({ fieldName: 'World' })
    ]
}]);

describe('buildChildEditSeedValues (KNG-134)', () => {
    it('seeds every field from a world-task Location that has no id', () => {
        const captured = { name: 'Gate spawn', x: 10.5, y: 64, z: -3, yaw: 90, pitch: 0, World: 'world' };
        expect(buildChildEditSeedValues(LOCATION_CONFIG, captured)).toEqual({
            Name: 'Gate spawn', X: 10.5, Y: 64, Z: -3, World: 'world'
        });
    });

    it('leaves out fields the instance has no value for, so they keep their defaults', () => {
        expect(buildChildEditSeedValues(LOCATION_CONFIG, { x: 1 })).toEqual({ X: 1 });
    });

    it('keeps an explicit null or 0 the instance holds', () => {
        expect(buildChildEditSeedValues(LOCATION_CONFIG, { x: 0, World: null })).toEqual({ X: 0, World: null });
    });

    it('gives an FK-authored Object field the navigation object its picker shows as selected', () => {
        const cfg = config([{ fields: [field({ fieldName: 'TownId', fieldType: FieldType.Object, objectType: 'Town' })] }]);
        expect(buildChildEditSeedValues(cfg, { townId: 4, town: { id: 4, name: 'Kardenna' } }))
            .toEqual({ TownId: { id: 4, name: 'Kardenna' } });
    });

    it('builds { id } for a navigation-authored Object field when only the FK is held', () => {
        const cfg = config([{ fields: [field({ fieldName: 'Street', fieldType: FieldType.Object, objectType: 'Street' })] }]);
        expect(buildChildEditSeedValues(cfg, { streetId: 7 })).toEqual({ Street: { id: 7 } });
    });

    it('keeps List relationship values as held (selected objects)', () => {
        const cfg = config([{ fields: [field({ fieldName: 'Districts', fieldType: FieldType.List, objectType: 'District' })] }]);
        const districts = [{ id: 3, name: 'Old Town' }, { name: 'Unsaved' }];
        expect(buildChildEditSeedValues(cfg, { Districts: districts })).toEqual({ Districts: districts });
    });

    it('seeds a DistrictIds-authored List from a held Street DTO that only carries Districts (KNG-135)', () => {
        const street = config([{ fields: [field({ fieldName: 'DistrictIds', fieldType: FieldType.List, objectType: 'District' })] }]);
        const districts = [{ id: 2, name: 'Old Quarter' }];
        expect(buildChildEditSeedValues(street, { id: 4, name: 'High Street', districtIds: [], districts }))
            .toEqual({ DistrictIds: districts });
        expect(buildChildEditSeedValues(street, { id: 4, districtIds: [2] })).toEqual({ DistrictIds: [{ id: 2 }] });
    });

    it('skips many-to-many steps (their rows always come from the database load)', () => {
        const cfg = config([
            { fields: [field({ fieldName: 'Name' })] },
            { fields: [field({ fieldName: 'Relationships', fieldType: FieldType.List })], isManyToManyRelationship: true }
        ]);
        expect(buildChildEditSeedValues(cfg, { name: 'A', relationships: [{ id: 1 }] })).toEqual({ Name: 'A' });
    });

    it('returns nothing without a config or for a value that is not an object', () => {
        expect(buildChildEditSeedValues(null, { name: 'A' })).toEqual({});
        expect(buildChildEditSeedValues(LOCATION_CONFIG, 83)).toEqual({});
        expect(buildChildEditSeedValues(LOCATION_CONFIG, [{ name: 'A' }])).toEqual({});
    });
});

describe('overlayChildEditValues (KNG-134)', () => {
    it('lets the held values win over the database load and keeps the rest', () => {
        const loaded = { 0: { Name: 'Kardenna spawn', X: 120.5, Y: 64, Z: -30, World: 'world' } };
        const overlaid = overlayChildEditValues(LOCATION_CONFIG, loaded, { Name: 'Kardenna gate', X: 121 });
        expect(overlaid[0]).toEqual({ Name: 'Kardenna gate', X: 121, Y: 64, Z: -30, World: 'world' });
        expect(loaded[0].Name).toBe('Kardenna spawn');
    });

    it('returns the loaded data unchanged without seed values', () => {
        const loaded = { 0: { Name: 'A' } };
        expect(overlayChildEditValues(LOCATION_CONFIG, loaded, undefined)).toBe(loaded);
        expect(overlayChildEditValues(LOCATION_CONFIG, loaded, {})).toBe(loaded);
    });
});

describe('isSeedableInstance', () => {
    it('accepts plain objects only', () => {
        expect(isSeedableInstance({ id: 1 })).toBe(true);
        expect(isSeedableInstance(null)).toBe(false);
        expect(isSeedableInstance(undefined)).toBe(false);
        expect(isSeedableInstance(5)).toBe(false);
        expect(isSeedableInstance([])).toBe(false);
    });
});
