// Yield areas P4 in the web app (PandiO/knk-workspace#680; PRODUCTION_KINDS § 3-4, decisions P-D1, G5, G7, G17):
// pure helpers for the area, survey, yield and override screens.
import type { ProductionKindDto } from '../types/dtos/production/ProductionEngineDtos';
import type {
    AreaPointDto,
    AreaSurveyTrendDto,
    AreaSurveyUnitDto,
    ProductionAreaDto,
    ProductionAreaOverlapDto,
    ProductionKindPrimaryOutputDto,
    ProductionYieldOverrideKind,
    ProductionYieldRowDto,
    YieldSource,
} from '../types/dtos/production/ProductionYieldDtos';
import { YIELD_SOURCES } from '../types/dtos/production/ProductionYieldDtos';
import { formatNumber, formatRate } from './productionEngine';

/** G5: surveys run only for Derived and Hybrid structures; a Configured one is never surveyed. */
export function isSurveyed(yieldSource: string | null | undefined): boolean {
    return yieldSource === 'Derived' || yieldSource === 'Hybrid';
}

const YIELD_SOURCE_TEXT: Record<YieldSource, string> = {
    Derived: 'Derived: the rates come from the surveyed areas and the kind\'s yield table.',
    Configured: 'Configured: the rates are the lines an admin entered. The structure is never surveyed.',
    Hybrid: 'Hybrid: the rates come from the surveys, with the pins, exclusions and scales below.',
};

/** One sentence on where the rates come from (A10: the yield source is visible). */
export function yieldSourceText(yieldSource: string | null | undefined): string {
    return YIELD_SOURCE_TEXT[(yieldSource ?? '') as YieldSource] ?? `Yield source ${yieldSource ?? 'unknown'}.`;
}

/** The yield sources a kind allows, in the form's order (Hybrid first, P-D1). A kind without flags allows all. */
export function allowedYieldSources(kind: Pick<ProductionKindDto, 'allowsDerived' | 'allowsConfigured' | 'allowsHybrid'> | null | undefined): YieldSource[] {
    if (!kind) return [...YIELD_SOURCES];
    const allowed: Record<YieldSource, boolean> = {
        Hybrid: kind.allowsHybrid !== false,
        Derived: kind.allowsDerived !== false,
        Configured: kind.allowsConfigured !== false,
    };
    return YIELD_SOURCES.filter(source => allowed[source]);
}

/** "320 of 400 blocks", "18 radius (no cap)". */
export function areaSizeLabel(area: Pick<ProductionAreaDto, 'size' | 'sizeUnit' | 'maxSize'>): string {
    const unit = area.sizeUnit ?? '';
    const size = `${area.size ?? 0}`;
    if (area.maxSize == null) return `${size} ${unit} (no cap)`.replace('  ', ' ');
    return `${size} of ${area.maxSize} ${unit}`.trim();
}

/** True when the area is larger than its level allows (the API refuses such a save; a level change can cause it). */
export function areaOverCap(area: Pick<ProductionAreaDto, 'size' | 'maxSize'>): boolean {
    return area.maxSize != null && (area.size ?? 0) > area.maxSize;
}

/** "Pin 12/h", "Exclude", "Scale × 0.5". */
export function overrideLabel(kind: string | null | undefined, value: number | null | undefined): string {
    if (kind === 'Pin') return `Pin ${formatRate(value)}`;
    if (kind === 'Scale') return `Scale × ${formatNumber(value)}`;
    if (kind === 'Exclude') return 'Exclude';
    return 'None';
}

/** A Hybrid override's value: Pin a base rate per hour (above 0), Scale a factor from 0 to 100, Exclude none. */
export function overrideErrors(kind: ProductionYieldOverrideKind, value: string): string[] {
    if (kind === 'Exclude') return [];
    const trimmed = value.trim();
    const number = Number(trimmed);
    if (trimmed === '' || !Number.isFinite(number)) return [kind === 'Pin' ? 'Enter the rate per hour.' : 'Enter the factor.'];
    if (kind === 'Pin' && number <= 0) return ['A pinned rate is above 0 per hour (exclude the output to stop it).'];
    if (kind === 'Scale' && (number < 0 || number > 100)) return ['A scale is from 0 to 100.'];
    return [];
}

/** knk-web-api `SurveyUnitKeys` pattern: a unit key, a prefix ending in ":*", or "*" (any unit). */
const UNIT_KEY = /^([A-Z0-9_]+(:[A-Z0-9_]+)*(:\*)?|\*)$/;

/** A yield table row's problems, by row number (1-based) and overall (duplicates). */
export function yieldRowErrors(rows: Pick<ProductionYieldRowDto, 'unitKey' | 'itemBlueprintId' | 'ratePerUnitPerHour' | 'byproductChance' | 'minLevel'>[]): string[] {
    const problems: string[] = [];
    const seen = new Set<string>();
    rows.forEach((row, index) => {
        const n = index + 1;
        const key = (row.unitKey ?? '').trim().toUpperCase();
        if (!key) problems.push(`Row ${n}: enter a unit key, for example BLOCK:COAL_ORE or TREE:OAK:*.`);
        else if (!UNIT_KEY.test(key)) problems.push(`Row ${n}: a unit key is parts of letters, digits and _ joined by ":", optionally ending in ":*" (or just "*").`);
        if (!row.itemBlueprintId) problems.push(`Row ${n}: pick the output blueprint.`);
        if (!Number.isFinite(row.ratePerUnitPerHour) || row.ratePerUnitPerHour < 0) problems.push(`Row ${n}: the rate per unit per hour is 0 or more.`);
        const chance = row.byproductChance ?? 1;
        if (!Number.isFinite(chance) || chance < 0 || chance > 1) problems.push(`Row ${n}: the chance is from 0 to 1.`);
        const minLevel = row.minLevel ?? 1;
        if (!Number.isInteger(minLevel) || minLevel < 1 || minLevel > 10) problems.push(`Row ${n}: the minimum level is a whole number from 1 to 10.`);
        if (key && row.itemBlueprintId) {
            const pair = `${key}|${row.itemBlueprintId}`;
            if (seen.has(pair)) problems.push(`Row ${n}: the same unit key and output are already in the table.`);
            seen.add(pair);
        }
    });
    return problems;
}

export function primaryOutputErrors(outputs: Pick<ProductionKindPrimaryOutputDto, 'itemBlueprintId'>[]): string[] {
    const problems: string[] = [];
    const seen = new Set<number>();
    outputs.forEach((output, index) => {
        if (!output.itemBlueprintId) problems.push(`Primary output ${index + 1}: pick a blueprint.`);
        else if (seen.has(output.itemBlueprintId)) problems.push(`Primary output ${index + 1}: already listed.`);
        else seen.add(output.itemBlueprintId);
    });
    return problems;
}

export interface CompositionRow {
    unitKey: string;
    count: number;
    sharedBy: number;
    /** Of the survey's units, 0-100. */
    percent: number;
    extra?: string | null;
}

/** A survey's units as the composition table shows them: largest first, with each unit key's share of the total. */
export function compositionRows(units: AreaSurveyUnitDto[] | null | undefined, totalUnits?: number | null): CompositionRow[] {
    const list = units ?? [];
    const total = totalUnits && totalUnits > 0 ? totalUnits : list.reduce((sum, unit) => sum + (unit.count ?? 0), 0);
    return list
        .map(unit => ({
            unitKey: unit.unitKey ?? '',
            count: unit.count ?? 0,
            sharedBy: unit.sharedBy ?? 1,
            percent: total > 0 ? Math.round(((unit.count ?? 0) / total) * 1000) / 10 : 0,
            extra: unit.extra,
        }))
        .sort((a, b) => b.count - a.count || a.unitKey.localeCompare(b.unitKey));
}

export interface TrendRow {
    unitKey: string;
    counts: number[];
    first: number;
    last: number;
    /** last - first. */
    change: number;
}

/** The trend's series, the largest now first (a forest being cut down shows as a falling TREE row). */
export function trendRows(trend: AreaSurveyTrendDto | null | undefined): TrendRow[] {
    if (!trend) return [];
    return Object.entries(trend.series ?? {})
        .map(([unitKey, counts]) => {
            const first = counts[0] ?? 0;
            const last = counts[counts.length - 1] ?? 0;
            return { unitKey, counts, first, last, change: last - first };
        })
        .sort((a, b) => b.last - a.last || a.unitKey.localeCompare(b.unitKey));
}

/** "+12", "-340", "0". */
export function signedChange(change: number): string {
    return change > 0 ? `+${change}` : `${change}`;
}

/** An area's footprint seen from above (x east, z south), for the 2D plot. */
export type Footprint =
    | { kind: 'rect'; minX: number; minZ: number; maxX: number; maxZ: number }
    | { kind: 'circle'; cx: number; cz: number; r: number }
    | { kind: 'polygon'; points: AreaPointDto[] };

type Shaped = Pick<ProductionAreaDto, 'shape' | 'points' | 'centerX' | 'centerZ' | 'radius' | 'minX' | 'minZ' | 'maxX' | 'maxZ'>
    | Pick<ProductionAreaOverlapDto, 'shape' | 'points' | 'centerX' | 'centerZ' | 'radius' | 'minX' | 'minZ' | 'maxX' | 'maxZ'>;

export function footprintOf(area: Shaped): Footprint | null {
    if (area.shape === 'Radius' && area.centerX != null && area.centerZ != null && area.radius != null) {
        return { kind: 'circle', cx: area.centerX, cz: area.centerZ, r: area.radius };
    }
    if (area.shape === 'Polygon' && area.points && area.points.length >= 3) {
        return { kind: 'polygon', points: area.points };
    }
    if (area.minX != null && area.minZ != null && area.maxX != null && area.maxZ != null) {
        return { kind: 'rect', minX: area.minX, minZ: area.minZ, maxX: area.maxX, maxZ: area.maxZ };
    }
    return null;
}

export interface PlotBox {
    minX: number;
    minZ: number;
    width: number;
    height: number;
}

/** The box that holds every footprint, with a margin of a tenth (at least 2 blocks) around it. */
export function plotBox(footprints: Footprint[]): PlotBox | null {
    if (footprints.length === 0) return null;
    let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
    const take = (x: number, z: number) => {
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
    };
    footprints.forEach(f => {
        if (f.kind === 'rect') { take(f.minX, f.minZ); take(f.maxX + 1, f.maxZ + 1); }
        else if (f.kind === 'circle') { take(f.cx - f.r, f.cz - f.r); take(f.cx + f.r + 1, f.cz + f.r + 1); }
        else f.points.forEach(p => take(p.x, p.z));
    });
    const margin = Math.max(2, Math.round(Math.max(maxX - minX, maxZ - minZ) / 10));
    return { minX: minX - margin, minZ: minZ - margin, width: maxX - minX + 2 * margin, height: maxZ - minZ + 2 * margin };
}

/** The API's refusal of an area save ("over the cap", "overlaps") keeps its sentence. */
export function sizeCapHint(maxSize: number | null | undefined, sizeUnit: string | null | undefined): string {
    return maxSize == null ? 'The level sets no size cap.' : `The level allows at most ${maxSize} ${sizeUnit ?? ''}`.trim() + '.';
}

/** The P4 types whose seeded forms are saved through endpoints that answer a refusal with `{ error: "<sentence>" }`. */
export function isYieldFormType(entityTypeName: string | null | undefined): boolean {
    const name = (entityTypeName ?? '').toLowerCase();
    return name === 'productionarea' || name === 'productionyieldoverride';
}
