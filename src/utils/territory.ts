import {
    ProductionSettingsDto,
    StructureTerritoryFlag,
    TerritoryConflictDto,
    TerritoryHolderDto,
    TerritorySettingsDto,
    TownTerritoryChange,
} from '../types/dtos/territory/TerritoryDtos';

/**
 * Territory V1 helpers for the web app (PandiO/knk-workspace#690; knk-workspace docs/specs/territory/DESIGN.md § 1-4).
 * Pure functions: the pages and the API client use them, Jest tests them.
 */

/** The API's bounds (knk-web-api `TerritorySettingsDto`, `TerritoryHolderRules.MaxPower`). */
export const TERRITORY_LIMITS = {
    maxBaseRange: 10_000,
    maxPowerFactor: 1_000,
    minCapitalMultiplier: 1,
    maxCapitalMultiplier: 10,
    maxPower: 1_000_000,
    maxCrownLandRange: 10_000,
};

/** The design's defaults (territory DESIGN § 1, G11), as the API stores them until someone changes them. */
export const defaultTerritorySettings = (): TerritorySettingsDto => ({ baseRange: 100, powerFactor: 2, capitalMultiplier: 1.5 });

export const defaultProductionSettings = (): ProductionSettingsDto => ({ enabled: false, territory: defaultTerritorySettings() });

/** Fills a section the API sent (or did not send) with the defaults, so the settings card always has every field. */
export function normalizeProductionSettings(value?: Partial<ProductionSettingsDto> | null): ProductionSettingsDto {
    return {
        enabled: value?.enabled ?? false,
        territory: { ...defaultTerritorySettings(), ...(value?.territory ?? {}) },
    };
}

/** Range = base range + power × factor; a capital district's is multiplied (G11). Same rule as knk-web-api `TerritoryRules`. */
export function townRange(settings: TerritorySettingsDto, power: number, capital = false): number {
    const range = Math.max(0, settings.baseRange + power * settings.powerFactor);
    return capital ? range * settings.capitalMultiplier : range;
}

/** "(100 + 50 × 2) = 200", or with the capital "(100 + 50 × 2) × 1.5 = 300". */
export function rangeFormula(settings: TerritorySettingsDto, power: number, capital = false): string {
    const base = `(${formatBlocks(settings.baseRange)} + ${formatBlocks(power)} × ${formatBlocks(settings.powerFactor)})`;
    const expr = capital ? `${base} × ${formatBlocks(settings.capitalMultiplier)}` : base;
    return `${expr} = ${formatBlocks(townRange(settings, power, capital))}`;
}

/** Whole blocks without decimals, other numbers with at most two. */
export function formatBlocks(value: number): string {
    if (!Number.isFinite(value)) return '-';
    return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
}

/** The problems of a settings section the API would refuse (400), in the API's words; empty when it is valid. */
export function territorySettingsErrors(settings: TerritorySettingsDto): string[] {
    const errors: string[] = [];
    const { baseRange, powerFactor, capitalMultiplier } = settings;
    if (!Number.isFinite(baseRange) || baseRange < 0 || baseRange > TERRITORY_LIMITS.maxBaseRange) {
        errors.push(`production.territory.baseRange must be between 0 and ${TERRITORY_LIMITS.maxBaseRange}.`);
    }
    if (!Number.isFinite(powerFactor) || powerFactor < 0 || powerFactor > TERRITORY_LIMITS.maxPowerFactor) {
        errors.push(`production.territory.powerFactor must be between 0 and ${TERRITORY_LIMITS.maxPowerFactor}.`);
    }
    if (!Number.isFinite(capitalMultiplier) || capitalMultiplier < TERRITORY_LIMITS.minCapitalMultiplier
        || capitalMultiplier > TERRITORY_LIMITS.maxCapitalMultiplier) {
        errors.push(`production.territory.capitalMultiplier must be between ${TERRITORY_LIMITS.minCapitalMultiplier} and ${TERRITORY_LIMITS.maxCapitalMultiplier}.`);
    }
    return errors;
}

/** The power the API accepts: a whole number from 0 to 1,000,000; null for anything else. */
export function parsePower(raw: string): number | null {
    if (raw.trim() === '') return null;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 0 || n > TERRITORY_LIMITS.maxPower) return null;
    return n;
}

type Row = Record<string, unknown>;

const pick = (row: Row, key: string): unknown => row[key] ?? null;

/**
 * The body of `PUT api/Towns/{id}` that changes only the territory fields (G11): the town's own fields as the API
 * sent them, the territory change, and null for every "not on this form" group (teleport settings, navigation
 * defaults, the inline location, streets), which the API then leaves as they are (knk-web-api `TownDto`).
 */
export function townTerritoryPayload(town: Row, change: TownTerritoryChange): Row {
    return {
        id: pick(town, 'id'),
        name: pick(town, 'name'),
        description: pick(town, 'description'),
        allowEntry: pick(town, 'allowEntry'),
        allowExit: pick(town, 'allowExit'),
        wgRegionId: pick(town, 'wgRegionId'),
        worldName: pick(town, 'worldName'),
        locationId: pick(town, 'locationId'),
        location: null,
        teleportEnabled: null,
        navigationDefaultOverride: null,
        roadAccessOverride: null,
        power: change.power,
        kingdomId: change.kingdomId,
        provinceId: change.kingdomId == null ? null : change.provinceId,
    };
}

/** The body of `PUT api/Districts/{id}` that changes only the capital flag (G11); like {@link townTerritoryPayload}. */
export function districtCapitalPayload(district: Row, isCapital: boolean): Row {
    return {
        id: pick(district, 'id'),
        name: pick(district, 'name'),
        description: pick(district, 'description'),
        allowEntry: pick(district, 'allowEntry'),
        allowExit: pick(district, 'allowExit'),
        wgRegionId: pick(district, 'wgRegionId'),
        worldName: pick(district, 'worldName'),
        locationId: pick(district, 'locationId'),
        townId: pick(district, 'townId'),
        location: null,
        teleportEnabled: null,
        navigationDefaultOverride: null,
        roadAccessOverride: null,
        streetIds: null,
        isCapital,
    };
}

/** "Phoenix (town)", "Aurelia (kingdom)", or "Town #4 (deleted)" when the holder is gone. */
export function holderLabel(holder: TerritoryHolderDto | null | undefined): string {
    if (!holder) return '-';
    const kind = String(holder.kind ?? '').toLowerCase();
    return holder.name ? `${holder.name} (${kind})` : `${holder.kind} #${holder.id} (deleted)`;
}

export const sameHolder = (a?: TerritoryHolderDto | null, b?: TerritoryHolderDto | null): boolean =>
    !!a && !!b && a.id === b.id && String(a.kind).toLowerCase() === String(b.kind).toLowerCase();

/** "chunks 4..6, 2..2 (x, z) · blocks 64..111, 32..47": where to look in game. */
export function conflictAreaLabel(conflict: Pick<TerritoryConflictDto, 'minChunkX' | 'maxChunkX' | 'minChunkZ' | 'maxChunkZ'>): string {
    const { minChunkX, maxChunkX, minChunkZ, maxChunkZ } = conflict;
    return `chunks x ${minChunkX}..${maxChunkX}, z ${minChunkZ}..${maxChunkZ} · blocks x ${minChunkX * 16}..${maxChunkX * 16 + 15}, z ${minChunkZ * 16}..${maxChunkZ * 16 + 15}`;
}

/** "Open", "Resolved: awarded to Phoenix (town)", "Resolved: lines redrawn". */
export function conflictStateLabel(conflict: Pick<TerritoryConflictDto, 'status' | 'resolution' | 'awardedHolder'>): string {
    if (conflict.status !== 'Resolved') return 'Open';
    if (conflict.resolution === 'Awarded') return `Resolved: awarded to ${holderLabel(conflict.awardedHolder)}`;
    if (conflict.resolution === 'Redrawn') return 'Resolved: lines redrawn';
    return 'Resolved';
}

const FLAG_LABELS: Record<StructureTerritoryFlag, string> = {
    None: 'Inside its town\'s territory',
    OutsideTerritory: 'Outside its town\'s territory',
    Contested: 'In a contested zone',
};

/** The structure flag the game server's report sets (territory DESIGN § 4). */
export function territoryFlagLabel(flag: string | null | undefined): string {
    return FLAG_LABELS[(flag ?? 'None') as StructureTerritoryFlag] ?? flag ?? '-';
}
