import { deriveGateGeometryStepData } from './gateGeometry';

type StepValues = Record<string, unknown>;
type StepsValues = { [stepIndex: number]: StepValues | undefined };

const EMPTY = undefined;

/**
 * A value in a form that compares equal to every other way of writing the same thing: '' / null /
 * undefined / [] / an object without values are all "empty" (dropped), a number and its text are the
 * same, object keys are sorted. Returns undefined for an empty value.
 */
const canonicalValue = (value: unknown): unknown => {
    if (value === undefined || value === null || value === '') return EMPTY;
    if (Array.isArray(value)) {
        if (value.length === 0) return EMPTY;
        // Keep the positions: an empty entry in a list is still an entry.
        return value.map(item => {
            const canonical = canonicalValue(item);
            return canonical === EMPTY ? null : canonical;
        });
    }
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'object') {
        const entries = Object.keys(value as Record<string, unknown>)
            .sort()
            .map(key => [key, canonicalValue((value as Record<string, unknown>)[key])] as const)
            .filter(([, canonical]) => canonical !== EMPTY);
        return entries.length === 0 ? EMPTY : Object.fromEntries(entries);
    }
    // 5 and "5", true and "true": what a field shows is the same.
    return String(value);
};

/**
 * #109 (link 5 fix round): a comparable snapshot of every step's values, used for the form's
 * "unsaved changes" state. Two snapshots are equal when the form holds the same values, however
 * they got there (typed and cleared again, a step normalised by Next/Previous, a field moved to the
 * hidden stash by a display condition). Values parked in `hiddenStash` count as the form's values,
 * so hiding and showing a field again is not a change; derived gate geometry is recomputed on both
 * sides so it never differs on its own.
 */
export const formValuesSnapshot = (
    entityName: string,
    allStepsData: StepsValues,
    hiddenStash: StepsValues = {}
): string => {
    const stepKeys = new Set<string>([...Object.keys(allStepsData), ...Object.keys(hiddenStash)]);
    const steps: Record<string, unknown> = {};
    Array.from(stepKeys)
        .sort((a, b) => Number(a) - Number(b))
        .forEach(stepKey => {
            const visible = allStepsData[Number(stepKey)] ?? {};
            const merged: StepValues = { ...(hiddenStash[Number(stepKey)] ?? {}) };
            Object.entries(visible).forEach(([fieldName, value]) => {
                // A hidden field has its value in the stash; an empty copy of it in the step must not
                // hide that value.
                if (canonicalValue(value) !== EMPTY || !(fieldName in merged)) merged[fieldName] = value;
            });
            const canonical = canonicalValue(deriveGateGeometryStepData(entityName, merged));
            if (canonical !== EMPTY) steps[stepKey] = canonical;
        });
    return JSON.stringify(steps);
};

/** True when two value sets hold the same values (see formValuesSnapshot). */
export const sameFormValues = (
    entityName: string,
    a: StepsValues,
    b: StepsValues
): boolean => formValuesSnapshot(entityName, a) === formValuesSnapshot(entityName, b);
