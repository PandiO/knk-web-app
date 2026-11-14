import { FormStepDto, StepConditionDto } from '../../../types/dtos/forms/FormModels';
import { ConditionOperator, FieldType } from '../../enums';
import {
    defaultStepConditionValue,
    describeStepCondition,
    failedStepConditionFieldNames,
    firstFailedStepCondition,
    parseStepConditionJson,
    serializeStepCondition,
    stepConditionCountLabel,
    stepConditionMessage,
    stepConditionsPublishProblem
} from '../stepConditions';

// PandiO/knk-workspace#88: the rows the builder edits <-> the JSON the wizard evaluates.

const condition = (overrides: Partial<StepConditionDto> = {}): StepConditionDto => ({
    conditionType: 'Completion',
    conditionJson: '{"conditions":[],"logic":"AND"}',
    errorMessage: 'Fill it in.',
    isActive: true,
    ...overrides
});

const step = (conditions: StepConditionDto[]): FormStepDto => ({
    stepName: 'Region and access',
    order: 1,
    conditions,
    fields: []
} as unknown as FormStepDto);

describe('step condition JSON', () => {
    it('writes the shape the wizard evaluates, with a real boolean', () => {
        const json = serializeStepCondition([{ fieldName: 'AllowEntry', operator: ConditionOperator.Equals, value: true }], 'AND');
        expect(json).toBe('{"conditions":[{"fieldName":"AllowEntry","operator":"Equals","value":true}],"logic":"AND"}');
    });

    it('leaves the value out for IsEmpty / IsNotEmpty and writes fromPreviousStep only when set', () => {
        const json = serializeStepCondition(
            [{ fieldName: 'Name', operator: ConditionOperator.IsNotEmpty, value: 'ignored', fromPreviousStep: true }],
            'OR'
        );
        expect(json).toBe('{"conditions":[{"fieldName":"Name","operator":"IsNotEmpty","fromPreviousStep":true}],"logic":"OR"}');
    });

    it('reads its own output back as the same rows', () => {
        const rows = [
            { fieldName: 'AllowEntry', operator: ConditionOperator.Equals, value: true },
            { fieldName: 'Weight', operator: ConditionOperator.GreaterThan, value: 3, fromPreviousStep: true }
        ];
        const parsed = parseStepConditionJson(serializeStepCondition(rows, 'OR'));
        expect(parsed).toEqual({ conditions: rows, logic: 'OR' });
        expect(serializeStepCondition(parsed!.conditions, parsed!.logic)).toBe(serializeStepCondition(rows, 'OR'));
    });

    it('treats empty JSON as a condition without rules', () => {
        expect(parseStepConditionJson('')).toEqual({ conditions: [], logic: 'AND' });
        expect(parseStepConditionJson('{}')).toEqual({ conditions: [], logic: 'AND' });
    });

    it.each([
        ['not JSON', 'AllowEntry == true'],
        ['an array', '[]'],
        ['an operator the evaluator ignores', '{"conditions":[{"fieldName":"A","operator":"In","value":[1]}]}'],
        ['an extra key', '{"conditions":[],"logic":"AND","note":"x"}'],
        ['a nested group', '{"conditions":[{"conditions":[]}]}'],
        ['an unknown logic', '{"conditions":[],"logic":"XOR"}']
    ])('does not read %s as rows', (_, json) => {
        expect(parseStepConditionJson(json)).toBeNull();
    });

    it('starts a Boolean rule with a boolean, anything else empty', () => {
        expect(defaultStepConditionValue({ fieldType: FieldType.Boolean } as never)).toBe(true);
        expect(defaultStepConditionValue({ fieldType: FieldType.String } as never)).toBeNull();
        expect(defaultStepConditionValue(undefined)).toBeNull();
    });
});

describe('step condition texts', () => {
    it('describes a condition in words', () => {
        const parsed = parseStepConditionJson(serializeStepCondition([
            { fieldName: 'AllowEntry', operator: ConditionOperator.Equals, value: true },
            { fieldName: 'Name', operator: ConditionOperator.IsNotEmpty, value: null, fromPreviousStep: true }
        ]))!;
        const labels: Record<string, string> = { AllowEntry: 'Allow entry', Name: 'Name' };
        expect(describeStepCondition(parsed, row => labels[row.fieldName])).toBe(
            'Allow entry is ticked and Name (earlier step) is not empty'
        );
        expect(describeStepCondition({ conditions: [], logic: 'AND' }, row => row.fieldName)).toMatch(/always passes/);
    });

    it('counts conditions and the ones switched off', () => {
        expect(stepConditionCountLabel([])).toBe('No conditions');
        expect(stepConditionCountLabel([condition()])).toBe('1 condition');
        expect(stepConditionCountLabel([condition(), condition({ isActive: false })])).toBe('2 conditions, 1 off');
    });

    it('refuses to publish a Completion condition without a message, not an Entry one', () => {
        expect(stepConditionsPublishProblem(step([condition()]))).toBeNull();
        expect(stepConditionsPublishProblem(step([condition({ conditionType: 'Entry', errorMessage: '' })]))).toBeNull();
        expect(stepConditionsPublishProblem(step([condition({ errorMessage: '  ' })]))).toMatch(/"Region and access".*without a message/);
    });

    it('falls back to a default message per type', () => {
        expect(stepConditionMessage(condition({ errorMessage: 'Mine' }))).toBe('Mine');
        expect(stepConditionMessage(condition({ errorMessage: '' }))).toBe('Step completion conditions not met');
        expect(stepConditionMessage(condition({ conditionType: 'Entry', errorMessage: undefined }))).toMatch(/can't be opened yet/);
    });
});

describe('firstFailedStepCondition', () => {
    const mustAllow = condition({
        conditionJson: serializeStepCondition([{ fieldName: 'AllowEntry', operator: ConditionOperator.Equals, value: true }])
    });

    it('returns the failing active condition of the asked type only', () => {
        const s = step([mustAllow]);
        expect(firstFailedStepCondition(s, 'Completion', { AllowEntry: false }, {})).toBe(mustAllow);
        expect(firstFailedStepCondition(s, 'Completion', { AllowEntry: true }, {})).toBeNull();
        expect(firstFailedStepCondition(s, 'Entry', { AllowEntry: false }, {})).toBeNull();
    });

    it('skips a condition that was switched off; one without the flag counts as active', () => {
        expect(firstFailedStepCondition(step([{ ...mustAllow, isActive: false }]), 'Completion', {}, {})).toBeNull();
        const { isActive, ...withoutFlag } = mustAllow;
        expect(firstFailedStepCondition(step([withoutFlag as StepConditionDto]), 'Completion', {}, {})).not.toBeNull();
    });

    it('counts an emptied list as empty', () => {
        const hasTags = condition({
            conditionJson: serializeStepCondition([{ fieldName: 'Tags', operator: ConditionOperator.IsNotEmpty, value: null }])
        });
        expect(firstFailedStepCondition(step([hasTags]), 'Completion', { Tags: [] }, {})).toBe(hasTags);
        expect(firstFailedStepCondition(step([hasTags]), 'Completion', { Tags: [{ id: 1 }] }, {})).toBeNull();
        const noTags = condition({
            conditionJson: serializeStepCondition([{ fieldName: 'Tags', operator: ConditionOperator.IsEmpty, value: null }])
        });
        expect(firstFailedStepCondition(step([noTags]), 'Completion', { Tags: [] }, {})).toBeNull();
    });

    it('reads an earlier step for a rule marked fromPreviousStep', () => {
        const entry = condition({
            conditionType: 'Entry',
            conditionJson: serializeStepCondition([{ fieldName: 'Name', operator: ConditionOperator.IsNotEmpty, value: null, fromPreviousStep: true }])
        });
        expect(firstFailedStepCondition(step([entry]), 'Entry', {}, { 0: { Name: '' } })).toBe(entry);
        expect(firstFailedStepCondition(step([entry]), 'Entry', {}, { 0: { Name: 'Castle' } })).toBeNull();
    });
});

describe('failedStepConditionFieldNames (PandiO/knk-workspace#414)', () => {
    const rows = (logic: 'AND' | 'OR') => condition({
        conditionJson: serializeStepCondition([
            { fieldName: 'Region', operator: ConditionOperator.IsNotEmpty, value: null },
            { fieldName: 'AllowEntry', operator: ConditionOperator.Equals, value: true }
        ], logic)
    });

    it('a single rule that fails names its field', () => {
        const single = condition({
            conditionJson: serializeStepCondition([{ fieldName: 'Name', operator: ConditionOperator.IsNotEmpty, value: null }])
        });
        expect(failedStepConditionFieldNames(single, { Name: '' }, {})).toEqual(['Name']);
        expect(failedStepConditionFieldNames(single, { Name: 'Old Quarter' }, {})).toEqual([]);
    });

    it('all (AND): only the rules that fail', () => {
        expect(failedStepConditionFieldNames(rows('AND'), { Region: null, AllowEntry: true }, {})).toEqual(['Region']);
        expect(failedStepConditionFieldNames(rows('AND'), { Region: null, AllowEntry: false }, {})).toEqual(['Region', 'AllowEntry']);
        expect(failedStepConditionFieldNames(rows('AND'), { Region: 'r', AllowEntry: true }, {})).toEqual([]);
    });

    it('any (OR): every field when all fail, none when one holds', () => {
        expect(failedStepConditionFieldNames(rows('OR'), { Region: null, AllowEntry: false }, {})).toEqual(['Region', 'AllowEntry']);
        expect(failedStepConditionFieldNames(rows('OR'), { Region: null, AllowEntry: true }, {})).toEqual([]);
    });

    it('a rule on an earlier step reads its value from there', () => {
        const earlier = condition({
            conditionJson: serializeStepCondition([{ fieldName: 'Name', operator: ConditionOperator.IsNotEmpty, value: null, fromPreviousStep: true }])
        });
        expect(failedStepConditionFieldNames(earlier, {}, { 0: { Name: '' } })).toEqual(['Name']);
        expect(failedStepConditionFieldNames(earlier, {}, { 0: { Name: 'x' } })).toEqual([]);
    });

    it('JSON it cannot read marks nothing', () => {
        expect(failedStepConditionFieldNames(condition({ conditionJson: 'not json' }), {}, {})).toEqual([]);
    });
});
