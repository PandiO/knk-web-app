import { AllStepsData, FormConfigurationDto, FormFieldDto } from '../../types/dtos/forms/FormModels';
import { findValueByFieldName } from '../fieldNameMapper';
import { resolveObjectFieldValueForEdit } from './objectFieldEditValue';

/**
 * KNG-134 (spec FORM_WIZARD_SESSION_CONCEPTS.md §3.4): "Edit instance" seeds the child form from
 * the value the parent form holds, not only from the database.
 *
 * - A value **without an id** (a Location captured by a Minecraft world task, an item of an old
 *   draft) has nothing to load, so every field is seeded from it.
 * - A value **with an id** whose edits only live in the parent's state (an embedded Location edited
 *   earlier in this session, KNG-130) is loaded from the database and then overlaid with it, so a
 *   second edit shows the first edit's values.
 *
 * Values are matched to fields by case-insensitive name and go through the same FK/navigation
 * mapping as an edit-mode load (`resolveObjectFieldValueForEdit`), so a relationship field gets the
 * object shape its picker shows as selected. Many-to-many steps are left alone: their join rows
 * always come from the database load.
 */

/** True for a value "Edit instance" can seed a child form from (a plain object, not an id or array). */
export function isSeedableInstance(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function seedFields(cfg: FormConfigurationDto): FormFieldDto[] {
    return cfg.steps
        .filter(step => !step.isManyToManyRelationship)
        .flatMap(step => step.fields ?? []);
}

/**
 * The child form's field values, keyed by each field's own `fieldName`, taken from the instance
 * the parent holds. Fields the instance has no value for are left out (they keep their defaults or
 * the loaded value).
 */
export function buildChildEditSeedValues(
    cfg: FormConfigurationDto | null | undefined,
    instance: unknown
): Record<string, unknown> {
    if (!cfg || !isSeedableInstance(instance)) {
        return {};
    }

    const seed: Record<string, unknown> = {};
    seedFields(cfg).forEach(field => {
        const raw = findValueByFieldName(instance, field.fieldName);
        const resolved = resolveObjectFieldValueForEdit(instance, field, raw);
        // resolveObjectFieldValueForEdit falls back to the field's default when the instance has no
        // value at all; that is not something the parent holds, so it is not seeded.
        if (raw === undefined && resolved === (field.defaultValue ?? null)) {
            return;
        }
        if (resolved === undefined) {
            return;
        }
        seed[field.fieldName] = resolved;
    });
    return seed;
}

/**
 * Lays the seed values over steps data loaded from the database: a seeded field wins, every other
 * field keeps what was loaded. Returns a new object; the input is not changed.
 */
export function overlayChildEditValues(
    cfg: FormConfigurationDto,
    stepsData: AllStepsData,
    seed: Record<string, unknown> | undefined
): AllStepsData {
    if (!seed || Object.keys(seed).length === 0) {
        return stepsData;
    }

    const overlaid: AllStepsData = { ...stepsData };
    cfg.steps.forEach((step, stepIndex) => {
        if (step.isManyToManyRelationship) {
            return;
        }
        const next = { ...(overlaid[stepIndex] || {}) };
        let changed = false;
        (step.fields ?? []).forEach(field => {
            if (Object.prototype.hasOwnProperty.call(seed, field.fieldName)) {
                next[field.fieldName] = seed[field.fieldName];
                changed = true;
            }
        });
        if (changed) {
            overlaid[stepIndex] = next;
        }
    });
    return overlaid;
}
