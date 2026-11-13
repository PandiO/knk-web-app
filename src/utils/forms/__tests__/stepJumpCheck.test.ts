import { FormStepDto } from '../../../types/dtos/forms/FormModels';
import { classifyRuleResult, manyToManyEntryIssues, stepJumpIssueText } from '../stepJumpCheck';

// PandiO/knk-workspace#68: the pure parts of the step-jump check.

describe('classifyRuleResult', () => {
    it('passes a valid or missing result', () => {
        expect(classifyRuleResult(undefined)).toBe('ok');
        expect(classifyRuleResult({ isValid: true, isBlocking: true })).toBe('ok');
    });

    it('tells a blocking failure from a warning', () => {
        expect(classifyRuleResult({ isValid: false, isBlocking: true })).toBe('blocking');
        expect(classifyRuleResult({ isValid: false, isBlocking: false })).toBe('warning');
    });

    it('treats a rule that could not run as unavailable, even when the rule is blocking', () => {
        const result = {
            isValid: false,
            isBlocking: true,
            metadata: { validationType: 'RegionContainment', executedAt: '', failureReason: 'PluginUnreachable' }
        };
        expect(classifyRuleResult(result)).toBe('unavailable');
    });
});

describe('manyToManyEntryIssues', () => {
    const step = {
        isManyToManyRelationship: true,
        childFormSteps: [{ fields: [
            { fieldName: 'InitialState', label: 'Initial state', isRequired: true },
            { fieldName: 'Note', label: 'Note', isRequired: false }
        ] }]
    } as unknown as FormStepDto;

    it('names every entry with an empty required field', () => {
        const issues = manyToManyEntryIssues(step, [
            { relatedEntity: { name: 'North gate' }, InitialState: 'Closed' },
            { relatedEntity: { name: 'South gate' }, InitialState: '' },
            { InitialState: null }
        ]);
        expect(issues.map(stepJumpIssueText)).toEqual([
            'South gate: Initial state: Initial state is required',
            'Entry 3: Initial state: Initial state is required'
        ]);
    });

    it('has nothing to say about an empty list, a step without entry fields or an ordinary step', () => {
        expect(manyToManyEntryIssues(step, [])).toEqual([]);
        expect(manyToManyEntryIssues(step, undefined)).toEqual([]);
        expect(manyToManyEntryIssues({ ...step, childFormSteps: [] } as FormStepDto, [{}])).toEqual([]);
        expect(manyToManyEntryIssues({ ...step, isManyToManyRelationship: false } as FormStepDto, [{}])).toEqual([]);
    });
});

describe('stepJumpIssueText', () => {
    it('puts the label in front unless the message already starts with it', () => {
        expect(stepJumpIssueText({ label: 'Region', message: 'must be inside the town' })).toBe('Region: must be inside the town');
        expect(stepJumpIssueText({ label: 'Name', message: 'Name is required' })).toBe('Name is required');
        expect(stepJumpIssueText({ message: 'Allow entry before you continue.' })).toBe('Allow entry before you continue.');
    });
});
