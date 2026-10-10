import { AllStepsData, FormConfigurationDto } from '../../types/dtos/forms/FormModels';
import { isEffectivelyEmpty } from './valueProjection';

/**
 * Fields in different steps that bind the same entity property share one value (KNG-120), e.g.
 * the default District form asks for the Location in two steps. Without this, filling the first
 * copy left the second empty, and on submit the later, empty copy overwrote the earlier value.
 *
 * "Same property" means the same fieldName, compared case-insensitively. Many-to-many steps are
 * left out: their value is the step's relationship list, not a field.
 */

interface SharedFieldCopy {
    stepIndex: number;
    fieldName: string;
}

const propertyKey = (fieldName: string): string => fieldName.toLowerCase();

/** Every property bound by more than one field, with its copies in step order. */
export const buildSharedFieldGroups = (config: FormConfigurationDto): SharedFieldCopy[][] => {
    const groups = new Map<string, SharedFieldCopy[]>();
    config.steps.forEach((step, stepIndex) => {
        if (step.isManyToManyRelationship) return;
        step.fields.forEach(field => {
            const key = propertyKey(field.fieldName);
            const copies = groups.get(key) ?? [];
            copies.push({ stepIndex, fieldName: field.fieldName });
            groups.set(key, copies);
        });
    });
    return Array.from(groups.values()).filter(copies => copies.length > 1);
};

const readCopy = (data: AllStepsData, copy: SharedFieldCopy): unknown => data[copy.stepIndex]?.[copy.fieldName];

const hasCopy = (data: AllStepsData, copy: SharedFieldCopy): boolean =>
    !!data[copy.stepIndex] && Object.prototype.hasOwnProperty.call(data[copy.stepIndex], copy.fieldName);

// Normalisation turns a missing key into null; that is not a change worth copying, or it would
// wipe the other copies.
const valueChanged = (before: unknown, after: unknown): boolean =>
    !Object.is(before, after) && !(isEffectivelyEmpty(before) && isEffectivelyEmpty(after));

const writeCopies = (
    data: AllStepsData,
    copies: SharedFieldCopy[],
    value: unknown,
    shouldWrite: (copy: SharedFieldCopy) => boolean
): AllStepsData => {
    let next = data;
    copies.forEach(copy => {
        if (!shouldWrite(copy) || Object.is(readCopy(next, copy), value)) return;
        if (next === data) next = { ...data };
        next[copy.stepIndex] = { ...(next[copy.stepIndex] || {}), [copy.fieldName]: value };
    });
    return next;
};

/**
 * Copies whatever changed between `previous` and `next` into the other copies of the same
 * property, in both directions. If several copies of one property changed at once, the one in
 * `preferStepIndex` (the step the user is on) wins, else the first in step order. Returns `next`
 * itself when nothing needed syncing.
 */
export const syncSharedFieldValues = (
    config: FormConfigurationDto,
    previous: AllStepsData,
    next: AllStepsData,
    preferStepIndex?: number
): AllStepsData => {
    let result = next;
    buildSharedFieldGroups(config).forEach(copies => {
        // A copy absent from `previous` was only just filled in by normalisation, not changed.
        const changed = copies.filter(copy =>
            hasCopy(previous, copy) && hasCopy(next, copy)
            && valueChanged(readCopy(previous, copy), readCopy(next, copy))
        );
        if (changed.length === 0) return;

        const source = changed.find(copy => copy.stepIndex === preferStepIndex) ?? changed[0];
        const value = readCopy(result, source);
        result = writeCopies(result, copies, value, copy => copy !== source);
    });
    return result;
};

/**
 * Fills empty copies from the first non-empty copy of the same property. Used where data arrives
 * without a change to diff against (a resumed draft saved before KNG-120). Copies that already
 * hold a value are left alone.
 */
export const fillEmptySharedFieldValues = (
    config: FormConfigurationDto,
    data: AllStepsData
): AllStepsData => {
    let result = data;
    buildSharedFieldGroups(config).forEach(copies => {
        const source = copies.find(copy => !isEffectivelyEmpty(readCopy(result, copy)));
        if (!source) return;
        const value = readCopy(result, source);
        result = writeCopies(result, copies, value, copy => isEffectivelyEmpty(readCopy(result, copy)));
    });
    return result;
};
