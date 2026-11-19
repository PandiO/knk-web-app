import type {
    AppliedModifierDto,
    ClimateZoneWeatherDto,
    ProductionEngineSettingsDto,
    ProductionKindLevelDto,
    ProductionKindLevelItemDto,
    ProductionLineInputDto,
    WeatherTypeEffectDto,
} from '../types/dtos/production/ProductionEngineDtos';

// Production engine P3 in the web app (PandiO/knk-workspace#678; production DESIGN § 9, § 11.1, PRODUCTION_KINDS § 4-5):
// the rate breakdown of a line (base, modifiers in applied order, unlock and workers), the line states in words, and the
// checks of the child-list editors (a level's items, a line's inputs, a zone's odds, a weather type's effects) before
// they go to the API. Pure functions: the panels use them, Jest tests them.

/** The engine's timing defaults (knk-web-api `ProductionEngineSettingsDto`). */
export const defaultProductionEngineSettings = (): ProductionEngineSettingsDto => ({
    baseCycleMinutes: 10,
    catchUpCapHours: 24,
    weatherDayMinutes: 20,
});

/** The API's bounds for `production.engine`. */
export const PRODUCTION_ENGINE_LIMITS = {
    baseCycleMinutes: [1, 1440],
    catchUpCapHours: [1, 720],
    weatherDayMinutes: [1, 10080],
} as const;

/** The engine settings the API would refuse, one sentence each; empty when valid. */
export function productionEngineSettingsErrors(settings: ProductionEngineSettingsDto): string[] {
    const errors: string[] = [];
    (Object.keys(PRODUCTION_ENGINE_LIMITS) as (keyof ProductionEngineSettingsDto)[]).forEach(key => {
        const [min, max] = PRODUCTION_ENGINE_LIMITS[key];
        const value = settings[key];
        if (!Number.isInteger(value) || value < min || value > max) {
            errors.push(`production.engine.${key} must be a whole number between ${min} and ${max}.`);
        }
    });
    return errors;
}

/** A number with at most `digits` decimals and no trailing zeros. */
export function formatNumber(value: number | null | undefined, digits = 2): string {
    if (value == null || !Number.isFinite(value)) return '-';
    const factor = 10 ** digits;
    return String(Math.round(value * factor) / factor);
}

/** "12.5/h". */
export function formatRate(value: number | null | undefined): string {
    return `${formatNumber(value)}/h`;
}

/** "+2/h" for an addition, "× 1.5" for a multiplication. */
export function modifierStepLabel(modifier: Pick<AppliedModifierDto, 'effect' | 'value'>): string {
    if (modifier.effect === 'Add') {
        return `${modifier.value < 0 ? '−' : '+'}${formatNumber(Math.abs(modifier.value))}/h`;
    }
    return `× ${formatNumber(modifier.value, 3)}`;
}

/** A modifier's active window: "Always", "From …", "Until …" or "… to …" (dates as the API sends them, UTC). */
export function modifierWindowLabel(from: string | null | undefined, until: string | null | undefined): string {
    const day = (value: string) => value.slice(0, 16).replace('T', ' ');
    if (from && until) return `${day(from)} to ${day(until)}`;
    if (from) return `From ${day(from)}`;
    if (until) return `Until ${day(until)}`;
    return 'Always';
}

/** A factor as a percentage: 0.5 → "50%". */
export function formatPercent(factor: number | null | undefined): string {
    if (factor == null || !Number.isFinite(factor)) return '-';
    return `${formatNumber(factor * 100, 1)}%`;
}

export interface RateStep {
    /** What the step is: "Base rate", a modifier's source and name, "Unlock", "Workers". */
    label: string;
    /** The step itself: "10/h", "+2/h", "× 1.5", "× 50%". */
    change: string;
    /** The rate after the step. */
    rate: number;
}

/**
 * The rate formula of a line or a cycle, step by step (A08): the base rate, each modifier in the order the API applied
 * it (additions, then multiplications, F8), then the unlock and the workers present / total. The last step's rate is
 * what the API reports as effective (rounding aside); the API's figure is the one to trust.
 */
export function rateSteps(input: {
    baseRatePerHour: number;
    modifiers: AppliedModifierDto[];
    unlockFactor: number;
    workerFactor: number;
}): RateStep[] {
    let rate = input.baseRatePerHour;
    const steps: RateStep[] = [{ label: 'Base rate', change: formatRate(rate), rate }];
    for (const modifier of input.modifiers) {
        rate = modifier.effect === 'Add' ? rate + modifier.value : rate * modifier.value;
        steps.push({ label: `${modifier.source}: ${modifier.name}`, change: modifierStepLabel(modifier), rate });
    }
    if (input.unlockFactor !== 1) {
        rate *= input.unlockFactor;
        steps.push({ label: input.unlockFactor === 0 ? 'Unlock: not unlocked at this level' : 'Unlock', change: `× ${formatPercent(input.unlockFactor)}`, rate });
    }
    rate *= input.workerFactor;
    steps.push({ label: 'Workers present', change: `× ${formatPercent(input.workerFactor)}`, rate });
    return steps;
}

const LINE_STATUS_LABELS: Record<string, string> = {
    Running: 'Running',
    Paused: 'Paused by staff',
    BlockedFull: 'Blocked: output storage full',
    BlockedInputs: 'Blocked: inputs missing',
    Error: 'Error',
};

/** A line's state in words (the API's enum name for an unknown one). */
export function lineStatusLabel(status: string | null | undefined): string {
    if (!status) return '-';
    return LINE_STATUS_LABELS[status] ?? status;
}

/** Whether a line state needs attention (blocked or in error). */
export function lineStatusIsProblem(status: string | null | undefined): boolean {
    return status === 'BlockedFull' || status === 'BlockedInputs' || status === 'Error';
}

/** "1 h 5 min", "45 s". */
export function formatDuration(seconds: number | null | undefined): string {
    if (seconds == null || !Number.isFinite(seconds)) return '-';
    const s = Math.max(0, Math.round(seconds));
    if (s < 60) return `${s} s`;
    const hours = Math.floor(s / 3600);
    const minutes = Math.floor((s % 3600) / 60);
    if (hours === 0) return `${minutes} min`;
    return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`;
}

/** The sum of a zone's weather odds in percent. */
export function oddsTotal(odds: Pick<ClimateZoneWeatherDto, 'chancePercent'>[]): number {
    return odds.reduce((sum, odd) => sum + (Number.isFinite(odd.chancePercent) ? odd.chancePercent : 0), 0);
}

/** The problems of a zone's weather odds the API would refuse; empty when valid. The rest up to 100% is clear weather. */
export function oddsErrors(odds: Pick<ClimateZoneWeatherDto, 'weatherTypeId' | 'chancePercent'>[]): string[] {
    const errors: string[] = [];
    if (odds.some(odd => !(odd.weatherTypeId > 0))) errors.push('Pick a weather type on every row.');
    if (odds.some(odd => !Number.isFinite(odd.chancePercent) || odd.chancePercent <= 0 || odd.chancePercent > 100)) {
        errors.push('Each chance is more than 0 and at most 100 percent.');
    }
    if (hasDuplicates(odds.map(odd => odd.weatherTypeId).filter(id => id > 0))) errors.push('A weather type is listed twice.');
    if (oddsTotal(odds) > 100 + 1e-9) errors.push(`The chances add up to ${formatNumber(oddsTotal(odds))}%: at most 100%.`);
    return errors;
}

/** The problems of a level's items; empty when valid. An unlock has no amount; an upgrade cost needs one. */
export function levelItemErrors(items: Pick<ProductionKindLevelItemDto, 'role' | 'itemBlueprintId' | 'amount'>[]): string[] {
    const errors: string[] = [];
    if (items.some(item => !(item.itemBlueprintId > 0))) errors.push('Pick a blueprint on every row.');
    if (items.some(item => item.role === 'UpgradeCost' && (!Number.isInteger(item.amount) || item.amount <= 0))) {
        errors.push('An upgrade cost needs a whole amount above 0.');
    }
    if (hasDuplicates(items.filter(item => item.itemBlueprintId > 0).map(item => `${item.role}:${item.itemBlueprintId}`))) {
        errors.push('A blueprint is listed twice with the same role.');
    }
    return errors;
}

/** The problems of a line's inputs; empty when valid. */
export function inputErrors(inputs: Pick<ProductionLineInputDto, 'itemBlueprintId' | 'amountPerHour'>[]): string[] {
    const errors: string[] = [];
    if (inputs.some(input => !(input.itemBlueprintId > 0))) errors.push('Pick a blueprint on every row.');
    if (inputs.some(input => !Number.isFinite(input.amountPerHour) || input.amountPerHour <= 0)) {
        errors.push('Each input needs an amount per hour above 0.');
    }
    if (hasDuplicates(inputs.map(input => input.itemBlueprintId).filter(id => id > 0))) errors.push('A blueprint is listed twice.');
    return errors;
}

/** The problems of a weather type's effects; empty when valid. One effect per category and effect kind. */
export function effectErrors(effects: Pick<WeatherTypeEffectDto, 'category' | 'effect' | 'value'>[]): string[] {
    const errors: string[] = [];
    if (effects.some(effect => !Number.isFinite(effect.value))) errors.push('Each effect needs a number.');
    if (effects.some(effect => effect.effect === 'Multiply' && effect.value < 0)) errors.push('A multiplication can\'t be negative.');
    if (hasDuplicates(effects.map(effect => `${effect.category}:${effect.effect}`))) {
        errors.push('A category has the same effect twice.');
    }
    return errors;
}

/** The level after `current` in a kind's levels, or null at the top (level 10) or when unknown. */
export function nextLevelOf(levels: ProductionKindLevelDto[] | null | undefined, current: number): ProductionKindLevelDto | null {
    return levels?.find(level => level.level === current + 1) ?? null;
}

/** A level's upgrade cost items (role UpgradeCost). */
export function upgradeCostItems(level: ProductionKindLevelDto | null | undefined): ProductionKindLevelItemDto[] {
    return (level?.items ?? []).filter(item => item.role === 'UpgradeCost');
}

/** A related blueprint's name from the shapes the API sends (`itemBlueprint.name` or `itemBlueprintName`). */
export function blueprintName(row: { itemBlueprintId?: number | null; itemBlueprintName?: string | null; itemBlueprint?: { name?: string | null } | null }): string {
    return row.itemBlueprint?.name ?? row.itemBlueprintName ?? (row.itemBlueprintId ? `Blueprint #${row.itemBlueprintId}` : '-');
}

function hasDuplicates(values: (string | number)[]): boolean {
    return new Set(values).size !== values.length;
}
