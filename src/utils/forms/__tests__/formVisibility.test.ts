import { AllStepsData, FormConfigurationDto, FormFieldDto, FormStepDto } from '../../../types/dtos/forms/FormModels';
import { ConditionOperator, DisplayConditionLogic, DisplayConditionTargetType, FieldType } from '../../enums';
import { reconcileVisibility, nextVisibleStepIndex, previousVisibleStepIndex } from '../formVisibility';

const GATE_TYPE_GUID = 'guid-gate-type';
const WIDTH_GUID = 'guid-width';

const field = (guid: string, name: string, overrides: Partial<FormFieldDto> = {}): FormFieldDto => ({
    fieldGuid: guid,
    fieldName: name,
    label: name,
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
    fieldOrderJson: JSON.stringify(fields.map(f => f.fieldGuid)),
    ...overrides
});

const buildConfig = (): FormConfigurationDto => ({
    entityTypeName: 'GateStructure',
    configurationName: 'Gate',
    isDefault: true,
    isActive: true,
    steps: [
        step('General', [
            field(GATE_TYPE_GUID, 'gateType', { fieldType: FieldType.Enum }),
            field(WIDTH_GUID, 'geometryWidth', { fieldType: FieldType.Integer })
        ]),
        step('Rotation', [field('guid-hinge', 'hingeAxis')], {
            displayConditionGroups: [{
                targetType: DisplayConditionTargetType.FormStep,
                innerLogic: DisplayConditionLogic.And,
                combineWithPreviousLogic: DisplayConditionLogic.Or,
                order: 0,
                isActive: true,
                conditions: [{
                    sourceFieldGuid: GATE_TYPE_GUID,
                    operator: ConditionOperator.Equals,
                    valueJson: '"DRAWBRIDGE"',
                    order: 0
                }]
            }]
        }),
        step('Always', [field('guid-name', 'name')])
    ]
});

describe('reconcileVisibility', () => {
    it('hides a step whose condition is not met', () => {
        const config = buildConfig();
        const data: AllStepsData = { 0: { gateType: 'SLIDING', geometryWidth: 3 } };

        const result = reconcileVisibility(config, data, {});

        expect(result.visibility.visibleStepIndices).toEqual([0, 2]);
    });

    it('shows a step when the condition is met', () => {
        const config = buildConfig();
        const data: AllStepsData = { 0: { gateType: 'DRAWBRIDGE' } };

        const result = reconcileVisibility(config, data, {});

        expect(result.visibility.visibleStepIndices).toEqual([0, 1, 2]);
    });

    it('moves data of a hidden step to the stash instead of the payload', () => {
        const config = buildConfig();
        const data: AllStepsData = { 0: { gateType: 'SLIDING' }, 1: { hingeAxis: 'north' } };

        const result = reconcileVisibility(config, data, {});

        expect(result.allStepsData[1]).toBeUndefined();
        expect(result.hiddenStash[1]).toEqual({ hingeAxis: 'north' });
    });

    it('restores stashed data when the condition is met again', () => {
        const config = buildConfig();
        const hidden = reconcileVisibility(config, { 0: { gateType: 'SLIDING' }, 1: { hingeAxis: 'north' } }, {});

        const restored = reconcileVisibility(
            config,
            { ...hidden.allStepsData, 0: { gateType: 'DRAWBRIDGE' } },
            hidden.hiddenStash
        );

        expect(restored.allStepsData[1]).toEqual({ hingeAxis: 'north' });
        expect(restored.hiddenStash[1]).toBeUndefined();
    });

    it('supports numeric comparison operators', () => {
        const config = buildConfig();
        config.steps[1].displayConditionGroups = [{
            targetType: DisplayConditionTargetType.FormStep,
            innerLogic: DisplayConditionLogic.And,
            combineWithPreviousLogic: DisplayConditionLogic.Or,
            order: 0,
            isActive: true,
            conditions: [{
                sourceFieldGuid: WIDTH_GUID,
                operator: ConditionOperator.GreaterOrEqual,
                valueJson: '6',
                order: 0
            }]
        }];

        expect(reconcileVisibility(config, { 0: { geometryWidth: 5 } }, {}).visibility.visibleStepIndices)
            .toEqual([0, 2]);
        expect(reconcileVisibility(config, { 0: { geometryWidth: 6 } }, {}).visibility.visibleStepIndices)
            .toEqual([0, 1, 2]);
    });

    it('combines multiple conditions in a group with AND', () => {
        const config = buildConfig();
        config.steps[1].displayConditionGroups = [{
            targetType: DisplayConditionTargetType.FormStep,
            innerLogic: DisplayConditionLogic.And,
            combineWithPreviousLogic: DisplayConditionLogic.Or,
            order: 0,
            isActive: true,
            conditions: [
                { sourceFieldGuid: GATE_TYPE_GUID, operator: ConditionOperator.Equals, valueJson: '"DRAWBRIDGE"', order: 0 },
                { sourceFieldGuid: WIDTH_GUID, operator: ConditionOperator.GreaterOrEqual, valueJson: '6', order: 1 }
            ]
        }];

        expect(reconcileVisibility(config, { 0: { gateType: 'DRAWBRIDGE', geometryWidth: 4 } }, {}).visibility.visibleStepIndices)
            .toEqual([0, 2]);
        expect(reconcileVisibility(config, { 0: { gateType: 'DRAWBRIDGE', geometryWidth: 8 } }, {}).visibility.visibleStepIndices)
            .toEqual([0, 1, 2]);
    });

    it('supports the In operator across several gate types', () => {
        const config = buildConfig();
        config.steps[1].displayConditionGroups![0].conditions[0] = {
            sourceFieldGuid: GATE_TYPE_GUID,
            operator: ConditionOperator.In,
            valueJson: '["SLIDING","TRAP","DRAWBRIDGE"]',
            order: 0
        };

        expect(reconcileVisibility(config, { 0: { gateType: 'TRAP' } }, {}).visibility.visibleStepIndices)
            .toEqual([0, 1, 2]);
        expect(reconcileVisibility(config, { 0: { gateType: 'DOUBLE_DOORS' } }, {}).visibility.visibleStepIndices)
            .toEqual([0, 2]);
    });

    it('hides a field within a visible step', () => {
        const config = buildConfig();
        config.steps[2].fields[0].displayConditionGroups = [{
            targetType: DisplayConditionTargetType.FormField,
            innerLogic: DisplayConditionLogic.And,
            combineWithPreviousLogic: DisplayConditionLogic.Or,
            order: 0,
            isActive: true,
            conditions: [{
                sourceFieldGuid: GATE_TYPE_GUID,
                operator: ConditionOperator.Equals,
                valueJson: '"TRAP"',
                order: 0
            }]
        }];

        const result = reconcileVisibility(config, { 0: { gateType: 'SLIDING' }, 2: { name: 'Main gate' } }, {});

        expect(result.visibility.visibleStepIndices).toContain(2);
        expect(result.visibility.visibleFieldNames[2].has('name')).toBe(false);
        expect(result.hiddenStash[2]).toEqual({ name: 'Main gate' });
    });

    it('skips hidden steps when navigating', () => {
        const config = buildConfig();
        const { visibility } = reconcileVisibility(config, { 0: { gateType: 'SLIDING' } }, {});

        expect(nextVisibleStepIndex(visibility, 0)).toBe(2);
        expect(previousVisibleStepIndex(visibility, 2)).toBe(0);
        expect(nextVisibleStepIndex(visibility, 2)).toBeNull();
    });
});
