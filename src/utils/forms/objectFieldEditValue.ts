import { FormFieldDto } from '../../types/dtos/forms/FormModels';
import { FieldType } from '../enums';
import { findValueByFieldName } from '../fieldNameMapper';

/**
 * Resolves the value an edit-mode FormWizard pre-fills into a field from the loaded entity DTO.
 *
 * Object fields can be authored on either side of an FK/navigation pair, and the DTO may only
 * carry one side of it:
 * - FK-authored ("AnchorPointId"): the DTO has the bare integer under that name, but ObjectField
 *   needs the populated navigation object (with id/name/...) under "AnchorPoint" to render it.
 *   When the DTO has no navigation object but a display name ("TownId" + "TownName"), build
 *   `{ id, name }` from those instead.
 * - Navigation-authored ("Helmet"): normally the DTO carries the object under that name. When it
 *   only exposes the FK ("HelmetId"), fall back to a bare `{ id }` so the picker isn't loaded empty -
 *   otherwise an untouched submit would write null over the existing FK.
 */
export function resolveObjectFieldValueForEdit(
    entityData: Record<string, unknown>,
    field: FormFieldDto,
    rawValue: unknown
): unknown {
    if (field.fieldType === FieldType.Object) {
        const isForeignKeyField = /Id$/.test(field.fieldName);

        if (isForeignKeyField && rawValue !== null && rawValue !== undefined && typeof rawValue !== 'object') {
            const navValue = findValueByFieldName(entityData, field.fieldName.slice(0, -2));
            if (navValue && typeof navValue === 'object') {
                return navValue;
            }
            // Many read DTOs carry only the FK plus a display name (e.g. the siege DTOs' townId +
            // townName) - build a minimal {id, name} so the field shows what's selected. extractId()
            // still submits the same id.
            const displayName = findValueByFieldName(entityData, `${field.fieldName.slice(0, -2)}Name`);
            if (typeof displayName === 'string' && displayName.length > 0) {
                return { id: rawValue, name: displayName };
            }
        }

        if (!isForeignKeyField && (rawValue === null || rawValue === undefined)) {
            const fkValue = findValueByFieldName(entityData, `${field.fieldName}Id`);
            if (fkValue !== null && fkValue !== undefined && typeof fkValue !== 'object') {
                return { id: fkValue };
            }
        }
    }
    return rawValue !== undefined ? rawValue : (field.defaultValue ?? null);
}
