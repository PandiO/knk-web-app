import { FormFieldDto } from '../../types/dtos/forms/FormModels';
import { LANDMARK_AREA_LABELS } from '../landmarks';

/**
 * Landmark form rules the form configuration can't express (landmark-domain DESIGN § 4.1, § 6.3, PandiO/knk-workspace#986).
 * They depend on the picked parent's data or on the edited landmark's id, so the wizard applies them for the Landmark
 * entity, the way it derives gate geometry (gateGeometry.ts). Every other entity is left alone.
 */

export const LANDMARK_AREA_FIELD = 'AreaKind';
export const LANDMARK_PARENT_FIELD = 'ParentDomainId';
export const LINKED_DOMAIN_AREA = 'LinkedDomain';

/** The API's refusal (knk-web-api LandmarkService), shown before the save already. */
export const LINKED_DOMAIN_NEEDS_PARENT_REGION = "Area Linked domain's area needs a parent with a region.";

export const isLandmarkEntity = (entityName: string | null | undefined): boolean =>
    (entityName ?? '').toLowerCase() === 'landmark';

const sameName = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

const read = (source: Record<string, unknown> | null | undefined, key: string): unknown => {
    if (!source || typeof source !== 'object') return undefined;
    const match = Object.keys(source).find(existing => sameName(existing, key));
    return match === undefined ? undefined : source[match];
};

/**
 * Whether the picked parent has a main region: `true` or `false` when the value says so (a picker row or the
 * landmark's nested parent carries `wgRegionId`), `null` when only its id is known (the caller looks it up), and
 * `false` without a parent.
 */
export function parentRegionFromValue(value: unknown): boolean | null {
    if (value === null || value === undefined || value === '') return false;
    if (typeof value === 'object') {
        const row = value as Record<string, unknown>;
        const keys = Object.keys(row).map(key => key.toLowerCase());
        if (keys.includes('wgregionid')) {
            const region = read(row, 'wgRegionId');
            return typeof region === 'string' && region.trim() !== '';
        }
        return parentIdFromValue(value) == null ? false : null;
    }
    return parentIdFromValue(value) == null ? false : null;
}

/** The parent's id from a picker row, a nested parent or a bare id. */
export function parentIdFromValue(value: unknown): number | null {
    const raw = value !== null && typeof value === 'object' ? read(value as Record<string, unknown>, 'id') : value;
    const numeric = typeof raw === 'string' ? Number(raw) : raw;
    return typeof numeric === 'number' && Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

/**
 * The Area field as the wizard renders it: the words of DESIGN § 4.1 on the options, and `Linked domain's area` only
 * while the parent has a region (A17). The option stays while the parent's region is still being looked up, and when
 * it is the stored value (the field then shows {@link landmarkFieldError}).
 */
export function withLandmarkAreaOptions(
    entityName: string | null | undefined,
    field: FormFieldDto,
    value: unknown,
    parentHasRegion: boolean | null
): FormFieldDto {
    if (!isLandmarkEntity(entityName) || !sameName(field.fieldName, LANDMARK_AREA_FIELD)) return field;
    let settings: Record<string, unknown> = {};
    try {
        settings = field.settingsJson ? JSON.parse(field.settingsJson) : {};
    } catch {
        settings = {};
    }
    const configured = Array.isArray(settings.enumValues)
        ? (settings.enumValues as unknown[]).filter((v): v is string => typeof v === 'string')
        : Object.keys(LANDMARK_AREA_LABELS);
    const keepLinked = parentHasRegion !== false || value === LINKED_DOMAIN_AREA;
    const enumValues = keepLinked ? configured : configured.filter(v => v !== LINKED_DOMAIN_AREA);
    const enumLabels = { ...LANDMARK_AREA_LABELS, ...(settings.enumLabels as Record<string, string> | undefined) };
    const hint = parentHasRegion === false && !configured.every(v => enumValues.includes(v))
        ? " Linked domain's area is offered once the parent has a region."
        : '';
    return {
        ...field,
        description: `${field.description ?? ''}${hint}`.trim() || field.description,
        settingsJson: JSON.stringify({ ...settings, enumValues, enumLabels }),
    };
}

/** The Area field's error while `Linked domain's area` is picked without a parent that has a region. */
export function landmarkFieldError(
    entityName: string | null | undefined,
    fieldName: string,
    stepData: Record<string, unknown>,
    parentHasRegion: boolean | null
): string | undefined {
    if (!isLandmarkEntity(entityName) || !sameName(fieldName, LANDMARK_AREA_FIELD)) return undefined;
    return read(stepData, LANDMARK_AREA_FIELD) === LINKED_DOMAIN_AREA && parentHasRegion === false
        ? LINKED_DOMAIN_NEEDS_PARENT_REGION
        : undefined;
}

/**
 * The parent picker's filters (LD20, A18): on a saved landmark, `excludeSubtreeOf` leaves out the landmark itself and
 * its descendants (knk-web-api `POST api/Domains/search`). A new landmark has no descendants, so nothing is added.
 */
export function landmarkPickerFilters(
    entityName: string | null | undefined,
    fieldName: string,
    entityId: number | string | null | undefined,
    filters: Record<string, string> | undefined
): Record<string, string> | undefined {
    if (!isLandmarkEntity(entityName) || !sameName(fieldName, LANDMARK_PARENT_FIELD)) return filters;
    const id = parentIdFromValue(entityId);
    if (id == null) return filters;
    return { ...(filters ?? {}), excludeSubtreeOf: String(id) };
}
