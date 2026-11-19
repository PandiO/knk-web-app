import { apiRefusalReason } from './apiRefusalReason';
import type { StructureDto } from '../types/dtos/structure/StructureDto';
import type { RoadConnectionState } from '../types/dtos/structure/ProductionWorldDtos';

// P2 world in the web app (PandiO/knk-workspace#676; production DESIGN § 3.3-3.4, decisions R1-R3): placement in a
// district or rural (District-xor-Town), the placement warnings of P-1 to P-3, and the production structure's
// dashboard warnings.

/** The structure subtypes of P2 (lowercase entity type names). */
export const PRODUCTION_WORLD_TYPES: readonly string[] = ['warehouse', 'productionstructure'];

export function isProductionWorldType(entityTypeName?: string | null): boolean {
    return !!entityTypeName && PRODUCTION_WORLD_TYPES.includes(entityTypeName.toLowerCase());
}

/** A positive id from a form or DTO value (a number, a numeric string or a picked `{ id }`), else null. */
export function positiveId(value: unknown): number | null {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        const record = value as Record<string, unknown>;
        return positiveId(record.id ?? record.Id);
    }
    const numeric = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
    return typeof numeric === 'number' && Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

/** Whether the structure is rural (no district), from `isRural` or the placement fields. */
export function isRuralStructure(structure: Pick<StructureDto, 'isRural' | 'districtId' | 'townId'>): boolean {
    if (structure.isRural != null) return structure.isRural;
    return positiveId(structure.districtId) == null && positiveId(structure.townId) != null;
}

/** The town a structure belongs to: its district's or, when rural, its own (DESIGN § 3.3 effective town). */
export function effectiveTownId(structure: Pick<StructureDto, 'effectiveTownId' | 'townId'>): number | null {
    return positiveId(structure.effectiveTownId) ?? positiveId(structure.townId);
}

const ROAD_CONNECTION_LABELS: Record<RoadConnectionState, string> = {
    Unmeasured: 'Not measured yet',
    Connected: "Connected to its town's roads",
    Unconnected: "Not connected to its town's roads",
};

/** The road connection the game server measured (DESIGN § 7.6, D5). */
export function roadConnectionLabel(state: string | null | undefined): string {
    return ROAD_CONNECTION_LABELS[(state ?? 'Unmeasured') as RoadConnectionState] ?? state ?? '-';
}

/** The road connection column of the production structure list: only a rural structure needs one (D5). */
export function roadConnectionCell(row: { roadConnection?: string | null; isRural?: boolean | null }): string {
    if (row.isRural === false) return 'In a district';
    return row.roadConnection ?? 'Unmeasured';
}

/**
 * The reason of a refused warehouse or production structure save. Those controllers answer a rule violation with
 * `{ error: "<sentence>" }` (District-xor-Town, a blocking placement rule, level 1-10), which the generic reason
 * helper doesn't read; a 4xx without one falls back to it.
 */
export function placementRefusalReason(error: unknown): string | undefined {
    const e = error as { status?: number; response?: unknown } | null;
    const body = e?.response as { error?: unknown } | null | undefined;
    if (e?.status && e.status >= 400 && e.status < 500 && body && typeof body === 'object') {
        const text = typeof body.error === 'string' ? body.error.trim() : '';
        // A sentence, not a bare code such as "NotFound".
        if (text && /\s/.test(text)) return text;
    }
    return apiRefusalReason(error);
}

/** The placement warnings a create answered (P-1 to P-3 warn by default), without blanks or repeats. */
export function placementWarningsOf(created: unknown): string[] {
    const list = (created as { placementWarnings?: unknown } | null)?.placementWarnings;
    if (!Array.isArray(list)) return [];
    return Array.from(new Set(list.filter((w): w is string => typeof w === 'string' && w.trim() !== '').map(w => w.trim())));
}
