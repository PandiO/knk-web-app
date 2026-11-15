import { DraftValidationRuleDto, FormConfigurationDto, FormFieldDto } from '../../../types/dtos/forms/FormModels';
import { FieldType } from '../../enums';
import {
    countRuleChanges,
    describeRuleChanges,
    draftRuleFrom,
    rulesOfExistingFields,
    rulesOfField,
    validationRulesPublishProblem,
    withFieldRules
} from '../draftValidationRules';
import { formConfigForSave } from '../../../components/FormConfigBuilder/FormConfigBuilder';
import { summarizeFormPublish } from '../../configBuilder/publishSummary';

// PandiO/knk-workspace#291: validation rules in the form builder's draft, keyed by field GUID.

// formConfigForSave lives next to the builder page, which imports the router.
jest.mock('react-router-dom', () => ({ useNavigate: jest.fn(), useParams: jest.fn() }), { virtual: true });

const field = (guid: string, label: string, id?: string): FormFieldDto => ({
    id: id ?? `temp-${guid}`,
    fieldGuid: guid,
    fieldName: label.toLowerCase(),
    label,
    fieldType: FieldType.String,
    isRequired: false,
    order: 0,
    isReadOnly: false,
    isReusable: false,
    isLinkedToSource: false,
    hasCompatibilityIssues: false,
    validations: []
});

const rule = (fieldGuid: string, extra: Partial<DraftValidationRuleDto> = {}): DraftValidationRuleDto => ({
    fieldGuid,
    validationType: 'LocationInsideRegion',
    configJson: '{}',
    errorMessage: 'Outside the town',
    isBlocking: true,
    requiresDependencyFilled: false,
    ...extra
});

const config = (fields: FormFieldDto[], validationRules?: DraftValidationRuleDto[]): FormConfigurationDto => ({
    id: '7',
    entityTypeName: 'District',
    configurationName: 'District form',
    isDefault: true,
    steps: [{
        stepGuid: 's1',
        stepName: 'General',
        order: 0,
        fieldOrderJson: '[]',
        isReusable: false,
        isLinkedToSource: false,
        hasCompatibilityIssues: false,
        isManyToManyRelationship: false,
        childFormSteps: [],
        fields,
        conditions: []
    }],
    validationRules
});

describe('draft validation rules (#291)', () => {
    it('keeps one field\'s rules apart and replaces only those', () => {
        const rules = [rule('a', { id: 1 }), rule('b', { id: 2 }), rule('a', { id: 3 })];

        expect(rulesOfField(rules, 'A').map(r => r.id)).toEqual([1, 3]);
        const next = withFieldRules(rules, 'a', [rule('a', { id: 3, errorMessage: 'Edited' })]);
        expect(next.map(r => [r.id, r.fieldGuid, r.errorMessage])).toEqual([[2, 'b', 'Outside the town'], [3, 'a', 'Edited']]);
        expect(rulesOfField(undefined, 'a')).toEqual([]);
        expect(rulesOfField(rules, undefined)).toEqual([]);
    });

    it('builds a rule for a draft-only field from the rule builder, keeping the published id when editing', () => {
        const input = { validationType: 'RegionContainment', dependsOnFieldGuid: 'town', dependsOnFieldId: 12, configJson: '{}', errorMessage: 'x', isBlocking: false, requiresDependencyFilled: true };

        const added = draftRuleFrom('new-field', input);
        expect(added).toMatchObject({ fieldGuid: 'new-field', dependsOnFieldGuid: 'town', dependsOnFieldId: null });
        expect(added).not.toHaveProperty('id');
        expect(draftRuleFrom('f', { ...input, dependsOnFieldGuid: null }, rule('f', { id: 9 }))).toMatchObject({ id: 9, dependsOnFieldId: 12, dependsOnFieldGuid: null });
    });

    it('saves only rules whose field is still in the form; no list stays no list', () => {
        const c = config([field('a', 'Town')], [rule('a', { id: 1 }), rule('gone', { id: 2 })]);

        expect(rulesOfExistingFields(c)!.map(r => r.id)).toEqual([1]);
        expect(formConfigForSave(c).validationRules!.map(r => r.id)).toEqual([1]);
        expect(rulesOfExistingFields(config([field('a', 'Town')]))).toBeUndefined();
        expect(formConfigForSave(config([field('a', 'Town')])).validationRules).toBeUndefined();
    });

    it('refuses to publish a rule whose dependency left the form', () => {
        const fields = [field('a', 'Town'), field('b', 'Location')];

        expect(validationRulesPublishProblem(config(fields, [rule('b', { dependsOnFieldGuid: 'a' })]))).toBeNull();
        expect(validationRulesPublishProblem(config(fields, [rule('b', { dependsOnFieldGuid: 'zzz' })])))
            .toBe('The LocationInsideRegion rule on "Location" depends on a field that is no longer in the form. Edit or delete the rule.');
        expect(validationRulesPublishProblem(config(fields, [rule('b', { dependsOnFieldGuid: 'b' })]))).toContain("can't depend on its own field");
        // A parent form's field is referenced by id and checked by the API.
        expect(validationRulesPublishProblem(config(fields, [rule('b', { dependsOnFieldId: 40 })]))).toBeNull();
    });

    it('counts what Publish changes in the rules', () => {
        const published = [rule('a', { id: 1 }), rule('a', { id: 2 }), rule('b', { id: 3 })];
        const working = [
            rule('a', { id: 1 }),
            rule('a', { id: 2, errorMessage: 'Edited' }),
            rule('c'),
            rule('c')
        ];

        const changes = countRuleChanges(published, working);
        expect(changes).toEqual({ added: 2, changed: 1, removed: 1 });
        expect(describeRuleChanges(changes)).toBe('Validation rules: 2 added, 1 changed, 1 removed.');
        expect(describeRuleChanges(countRuleChanges(published, published))).toBeNull();
        // A draft without the list keeps the published rules: nothing changes.
        expect(countRuleChanges(published, undefined)).toEqual({ added: 0, changed: 0, removed: 0 });
    });

    it('treats a missing optional value like an empty one when comparing', () => {
        const published = [rule('a', { id: 1, dependsOnFieldGuid: undefined, successMessage: undefined })];
        const working = [rule('a', { id: 1, dependsOnFieldGuid: null, dependsOnFieldId: null, successMessage: null })];

        expect(countRuleChanges(published, working)).toEqual({ added: 0, changed: 0, removed: 0 });
    });

    it('names rule changes in the Publish question, even when nothing else changed', () => {
        const fields = [field('a', 'Town', '5')];
        const published = config(fields, [rule('a', { id: 1 })]);
        const working = config(fields, [rule('a', { id: 1 }), rule('a')]);

        expect(summarizeFormPublish(published, working).lines).toEqual(['Validation rules: 1 added.']);
        expect(summarizeFormPublish(published, published).lines).toEqual([]);
    });
});
