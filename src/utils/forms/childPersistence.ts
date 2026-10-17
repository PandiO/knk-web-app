import { FormFieldDto } from '../../types/dtos/forms/FormModels';
import { FieldType } from '../enums';

/**
 * KNG-133 / design decision D1 = A ("save the children as soon as possible", developer 2026-10-11):
 * decides whether a child form opened from a relationship field ("Create New", "Edit instance",
 * "Continue draft") saves its entity through the entity's own create/update API when it completes,
 * instead of leaving the values in the parent form's state for the parent's own save.
 *
 * - **List** relationship fields (any `objectType`, owned collection or not): always saved. The
 *   parent's save only ever sends a List relationship as ids (`DistrictIds`, `GuardSpawnLocationIds`,
 *   see `normalizeFormSubmission`'s collection handling), so an unsaved item has no way to reach the
 *   database. Before KNG-133 a non-owned List child (Street -> Districts) stayed an id-less object
 *   and was dropped without a word when the parent was submitted.
 * - **Object** relationship fields: saved, except a single **Location**. A Location is an embedded
 *   value object: the API creates/updates it from the parent's payload
 *   (`ResolveLocationReferenceAsync`), so it stays unsaved until the parent saves.
 * - Anything else (scalars, a List without `objectType`): not a child entity, never saved here.
 */
export function shouldPersistChildOnComplete(
    field: Pick<FormFieldDto, 'fieldType' | 'objectType'>
): boolean {
    if (!field.objectType) {
        return false;
    }

    if (field.fieldType === FieldType.List) {
        return true;
    }

    if (field.fieldType === FieldType.Object) {
        return field.objectType.toLowerCase() !== 'location';
    }

    return false;
}
