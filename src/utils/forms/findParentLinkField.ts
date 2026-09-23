import { FormConfigurationDto, FormFieldDto } from '../../types/dtos/forms/FormModels';
import { FieldType } from '../enums';

/**
 * Given a child (or join) entity's own FormConfiguration and a parent entity type name, finds
 * the field on that config which links back to the parent - an Object-type field whose
 * objectType matches parentEntityTypeName (e.g. GateDoor's "GateStructureId" field, when the
 * parent type is "GateStructure").
 *
 * Shared by ChildFormModal (to prefill that field with the parent's identity when opening a
 * nested "Create New" wizard) and the relationship-drafts feature (to know which saved field to
 * filter FormSubmissionProgress rows by). Returns null if no such field exists.
 */
export function findParentLinkField(
    childConfig: FormConfigurationDto | null | undefined,
    parentEntityTypeName: string | null | undefined
): FormFieldDto | null {
    if (!childConfig || !parentEntityTypeName) {
        return null;
    }

    // A self-referencing entity (e.g. Category -> ParentCategoryId -> Category) has its own field
    // whose objectType coincidentally equals its own entity type - genuinely different from "the
    // field that links back to the wizard this child was opened from", and objectType alone can't
    // tell the two apart. Never guess here: found live (2026-09-23) that creating a new Category's
    // own Parent Category inline pre-filled the *new* category's ParentCategoryId with the
    // (unsaved, id=-1) snapshot of the category being created *for*, which then failed the real
    // create call outright with a foreign key constraint violation, since -1 isn't a real row.
    // Case-insensitive: this codebase's entityName prop is inconsistently either the raw
    // lowercase :entityName route segment or the backend's correctly-cased entityTypeName,
    // depending on call site (the same casing-bug class Phase 2/3 already fixed at several other
    // entityName-vs-metadata comparison sites) - a strict === here would silently fail to catch
    // the self-reference case whenever parentEntityTypeName happens to arrive lowercase.
    if (childConfig.entityTypeName.toLowerCase() === parentEntityTypeName.toLowerCase()) {
        return null;
    }

    for (const step of childConfig.steps) {
        const linkField = step.fields.find(
            f => f.fieldType === FieldType.Object && f.objectType === parentEntityTypeName
        );
        if (linkField) {
            return linkField;
        }
    }

    return null;
}
