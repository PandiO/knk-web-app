import {
    DependencyCondition,
    DisplayConditionDto,
    DisplayConditionGroupDto,
    StepData,
    AllStepsData,
    ParsedStepCondition
} from "../types/dtos/forms/FormModels";
import { ConditionOperator, DisplayConditionLogic } from "./enums";

const isBlank = (value: unknown): boolean =>
    value === null || value === undefined || value === '' ||
    (Array.isArray(value) && value.length === 0);

const toText = (value: unknown): string | null => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'object') {
        // Object-typed fields hold the selected entity; compare on its identifier.
        const candidate = value as Record<string, unknown>;
        if ('id' in candidate) return toText(candidate.id);
        return JSON.stringify(value);
    }
    return String(value);
};

const toNumber = (value: unknown): number | null => {
    if (value === null || value === undefined || typeof value === 'boolean') return null;
    if (typeof value === 'number') return Number.isNaN(value) ? null : value;
    const text = toText(value);
    if (text === null || text.trim() === '') return null;
    const parsed = Number(text);
    return Number.isNaN(parsed) ? null : parsed;
};

const toBool = (value: unknown): boolean | null => {
    if (typeof value === 'boolean') return value;
    const text = toText(value);
    if (text === 'true') return true;
    if (text === 'false') return false;
    return null;
};

const scalarEquals = (actual: unknown, expected: unknown): boolean => {
    const actualNum = toNumber(actual);
    const expectedNum = toNumber(expected);
    if (actualNum !== null && expectedNum !== null) return actualNum === expectedNum;

    const actualBool = toBool(actual);
    const expectedBool = toBool(expected);
    if (actualBool !== null && expectedBool !== null) return actualBool === expectedBool;

    const actualText = toText(actual);
    const expectedText = toText(expected);
    if (actualText === null || expectedText === null) return actualText === expectedText;
    return actualText.toLowerCase() === expectedText.toLowerCase();
};

const parseValueJson = (valueJson: string | undefined): unknown => {
    if (valueJson === undefined || valueJson === null || valueJson === '') return null;
    try {
        return JSON.parse(valueJson);
    } catch {
        // Tolerate values that were stored as a bare string instead of JSON.
        return valueJson;
    }
};

const compare = (actual: unknown, operator: ConditionOperator, valueJson: string): boolean => {
    if (operator === ConditionOperator.IsEmpty) return isBlank(actual);
    if (operator === ConditionOperator.IsNotEmpty) return !isBlank(actual);

    const expected = parseValueJson(valueJson);

    switch (operator) {
        case ConditionOperator.Equals:
            return scalarEquals(actual, expected);
        case ConditionOperator.NotEquals:
            return !scalarEquals(actual, expected);
        case ConditionOperator.In:
            return (Array.isArray(expected) ? expected : [expected]).some(e => scalarEquals(actual, e));
        case ConditionOperator.NotIn:
            return !(Array.isArray(expected) ? expected : [expected]).some(e => scalarEquals(actual, e));
        case ConditionOperator.Contains: {
            const haystack = toText(actual);
            const needle = toText(expected);
            if (haystack === null || needle === null) return false;
            return haystack.toLowerCase().includes(needle.toLowerCase());
        }
        case ConditionOperator.GreaterThan:
        case ConditionOperator.GreaterOrEqual:
        case ConditionOperator.LessThan:
        case ConditionOperator.LessOrEqual: {
            const a = toNumber(actual);
            const b = toNumber(expected);
            if (a === null || b === null) return false;
            if (operator === ConditionOperator.GreaterThan) return a > b;
            if (operator === ConditionOperator.GreaterOrEqual) return a >= b;
            if (operator === ConditionOperator.LessThan) return a < b;
            return a <= b;
        }
        default:
            return false;
    }
};

export class DisplayConditionEvaluator {
    /**
     * `visibleValues` is keyed by field name and must only contain values from fields the user can
     * currently see, so a hidden branch can never satisfy a condition.
     */
    static evaluateCondition(
        condition: DisplayConditionDto,
        visibleValues: Record<string, unknown>,
        fieldNameByGuid: Record<string, string>
    ): boolean {
        const fieldName = fieldNameByGuid[condition.sourceFieldGuid];
        const actual = fieldName ? visibleValues[fieldName] : undefined;
        return compare(actual, condition.operator, condition.valueJson);
    }

    static evaluateGroup(
        group: DisplayConditionGroupDto,
        visibleValues: Record<string, unknown>,
        fieldNameByGuid: Record<string, string>
    ): boolean {
        const conditions = [...group.conditions].sort((a, b) => a.order - b.order);
        if (conditions.length === 0) return true;

        const results = conditions.map(c => this.evaluateCondition(c, visibleValues, fieldNameByGuid));
        return group.innerLogic === DisplayConditionLogic.And
            ? results.every(Boolean)
            : results.some(Boolean);
    }

    /**
     * A target with no active groups is always visible. Groups are folded left-to-right,
     * matching the server-side evaluator exactly.
     */
    static isVisible(
        groups: DisplayConditionGroupDto[] | undefined,
        visibleValues: Record<string, unknown>,
        fieldNameByGuid: Record<string, string>
    ): boolean {
        const active = (groups ?? []).filter(g => g.isActive).sort((a, b) => a.order - b.order);
        if (active.length === 0) return true;

        let result = this.evaluateGroup(active[0], visibleValues, fieldNameByGuid);
        for (let i = 1; i < active.length; i++) {
            const next = this.evaluateGroup(active[i], visibleValues, fieldNameByGuid);
            result = active[i].combineWithPreviousLogic === DisplayConditionLogic.And
                ? result && next
                : result || next;
        }
        return result;
    }
}

/**
 * Handles the older StepCondition entry/completion gating, which decides whether a user may
 * proceed rather than what is shown.
 */
export class ConditionEvaluator {
    static evaluateCondition(
        condition: DependencyCondition,
        currentStepData: StepData,
        allStepsData: AllStepsData
    ): boolean {
        const value = condition.fromPreviousStep
            ? this.findFieldInPreviousSteps(condition.fieldName, allStepsData)
            : currentStepData[condition.fieldName];

        switch (condition.operator) {
            case ConditionOperator.Equals:
                return value === condition.value;
            case ConditionOperator.NotEquals:
                return value !== condition.value;
            case ConditionOperator.GreaterThan:
                return Number(value) > Number(condition.value);
            case ConditionOperator.LessThan:
                return Number(value) < Number(condition.value);
            case ConditionOperator.Contains:
                return String(value).includes(String(condition.value));
            case ConditionOperator.IsEmpty:
                return value === null || value === undefined || value === '';
            case ConditionOperator.IsNotEmpty:
                return value !== null && value !== undefined && value !== '';
            default:
                return false;
        }
    }

    /**
     * Evaluate multiple conditions with AND/OR logic
     */
    static evaluateConditions(
        conditionsJson: string | undefined,
        currentStepData: StepData,
        allStepsData: AllStepsData
    ): boolean {
        if (!conditionsJson) return true;

        try {
            const parsed: ParsedStepCondition = JSON.parse(conditionsJson);
            const { conditions, logic = 'AND' } = parsed;

            if (!conditions || conditions.length === 0) return true;

            const results = conditions.map(cond =>
                this.evaluateCondition(cond, currentStepData, allStepsData)
            );

            return logic === 'AND'
                ? results.every(r => r)
                : results.some(r => r);
        } catch (e) {
            console.error('Failed to parse condition JSON:', e);
            return false;
        }
    }

    /**
     * Find field value from previous steps
     */
    private static findFieldInPreviousSteps(fieldName: string, allStepsData: AllStepsData): any {
        const stepIndices = Object.keys(allStepsData).map(Number).sort((a, b) => b - a);
        for (const index of stepIndices) {
            if (allStepsData[index][fieldName] !== undefined) {
                return allStepsData[index][fieldName];
            }
        }
        return undefined;
    }
}
