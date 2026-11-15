import { DraftValidationRuleDto, FormConfigurationDto, FormFieldDto, FormStepDto } from '../../types/dtos/forms/FormModels';

/**
 * PandiO/knk-workspace#291: field validation rules in the form builder's working copy. They are kept in
 * `config.validationRules`, keyed by field GUID, saved with the draft and applied by the API on Publish; the form
 * wizard keeps the published rules until then.
 */

/** What the rule builder produces: a rule without its field and published id. */
export type DraftRuleInput = Omit<DraftValidationRuleDto, 'id' | 'fieldGuid'>;

const sameGuid = (a?: string | null, b?: string | null) => !!a && !!b && a.toLowerCase() === b.toLowerCase();

/** Every field of the working copy, child form steps included. */
export function configurationFields(config: FormConfigurationDto): FormFieldDto[] {
    const visit = (steps: FormStepDto[] | undefined): FormFieldDto[] =>
        (steps ?? []).flatMap(step => [...(step.fields ?? []), ...visit(step.childFormSteps)]);
    return visit(config.steps);
}

/** The rules of one field, in the order they were added. */
export function rulesOfField(rules: DraftValidationRuleDto[] | undefined, fieldGuid: string | undefined): DraftValidationRuleDto[] {
    if (!fieldGuid) return [];
    return (rules ?? []).filter(rule => sameGuid(rule.fieldGuid, fieldGuid));
}

/** The list with one field's rules replaced (the other fields' rules keep their place). */
export function withFieldRules(
    rules: DraftValidationRuleDto[] | undefined,
    fieldGuid: string,
    fieldRules: DraftValidationRuleDto[]
): DraftValidationRuleDto[] {
    const others = (rules ?? []).filter(rule => !sameGuid(rule.fieldGuid, fieldGuid));
    return [...others, ...fieldRules.map(rule => ({ ...rule, fieldGuid }))];
}

/** A rule for the field from the rule builder's input; editing keeps the published rule's id. */
export function draftRuleFrom(fieldGuid: string, input: DraftRuleInput, editing?: DraftValidationRuleDto): DraftValidationRuleDto {
    const rule: DraftValidationRuleDto = {
        ...input,
        fieldGuid,
        dependsOnFieldGuid: input.dependsOnFieldGuid || null,
        dependsOnFieldId: input.dependsOnFieldGuid ? null : input.dependsOnFieldId ?? null
    };
    if (editing?.id !== undefined) rule.id = editing.id;
    return rule;
}

/**
 * The rules worth saving: a rule whose field is no longer in the form goes (it can't be seen or edited any more). A
 * rule whose dependency went stays, so the builder can show it and Publish names it. Undefined stays undefined (no
 * list: the published rules, unchanged).
 */
export function rulesOfExistingFields(config: FormConfigurationDto): DraftValidationRuleDto[] | undefined {
    if (!config.validationRules) return undefined;
    const guids = configurationFields(config).map(f => f.fieldGuid).filter((g): g is string => !!g);
    return config.validationRules.filter(rule => guids.some(g => sameGuid(g, rule.fieldGuid)));
}

/** Why the working copy's rules can't be published (null when they can); the API checks the same. */
export function validationRulesPublishProblem(config: FormConfigurationDto): string | null {
    const fields = configurationFields(config);
    const find = (guid?: string | null) => fields.find(f => sameGuid(f.fieldGuid, guid));
    for (const rule of rulesOfExistingFields(config) ?? []) {
        const field = find(rule.fieldGuid);
        const where = `The ${rule.validationType || 'untyped'} rule on "${field?.label || field?.fieldName || 'a field'}"`;
        if (rule.dependsOnFieldGuid) {
            if (!find(rule.dependsOnFieldGuid)) return `${where} depends on a field that is no longer in the form. Edit or delete the rule.`;
            if (sameGuid(rule.dependsOnFieldGuid, rule.fieldGuid)) return `${where} can't depend on its own field.`;
        }
    }
    return null;
}

export interface RuleChanges {
    added: number;
    changed: number;
    removed: number;
}

const ruleContent = (rule: DraftValidationRuleDto) => JSON.stringify([
    rule.fieldGuid?.toLowerCase(),
    rule.dependsOnFieldGuid?.toLowerCase() ?? null,
    rule.dependsOnFieldGuid ? null : rule.dependsOnFieldId ?? null,
    rule.validationType,
    rule.dependencyPath || null,
    rule.configJson || '{}',
    rule.errorMessage ?? '',
    rule.successMessage || null,
    !!rule.isBlocking,
    !!rule.requiresDependencyFilled
]);

/** What Publish changes in the rules: published (by id) against the working copy. No working list: nothing. */
export function countRuleChanges(
    published: DraftValidationRuleDto[] | undefined,
    working: DraftValidationRuleDto[] | undefined
): RuleChanges {
    if (!working) return { added: 0, changed: 0, removed: 0 };
    const before = new Map((published ?? []).filter(r => r.id !== undefined).map(r => [r.id!, r]));
    let added = 0;
    let changed = 0;
    const kept = new Set<number>();
    for (const rule of working) {
        const old = rule.id !== undefined ? before.get(rule.id) : undefined;
        if (!old || kept.has(rule.id!)) {
            added++;
            continue;
        }
        kept.add(rule.id!);
        if (ruleContent(old) !== ruleContent(rule)) changed++;
    }
    return { added, changed, removed: before.size - kept.size };
}

/** "Validation rules: 1 added, 2 changed." or null without changes. */
export function describeRuleChanges(changes: RuleChanges): string | null {
    const parts = [
        changes.added ? `${changes.added} added` : null,
        changes.changed ? `${changes.changed} changed` : null,
        changes.removed ? `${changes.removed} removed` : null
    ].filter(Boolean);
    return parts.length > 0 ? `Validation rules: ${parts.join(', ')}.` : null;
}
