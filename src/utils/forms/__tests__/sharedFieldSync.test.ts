import { AllStepsData, FormConfigurationDto, FormFieldDto, FormStepDto } from '../../../types/dtos/forms/FormModels';
import { FieldType } from '../../enums';
import { buildSharedFieldGroups, fillEmptySharedFieldValues, syncSharedFieldValues } from '../sharedFieldSync';

const field = (name: string, overrides: Partial<FormFieldDto> = {}): FormFieldDto => ({
    fieldGuid: `guid-${name}-${Math.random()}`,
    fieldName: name,
    label: name,
    fieldType: FieldType.Object,
    isRequired: false,
    isReadOnly: false,
    order: 0,
    isReusable: false,
    isLinkedToSource: false,
    hasCompatibilityIssues: false,
    validations: [],
    ...overrides
});

const step = (name: string, fields: FormFieldDto[], overrides: Partial<FormStepDto> = {}): FormStepDto => ({
    stepName: name,
    order: 0,
    isReusable: false,
    isLinkedToSource: false,
    hasCompatibilityIssues: false,
    isManyToManyRelationship: false,
    childFormSteps: [],
    fields,
    conditions: [],
    ...overrides
});

// Shaped like the default District form: the Location is asked for in two separate steps.
const districtConfig = (): FormConfigurationDto => ({
    entityTypeName: 'District',
    configurationName: 'District',
    isDefault: true,
    isActive: true,
    steps: [
        step('General', [field('name', { fieldType: FieldType.String }), field('Location')]),
        step('Region', [field('wgRegionId', { fieldType: FieldType.String })]),
        step('Spawn', [field('location')])
    ]
});

const spawnPoint = { id: 7, name: 'District spawn' };
const otherPoint = { id: 8, name: 'Moved spawn' };

describe('buildSharedFieldGroups', () => {
    it('groups fields bound to the same property, case-insensitively, in step order', () => {
        expect(buildSharedFieldGroups(districtConfig())).toEqual([[
            { stepIndex: 0, fieldName: 'Location' },
            { stepIndex: 2, fieldName: 'location' }
        ]]);
    });

    it('leaves many-to-many steps out', () => {
        const config = districtConfig();
        config.steps.push(step('Streets', [field('name')], { isManyToManyRelationship: true }));

        expect(buildSharedFieldGroups(config)).toHaveLength(1);
    });
});

describe('syncSharedFieldValues', () => {
    const empty = (): AllStepsData => ({
        0: { name: 'Old Town', Location: null },
        1: { wgRegionId: null },
        2: { location: null }
    });

    it('fills the later copy when the earlier one changes', () => {
        const previous = empty();
        const next = { ...previous, 0: { ...previous[0], Location: spawnPoint } };

        const result = syncSharedFieldValues(districtConfig(), previous, next, 0);

        expect(result[2].location).toBe(spawnPoint);
        expect(result[0].Location).toBe(spawnPoint);
    });

    it('fills the earlier copy when the later one changes', () => {
        const previous: AllStepsData = { ...empty(), 0: { name: 'Old Town', Location: spawnPoint }, 2: { location: spawnPoint } };
        const next = { ...previous, 2: { location: otherPoint } };

        const result = syncSharedFieldValues(districtConfig(), previous, next, 2);

        expect(result[0].Location).toBe(otherPoint);
        expect(result[0].name).toBe('Old Town');
    });

    it('clears the other copy when one is cleared', () => {
        const previous: AllStepsData = { ...empty(), 0: { name: 'Old Town', Location: spawnPoint }, 2: { location: spawnPoint } };
        const next = { ...previous, 0: { name: 'Old Town', Location: null } };

        expect(syncSharedFieldValues(districtConfig(), previous, next, 0)[2].location).toBeNull();
    });

    it('prefers the copy in the current step when several changed at once', () => {
        const previous = empty();
        const next = { ...previous, 0: { ...previous[0], Location: otherPoint }, 2: { location: spawnPoint } };

        const result = syncSharedFieldValues(districtConfig(), previous, next, 2);

        expect(result[0].Location).toBe(spawnPoint);
    });

    it('does not treat normalisation of a missing key as a change', () => {
        const previous: AllStepsData = { 0: { name: 'Old Town' }, 2: { location: spawnPoint } };
        const next = { ...previous, 0: { name: 'Old Town', Location: null } };

        expect(syncSharedFieldValues(districtConfig(), previous, next, 0)[2].location).toBe(spawnPoint);
    });

    it('returns the same object when nothing shared changed', () => {
        const previous = empty();
        const next = { ...previous, 0: { ...previous[0], name: 'New Town' } };

        expect(syncSharedFieldValues(districtConfig(), previous, next, 0)).toBe(next);
    });
});

describe('fillEmptySharedFieldValues', () => {
    it('fills empty copies from a filled one, either direction', () => {
        const laterFilled: AllStepsData = { 0: { Location: null }, 2: { location: spawnPoint } };

        expect(fillEmptySharedFieldValues(districtConfig(), laterFilled)[0].Location).toBe(spawnPoint);
    });

    it('leaves copies that already hold a value alone', () => {
        const data: AllStepsData = { 0: { Location: spawnPoint }, 2: { location: otherPoint } };

        expect(fillEmptySharedFieldValues(districtConfig(), data)).toBe(data);
    });
});
