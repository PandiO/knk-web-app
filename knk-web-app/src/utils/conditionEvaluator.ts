import { DependencyCondition, StepData, AllStepsData, ParsedStepCondition } from "./domain/dto/forms/FormModels";
import { ConditionOperator } from "./enums";

export class ConditionEvaluator {
    /**
     * Evaluate a single condition against provided data
     */
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
