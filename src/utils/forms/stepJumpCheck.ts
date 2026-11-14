import { FormFieldDto, FormStepDto, StepConditionDto } from '../../types/dtos/forms/FormModels';
import { ValidationResultDto } from '../../types/dtos/forms/FieldValidationRuleDtos';

/**
 * Jumping to a step from the progress strip (PandiO/knk-workspace#68): the pure parts of the check
 * FormWizard runs for the current step and every step between it and the clicked one.
 */

/** One line in the jump dialog: a field's message, or a step-level one (a condition). */
export interface StepJumpIssue {
    /** Set for a field of the step, so "Go to <step>" can show the message on it. */
    fieldName?: string;
    label?: string;
    message: string;
    /** A failed step condition (PandiO/knk-workspace#414): the step marks the fields it reads. */
    condition?: StepConditionMark;
}

/**
 * A failed step condition the step on screen marks its fields for (PandiO/knk-workspace#414). `entryOf` is the
 * index of the step whose Entry condition it is; without it, it is the shown step's own Completion condition.
 */
export interface StepConditionMark {
    condition: StepConditionDto;
    entryOf?: number;
}

/** Issues of one step, for the dialog's lists. */
export interface StepJumpNote {
    stepName: string;
    issue: StepJumpIssue;
}

export type RuleOutcome = 'ok' | 'blocking' | 'warning' | 'unavailable';

/**
 * What a validation rule's result means for a jump. A rule that could not run (the API sets
 * `metadata.failureReason`, e.g. "PluginUnreachable" when the game server is down) counts as a
 * warning, as siege Readiness does with SpatialChecksUnavailable: it never stops the jump, and the
 * dialog says the check was skipped. A non-blocking rule is a warning too.
 */
export const classifyRuleResult = (result: ValidationResultDto | undefined): RuleOutcome => {
    if (!result || result.isValid) return 'ok';
    if (result.metadata?.failureReason) return 'unavailable';
    return result.isBlocking ? 'blocking' : 'warning';
};

const isEmptyValue = (value: unknown): boolean => value === null || value === undefined || value === '';

const entryName = (entry: Record<string, unknown>, index: number): string => {
    const related = entry.relatedEntity as { name?: unknown; displayName?: unknown } | undefined;
    const name = related?.name ?? related?.displayName;
    return typeof name === 'string' && name.trim() ? name : `Entry ${index + 1}`;
};

/**
 * A many-to-many step has no fields of its own; its entries are filled in on cards whose fields come
 * from the step's child steps. For a jump, every entry's required fields must be filled in.
 */
export const manyToManyEntryIssues = (step: FormStepDto, entries: unknown): StepJumpIssue[] => {
    if (!step.isManyToManyRelationship || !Array.isArray(entries)) return [];
    const fields: FormFieldDto[] = (step.childFormSteps || []).flatMap(child => child.fields || []);
    const issues: StepJumpIssue[] = [];
    entries.forEach((entry, index) => {
        if (!entry || typeof entry !== 'object') return;
        const row = entry as Record<string, unknown>;
        fields.forEach(field => {
            if (field.isRequired && isEmptyValue(row[field.fieldName])) {
                issues.push({
                    label: `${entryName(row, index)}: ${field.label || field.fieldName}`,
                    message: `${field.label || field.fieldName} is required`
                });
            }
        });
    });
    return issues;
};

/** "Region: Region is required" / a step-level message as it is. */
export const stepJumpIssueText = (issue: StepJumpIssue): string =>
    issue.label && !issue.message.startsWith(issue.label) ? `${issue.label}: ${issue.message}` : issue.message;

/**
 * PandiO/knk-workspace#488: the one toast of a refused Next, Submit or Save. One problem says what it is; more say
 * how many, and the summary at the top lists them.
 */
export const refusalToastText = (issues: StepJumpIssue[]): string =>
    issues.length === 1
        ? stepJumpIssueText(issues[0])
        : `Fix the ${issues.length} problems on this step to continue.`;
