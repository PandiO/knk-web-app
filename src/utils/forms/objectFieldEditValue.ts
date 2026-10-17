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
 *
 * List relationship fields get the same treatment for `XIds` / `Xs` pairs (KNG-135, see below).
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
    if (field.fieldType === FieldType.List && field.objectType) {
        const listValue = resolveListRelationshipForEdit(entityData, field.fieldName, rawValue);
        if (listValue !== undefined) {
            return listValue;
        }
    }
    return rawValue !== undefined ? rawValue : (field.defaultValue ?? null);
}

const isPresentId = (value: unknown): value is number | string =>
    (typeof value === 'number' && Number.isFinite(value)) || (typeof value === 'string' && value.length > 0);

const asIdObjects = (ids: unknown[]): Record<string, unknown>[] | undefined =>
    ids.every(isPresentId) ? ids.map(id => ({ id })) : undefined;

/** "DistrictIds" -> ["Districts", "Districtes", ...]: the navigation names an `XIds` list may pair with. */
const navigationNamesFor = (idsFieldName: string): string[] => {
    const base = idsFieldName.slice(0, -3);
    const names = [`${base}s`, `${base}es`];
    if (/y$/i.test(base)) {
        names.push(`${base.slice(0, -1)}ies`);
    }
    return names;
};

/** "Districts" -> ["DistrictIds", ...]: the id-list names an `Xs` navigation list may pair with. */
const idsNamesFor = (navigationFieldName: string): string[] => {
    const names: string[] = [];
    if (/ies$/i.test(navigationFieldName)) {
        names.push(`${navigationFieldName.slice(0, -3)}yIds`);
    }
    if (/es$/i.test(navigationFieldName)) {
        names.push(`${navigationFieldName.slice(0, -2)}Ids`);
    }
    if (/s$/i.test(navigationFieldName)) {
        names.push(`${navigationFieldName.slice(0, -1)}Ids`);
    }
    return names;
};

const firstArray = (entityData: Record<string, unknown>, names: string[]): unknown[] | undefined => {
    for (const name of names) {
        const value = findValueByFieldName(entityData, name);
        if (Array.isArray(value)) {
            return value;
        }
    }
    return undefined;
};

/**
 * KNG-135: a List relationship field (with an objectType) can be authored on either side of an
 * `XIds` / `Xs` pair, and read DTOs often carry only one side (StreetDto filled Districts but never
 * DistrictIds). ListField renders objects with an id, so:
 * - `XIds`-authored: use the DTO's `Xs` objects when present (they carry names for display); else
 *   turn the bare ids into `{ id }`.
 * - `Xs`-authored: when the DTO has no `Xs` array (or an empty one) but has `XIds`, use `{ id }`s.
 * Returns undefined when there is nothing to change.
 */
function resolveListRelationshipForEdit(
    entityData: Record<string, unknown>,
    fieldName: string,
    rawValue: unknown
): unknown[] | undefined {
    const raw = Array.isArray(rawValue) ? rawValue : undefined;

    if (/Ids$/.test(fieldName)) {
        const navigation = firstArray(entityData, navigationNamesFor(fieldName));
        if (navigation && navigation.length > 0 && navigation.every(item => item && typeof item === 'object')) {
            return navigation;
        }
        if (raw && raw.length > 0) {
            return asIdObjects(raw);
        }
        return undefined;
    }

    if (raw && raw.length > 0) {
        return undefined;
    }
    const ids = firstArray(entityData, idsNamesFor(fieldName));
    if (ids && ids.length > 0) {
        return asIdObjects(ids);
    }
    return undefined;
}
