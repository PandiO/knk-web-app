import {
    DependencyCondition,
    FormFieldDto,
    FormStepDto,
    ParsedStepCondition,
    StepConditionDto,
    StepData,
    AllStepsData
} from '../../types/dtos/forms/FormModels';
import { ConditionOperator, FieldType } from '../enums';
import {
    ConditionEvaluator,
    STEP_CONDITION_NO_VALUE_OPERATORS,
    STEP_CONDITION_OPERATORS
} from '../conditionEvaluator';

/**
 * Step conditions (PandiO/knk-workspace#88): the rows the form builder edits, the JSON the wizard
 * evaluates (`ParsedStepCondition`), and the check the wizard runs on Next and on a step jump.
 */

export type StepConditionType = StepConditionDto['conditionType'];

/** What the wizard shows when a condition without its own message fails. */
export const DEFAULT_STEP_CONDITION_MESSAGE: Record<StepConditionType, string> = {
    Completion: 'Step completion conditions not met',
    Entry: 'This step can\'t be opened yet.'
};

export const STEP_CONDITION_OPERATOR_LABELS: Record<string, string> = {
    [ConditionOperator.Equals]: 'is',
    [ConditionOperator.NotEquals]: 'is not',
    [ConditionOperator.GreaterThan]: 'is greater than',
    [ConditionOperator.LessThan]: 'is less than',
    [ConditionOperator.Contains]: 'contains',
    [ConditionOperator.IsEmpty]: 'is empty',
    [ConditionOperator.IsNotEmpty]: 'is not empty'
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * The stored JSON as rows, or null when it is not the shape the builder writes (hand-written or
 * legacy JSON): the builder then shows the raw text instead of rows, so nothing is lost.
 */
export const parseStepConditionJson = (conditionJson: string | undefined | null): ParsedStepCondition | null => {
    if (!conditionJson || !conditionJson.trim()) return { conditions: [], logic: 'AND' };
    let parsed: unknown;
    try {
        parsed = JSON.parse(conditionJson);
    } catch {
        return null;
    }
    if (!isPlainObject(parsed)) return null;
    // "{}" is what the API stores for a condition without rules.
    if (Object.keys(parsed).length === 0) return { conditions: [], logic: 'AND' };
    if (Object.keys(parsed).some(key => key !== 'conditions' && key !== 'logic')) return null;
    const { conditions, logic } = parsed;
    if (logic !== undefined && logic !== 'AND' && logic !== 'OR') return null;
    if (!Array.isArray(conditions)) return null;

    const rows: DependencyCondition[] = [];
    for (const raw of conditions) {
        if (!isPlainObject(raw)) return null;
        if (Object.keys(raw).some(key => !['fieldName', 'operator', 'value', 'fromPreviousStep'].includes(key))) return null;
        if (typeof raw.fieldName !== 'string') return null;
        if (!STEP_CONDITION_OPERATORS.includes(raw.operator as ConditionOperator)) return null;
        if (raw.fromPreviousStep !== undefined && typeof raw.fromPreviousStep !== 'boolean') return null;
        const value = raw.value;
        if (value !== null && value !== undefined && typeof value === 'object') return null;
        rows.push({
            fieldName: raw.fieldName,
            operator: raw.operator as ConditionOperator,
            value: value ?? null,
            ...(raw.fromPreviousStep ? { fromPreviousStep: true } : {})
        });
    }
    return { conditions: rows, logic: logic === 'OR' ? 'OR' : 'AND' };
};

/**
 * Rows to the stored JSON, with a fixed key order so the same rows always give the same text:
 * `{"conditions":[{"fieldName","operator","value","fromPreviousStep"}],"logic":"AND"}`. `value` is
 * left out for IsEmpty / IsNotEmpty and `fromPreviousStep` unless it is true.
 */
export const serializeStepCondition = (rows: DependencyCondition[], logic: 'AND' | 'OR' = 'AND'): string =>
    JSON.stringify({
        conditions: rows.map(row => {
            const out: Record<string, unknown> = { fieldName: row.fieldName, operator: row.operator };
            if (!STEP_CONDITION_NO_VALUE_OPERATORS.includes(row.operator)) out.value = row.value ?? null;
            if (row.fromPreviousStep) out.fromPreviousStep = true;
            return out;
        }),
        logic
    });

const COMPARABLE_FIELD_TYPES: FieldType[] = [
    FieldType.String, FieldType.Integer, FieldType.Decimal, FieldType.Boolean, FieldType.DateTime, FieldType.Enum
];

/**
 * The operators a rule on this field can use. A field that holds an object or a list (a picked
 * entity, a List, a material / enchantment picker, banner layers) can't be compared with a typed
 * value (Equals is ===), so only "is empty" / "is not empty" make sense for it. An unknown field
 * (renamed or removed) keeps every operator, so the stored rule stays readable.
 */
export const stepConditionOperatorsFor = (field: FormFieldDto | undefined): ConditionOperator[] =>
    !field || COMPARABLE_FIELD_TYPES.includes(field.fieldType) ? STEP_CONDITION_OPERATORS : STEP_CONDITION_NO_VALUE_OPERATORS;

/** The value a new or re-pointed rule starts with, in the picked field's own type (Equals compares with ===). */
export const defaultStepConditionValue = (field: FormFieldDto | undefined): unknown =>
    field?.fieldType === FieldType.Boolean ? true : null;

const valueInWords = (value: unknown): string => {
    if (value === true) return 'ticked';
    if (value === false) return 'not ticked';
    if (value === null || value === undefined || value === '') return '(no value)';
    return typeof value === 'string' ? `"${value}"` : String(value);
};

/** "Allow entry is ticked and Name (earlier step) is not empty": a condition without reading JSON. */
export const describeStepCondition = (
    parsed: ParsedStepCondition,
    labelFor: (row: DependencyCondition) => string
): string => {
    if (parsed.conditions.length === 0) return 'No rules yet: this condition always passes.';
    const parts = parsed.conditions.map(row => {
        const subject = `${labelFor(row)}${row.fromPreviousStep ? ' (earlier step)' : ''}`;
        const operator = STEP_CONDITION_OPERATOR_LABELS[row.operator] ?? row.operator;
        return STEP_CONDITION_NO_VALUE_OPERATORS.includes(row.operator)
            ? `${subject} ${operator}`
            : `${subject} ${operator} ${valueInWords(row.value)}`;
    });
    return parts.join(parsed.logic === 'OR' ? ' or ' : ' and ');
};

/** "2 conditions, 1 off" for the card header, so a switched-off condition is visible at a glance. */
export const stepConditionCountLabel = (conditions: StepConditionDto[]): string => {
    if (conditions.length === 0) return 'No conditions';
    const off = conditions.filter(c => c.isActive === false).length;
    const count = `${conditions.length} condition${conditions.length === 1 ? '' : 's'}`;
    return off > 0 ? `${count}, ${off} off` : count;
};

/** A Completion condition needs the message the wizard shows when it fails. */
export const stepConditionNeedsMessage = (condition: StepConditionDto): boolean =>
    condition.conditionType === 'Completion' && !(condition.errorMessage || '').trim();

/** Why a step's conditions can't be published yet, or null. Drafts may hold unfinished conditions. */
export const stepConditionsPublishProblem = (step: FormStepDto): string | null => {
    const missing = (step.conditions || []).filter(stepConditionNeedsMessage).length;
    if (missing === 0) return null;
    const stepName = step.stepName?.trim() || `Step ${step.order + 1}`;
    return missing === 1
        ? `Step "${stepName}" has a "before leaving" condition without a message. Add the message the form shows when it fails.`
        : `Step "${stepName}" has ${missing} "before leaving" conditions without a message. Add the message the form shows when they fail.`;
};

/**
 * The first active condition of the given type that does not hold, or null. A condition is active
 * unless the API says it was switched off (KNG-186).
 */
export const firstFailedStepCondition = (
    step: FormStepDto | undefined,
    type: StepConditionType,
    stepData: StepData,
    allStepsData: AllStepsData
): StepConditionDto | null => {
    for (const condition of step?.conditions || []) {
        if (condition.conditionType !== type || condition.isActive === false) continue;
        if (!ConditionEvaluator.evaluateConditions(condition.conditionJson, stepData, allStepsData)) return condition;
    }
    return null;
};

export const stepConditionMessage = (condition: StepConditionDto): string =>
    (condition.errorMessage || '').trim() || DEFAULT_STEP_CONDITION_MESSAGE[condition.conditionType];

/**
 * PandiO/knk-workspace#414: the fields to mark when a condition fails, i.e. the fields of its rules that don't
 * hold. "All" (AND) marks only the rules that fail; "any" (OR) fails only when every rule fails, so it marks
 * them all; a single rule marks its field. Empty when the condition holds or its JSON can't be read.
 */
export const failedStepConditionFieldNames = (
    condition: StepConditionDto,
    stepData: StepData,
    allStepsData: AllStepsData
): string[] => {
    if (ConditionEvaluator.evaluateConditions(condition.conditionJson, stepData, allStepsData)) return [];
    const parsed = parseStepConditionJson(condition.conditionJson);
    if (!parsed) return [];
    const names = parsed.conditions
        .filter(row => !ConditionEvaluator.evaluateCondition(row, stepData, allStepsData))
        .map(row => row.fieldName);
    return Array.from(new Set(names));
};
