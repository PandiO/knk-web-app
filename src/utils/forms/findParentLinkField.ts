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
