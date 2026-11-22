import { FormFieldDto } from '../../types/dtos/forms/FormModels';

/**
 * PandiO/knk-workspace#951 (web part, picked up by landmark-domain link L4, #986): a region the region task draws has no
 * stored outline yet, so a Region-shaped production area couldn't take its bounds from the map at the first save. The
 * region task's result carries the drawn region's bounding box (option 2 of the issue; plugin part in #985), and the
 * form fills the bound fields that are still empty from it.
 *
 * Accepted result shapes (keys in any case): `{ "regionId": "...", "bounds": { "minX": 1, ..., "maxZ": 9 } }`, or the
 * six keys at the top level. A result without all six whole numbers fills nothing.
 */

export const REGION_TASK_TYPES: readonly string[] = ['ReagionCreate', 'RegionCreate', 'RegionClaim'];

export const BOUND_KEYS = ['minX', 'minY', 'minZ', 'maxX', 'maxY', 'maxZ'] as const;
export type BoundKey = typeof BOUND_KEYS[number];
export type RegionBounds = Record<BoundKey, number>;

const read = (source: Record<string, unknown>, key: string): unknown => {
    const match = Object.keys(source).find(existing => existing.toLowerCase() === key.toLowerCase());
    return match === undefined ? undefined : source[match];
};

const isObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

export const isRegionTaskType = (taskType?: string | null): boolean => !!taskType && REGION_TASK_TYPES.includes(taskType);

/** The bounding box in a region task's outputJson, or null. */
export function regionBoundsFromTaskOutput(outputJson: string | null | undefined): RegionBounds | null {
    if (!outputJson) return null;
    let output: unknown;
    try {
        output = JSON.parse(outputJson);
    } catch {
        return null;
    }
    if (!isObject(output)) return null;
    const nested = read(output, 'bounds');
    const source = isObject(nested) ? nested : output;
    const bounds = {} as RegionBounds;
    for (const key of BOUND_KEYS) {
        const raw = read(source, key);
        const value = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : raw;
        if (typeof value !== 'number' || !Number.isFinite(value)) return null;
        bounds[key] = Math.round(value);
    }
    return bounds;
}

const isEmpty = (value: unknown): boolean =>
    value === null || value === undefined || (typeof value === 'string' && value.trim() === '');

/**
 * The fields of `fields` named like a bound (MinX, minY, ...) that are still empty in `values`, with the drawn region's
 * value. A bound staff typed is kept.
 */
export function regionBoundsPatch(
    bounds: RegionBounds | null,
    fields: Pick<FormFieldDto, 'fieldName'>[],
    values: Record<string, unknown>
): Record<string, number> {
    const patch: Record<string, number> = {};
    if (!bounds) return patch;
    for (const field of fields) {
        const key = BOUND_KEYS.find(bound => bound.toLowerCase() === field.fieldName.toLowerCase());
        if (!key) continue;
        const current = read(values, field.fieldName);
        if (isEmpty(current)) patch[field.fieldName] = bounds[key];
    }
    return patch;
}
