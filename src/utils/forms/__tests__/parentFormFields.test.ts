import { findParentFormFields } from '../parentFormFields';
import { FormConfigurationDto, FormFieldDto } from '../../../types/dtos/forms/FormModels';
import { FieldType } from '../../enums';

const field = (id: string, fieldName: string, fieldType: FieldType, extra: Partial<FormFieldDto> = {}): FormFieldDto => ({
    id, fieldName, label: fieldName, fieldType, isRequired: false, isReadOnly: false, order: 0,
    isReusable: false, isLinkedToSource: false, hasCompatibilityIssues: false, validations: [], ...extra
} as FormFieldDto);

const config = (id: string, entityTypeName: string, fields: FormFieldDto[], extra: Partial<FormConfigurationDto> = {},
    m2mJoinEntityType?: string): FormConfigurationDto => ({
    id, entityTypeName, configurationName: `${entityTypeName} - Default`, isDefault: true, isActive: true,
    steps: [
        { id: `${id}0`, stepName: 'Main', order: 0, fieldOrderJson: '[]', isReusable: false, isLinkedToSource: false,
            hasCompatibilityIssues: false, isManyToManyRelationship: false, childFormSteps: [], fields, conditions: [] },
        ...(m2mJoinEntityType ? [{ id: `${id}9`, stepName: 'Join', order: 1, fieldOrderJson: '[]', isReusable: false,
            isLinkedToSource: false, hasCompatibilityIssues: false, isManyToManyRelationship: true,
            joinEntityType: m2mJoinEntityType, childFormSteps: [], fields: [], conditions: [] }] : [])
    ],
    ...extra
} as FormConfigurationDto);

const owned = (objectType: string) => ({ objectType, settingsJson: '{"ownedChildCollection":true}' });

const CONFIGS = [
    config('32', 'SiegeScenario', [
        field('301', 'TownId', FieldType.Object, { objectType: 'Town' }),
        field('302', 'Teams', FieldType.List, owned('SiegeTeam'))
    ], {}, 'SiegeScenarioGate'),
    config('30', 'SiegeTeam', [
        field('3001', 'Name', FieldType.String),
        field('3002', 'Spawnpoints', FieldType.List, owned('SiegeSpawnpoint'))
    ]),
    config('29', 'SiegeSpawnpoint', [field('2901', 'LocationId', FieldType.Object, { objectType: 'Location' })]),
    // A List of locations that isn't an owned child collection doesn't make Location a child form.
    config('40', 'Town', [field('401', 'Spots', FieldType.List, { objectType: 'SiegeSpawnpoint' })]),
    // Not the default configuration: ignored.
    config('41', 'SiegeTeam', [field('4101', 'Other', FieldType.String), field('4102', 'Spawnpoints', FieldType.List, owned('SiegeSpawnpoint'))],
        { isDefault: false, configurationName: 'SiegeTeam - Alt' })
];

describe('findParentFormFields', () => {
    it('lists the parent and grandparent forms of an owned child, nearest first, without list fields', () => {
        const result = findParentFormFields(CONFIGS, 'SiegeSpawnpoint');

        expect(result.map(r => [r.depth, r.configurationName, r.field.fieldName])).toEqual([
            [1, 'SiegeTeam - Default', 'Name'],
            [2, 'SiegeScenario - Default', 'TownId']
        ]);
        expect(result[1].entityTypeName).toBe('SiegeScenario');
    });

    it('treats a many-to-many join entry as opened from the parent form', () => {
        expect(findParentFormFields(CONFIGS, 'SiegeScenarioGate').map(r => r.field.fieldName)).toEqual(['TownId']);
    });

    it('returns nothing for a root form', () => {
        expect(findParentFormFields(CONFIGS, 'SiegeScenario')).toEqual([]);
    });
});
