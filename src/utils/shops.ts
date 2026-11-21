import type { ShopCatalogueEntryDto, ShopStockMode, ShopTradeStatListDto, ShopTypeLevelDto } from '../types/dtos/production/ShopDtos';
import type { LookupPick } from '../components/stock/LookupPicker';

// Shops P10 in the web app (PandiO/knk-workspace#688; shops DESIGN § 2-5, § 9): the pure helpers behind the shop type,
// shop and town account panels: the editors' checks (mirroring the API's), the hourly trade-stats series and labels.

/** Reads and writes of every shop type: the World area's node (knk-web-api DashboardAccess). */
export const SHOP_NODE = 'knk.admin.world';
/** Deletes also need the delete node. */
export const SHOP_DELETE_NODE = 'knk.admin.delete';
/**
 * Creates and edits of shop types, levels, shops and catalogue entries: the World area's node and knk.admin.content
 * (knk-web-api `RequireDashboardChange`, the dashboard's change rule, #374).
 */
export const SHOP_CHANGE_NODES: readonly string[] = [SHOP_NODE, 'knk.admin.content'];
/** The API's highest shop level (`ShopTypeLevel.MaxLevel`). */
export const SHOP_MAX_LEVEL = 100;
/** The API's highest static price (`ShopCatalogueService.MaxStaticPrice`). */
export const SHOP_STATIC_PRICE_MAX = 1_000_000_000;
/** The API's page size cap for shop searches. */
export const SHOP_PAGE_MAX = 200;

/** "1,250 coins"; "-" for none. */
export function formatCoins(value: number | null | undefined): string {
    if (value == null || !Number.isFinite(value)) return '-';
    return `${Math.round(value).toLocaleString('en-US')} coins`;
}

/** "+40" / "-20" / "0". */
export function signedCoins(value: number): string {
    return value > 0 ? `+${value.toLocaleString('en-US')}` : value.toLocaleString('en-US');
}

/** An hour as the API keeps it, in UTC: "2026-11-21 10:00 UTC". */
export function formatUtcHour(value: string | Date): string {
    const d = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(d.getTime())) return '-';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:00 UTC`;
}

/** The start of the UTC hour of `date`. */
export function utcHourStart(date: Date): Date {
    const d = new Date(date.getTime());
    d.setUTCMinutes(0, 0, 0);
    return d;
}

/** Where an offer item's price comes from, in words. */
export function priceSourceLabel(source: string | null | undefined): string {
    switch (source) {
        case 'Static': return 'static price';
        case 'Formula': return 'formula';
        case 'None': return 'no price (not for sale)';
        default: return source ?? '-';
    }
}

/** A catalogue entry's stock mode in words. */
export function stockModeLabel(mode: ShopStockMode | string | null | undefined): string {
    return mode === 'Unlimited' ? 'Unlimited (never sold out)' : 'Stocked (from Merchandise)';
}

/** A currency or stock reason in words ("SHOP_PURCHASE" → "Shop purchase", "ShopBuyBack" → "Shop buy back"). */
export function reasonLabel(reason: string | null | undefined): string {
    if (!reason) return '-';
    const words = reason.includes('_')
        ? reason.toLowerCase().split('_')
        : reason.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().split(' ');
    const text = words.filter(Boolean).join(' ');
    return text.charAt(0).toUpperCase() + text.slice(1);
}

// ---- the catalogue editor ----

export interface CatalogueForm {
    id: number | null;
    /** Set for a stackable item; a unique item gives its instance id instead. */
    blueprint: LookupPick | null;
    itemInstanceId: string;
    staticPrice: string;
    stockMode: ShopStockMode;
    pinned: boolean;
    sortOrder: string;
    enabled: boolean;
}

export const emptyCatalogueForm = (): CatalogueForm => ({
    id: null, blueprint: null, itemInstanceId: '', staticPrice: '', stockMode: 'Stocked', pinned: false, sortOrder: '0', enabled: true,
});

const isWhole = (text: string, min: number) => /^\d+$/.test(text.trim()) && Number(text) >= min;

/** What the API would refuse in a catalogue entry, one sentence each; empty when it can be saved. */
export function catalogueFormErrors(form: CatalogueForm): string[] {
    const errors: string[] = [];
    const instance = form.itemInstanceId.trim();
    if (form.id == null && !form.blueprint && instance.length === 0) errors.push('Pick an item, or give a unique item\'s instance id.');
    if (instance.length > 0 && !isWhole(instance, 1)) errors.push('The instance id is a whole number above 0.');
    if (instance.length > 0 && form.stockMode === 'Unlimited') errors.push('A unique item is one item: it can\'t be Unlimited.');
    if (form.staticPrice.trim().length > 0 && (!isWhole(form.staticPrice, 0) || Number(form.staticPrice) > SHOP_STATIC_PRICE_MAX)) {
        errors.push(`The static price is a whole number of coins up to ${SHOP_STATIC_PRICE_MAX.toLocaleString('en-US')} (0 or empty: the formula price).`);
    }
    if (!/^-?\d+$/.test(form.sortOrder.trim())) errors.push('The order is a whole number.');
    return errors;
}

/**
 * The body of a create or update: an empty static price clears it (0, the formula price). An entry keeps its shop and
 * item, so an update sends neither (null keeps them).
 */
export function catalogueBody(form: CatalogueForm, shopId: number): ShopCatalogueEntryDto {
    const instance = form.itemInstanceId.trim();
    const isNew = form.id == null;
    return {
        id: form.id,
        shopId: isNew ? shopId : null,
        itemBlueprintId: !isNew || instance.length > 0 ? null : form.blueprint?.id ?? null,
        itemInstanceId: isNew && instance.length > 0 ? Number(instance) : null,
        staticPrice: form.staticPrice.trim().length > 0 ? Number(form.staticPrice) : 0,
        stockMode: form.stockMode,
        pinned: form.pinned,
        sortOrder: Number(form.sortOrder),
        enabled: form.enabled,
    };
}

// ---- the level editor ----

export interface LevelForm {
    id: number | null;
    level: string;
    cycleSpeedMultiplier: string;
    yieldMultiplier: string;
    inputCostMultiplier: string;
    priceMultiplier: string;
    merchandiseMaxUnits: string;
    inputMaxUnits: string;
    unitsPerSlot: string;
    reorderPointUnits: string;
    targetUnits: string;
}

const text = (value: number | null | undefined) => (value == null ? '' : String(value));

export function levelForm(level: ShopTypeLevelDto | null, nextLevel = 1): LevelForm {
    return {
        id: level?.id ?? null,
        level: level?.level != null ? String(level.level) : String(nextLevel),
        cycleSpeedMultiplier: level ? text(level.cycleSpeedMultiplier) : '1',
        yieldMultiplier: level ? text(level.yieldMultiplier) : '1',
        inputCostMultiplier: level ? text(level.inputCostMultiplier) : '1',
        priceMultiplier: level ? text(level.priceMultiplier) : '1',
        merchandiseMaxUnits: text(level?.merchandiseMaxUnits),
        inputMaxUnits: text(level?.inputMaxUnits),
        unitsPerSlot: text(level?.unitsPerSlot),
        reorderPointUnits: text(level?.reorderPointUnits),
        targetUnits: text(level?.targetUnits),
    };
}

/** The API's bound for a level's multipliers. */
export const SHOP_MULTIPLIER_MAX = 100;
const isMultiplier = (value: string) => value.trim().length > 0 && Number.isFinite(Number(value)) && Number(value) > 0 && Number(value) <= SHOP_MULTIPLIER_MAX;
const isCap = (value: string) => value.trim().length === 0 || isWhole(value, 0);

/** What the API would refuse in a level, one sentence each; `taken` are the type's other level numbers. */
export function levelFormErrors(form: LevelForm, taken: number[]): string[] {
    const errors: string[] = [];
    if (!isWhole(form.level, 1) || Number(form.level) > SHOP_MAX_LEVEL) errors.push(`The level is a whole number from 1 to ${SHOP_MAX_LEVEL}.`);
    else if (taken.includes(Number(form.level))) errors.push(`The shop type already has level ${form.level}.`);
    const multipliers: [keyof LevelForm, string][] = [
        ['cycleSpeedMultiplier', 'cycle speed'], ['yieldMultiplier', 'yield'], ['inputCostMultiplier', 'input cost'], ['priceMultiplier', 'price'],
    ];
    multipliers.forEach(([key, label]) => {
        if (!isMultiplier(form[key] as string)) errors.push(`The ${label} multiplier is above 0 and at most ${SHOP_MULTIPLIER_MAX}.`);
    });
    const caps: [keyof LevelForm, string][] = [
        ['merchandiseMaxUnits', 'Merchandise cap'], ['inputMaxUnits', 'Input cap'], ['unitsPerSlot', 'units per slot'],
        ['reorderPointUnits', 'default min'], ['targetUnits', 'default max'],
    ];
    caps.forEach(([key, label]) => {
        if (!isCap(form[key] as string)) errors.push(`The ${label} is a whole number (empty: none).`);
    });
    if (isCap(form.reorderPointUnits) && isCap(form.targetUnits) && form.reorderPointUnits.trim() && form.targetUnits.trim()
        && Number(form.targetUnits) > 0 && Number(form.targetUnits) < Number(form.reorderPointUnits)) {
        errors.push('The default max is below the default min.');
    }
    return errors;
}

/** The body of a create or update: an empty cap is sent as 0 (clears it). */
export function levelBody(form: LevelForm, shopTypeId: number): ShopTypeLevelDto {
    const cap = (value: string) => (value.trim().length === 0 ? 0 : Number(value));
    return {
        id: form.id,
        shopTypeId,
        level: Number(form.level),
        cycleSpeedMultiplier: Number(form.cycleSpeedMultiplier),
        yieldMultiplier: Number(form.yieldMultiplier),
        inputCostMultiplier: Number(form.inputCostMultiplier),
        priceMultiplier: Number(form.priceMultiplier),
        merchandiseMaxUnits: cap(form.merchandiseMaxUnits),
        inputMaxUnits: cap(form.inputMaxUnits),
        unitsPerSlot: cap(form.unitsPerSlot),
        reorderPointUnits: cap(form.reorderPointUnits),
        targetUnits: cap(form.targetUnits),
    };
}

// ---- hourly trade stats ----

export type TradeStatsRange = '24h' | '7d' | '30d';
export const TRADE_STATS_RANGES: { value: TradeStatsRange; label: string; hours: number }[] = [
    { value: '24h', label: 'Last 24 hours', hours: 24 },
    { value: '7d', label: 'Last 7 days', hours: 24 * 7 },
    { value: '30d', label: 'Last 30 days', hours: 24 * 30 },
];

/** The range's UTC hours: from (inclusive) to the end of the current hour (exclusive). */
export function tradeStatsWindow(range: TradeStatsRange, now: Date): { from: Date; to: Date; hours: number } {
    const hours = TRADE_STATS_RANGES.find(r => r.value === range)?.hours ?? 24;
    const to = new Date(utcHourStart(now).getTime() + 3600_000);
    return { from: new Date(to.getTime() - hours * 3600_000), to, hours };
}

export interface TradeStatsHour {
    hourStart: Date;
    unitsSold: number;
    revenue: number;
    unitsBoughtBack: number;
    buyBackPaid: number;
    unitsSupplied: number;
}

export interface TradeStatsTotals {
    unitsSold: number;
    revenue: number;
    unitsBoughtBack: number;
    buyBackPaid: number;
    unitsSupplied: number;
}

/**
 * Every hour of the window, oldest first, with the rows of that hour summed (all items, or one blueprint). Hours without
 * a row are zero: the rollup writes no row for an hour without trade (shops DESIGN § 9.1).
 */
export function hourlySeries(rows: ShopTradeStatListDto[], from: Date, hours: number, itemBlueprintId: number | null = null): TradeStatsHour[] {
    const series: TradeStatsHour[] = [];
    const index = new Map<number, TradeStatsHour>();
    for (let i = 0; i < hours; i += 1) {
        const hourStart = new Date(from.getTime() + i * 3600_000);
        const hour = { hourStart, unitsSold: 0, revenue: 0, unitsBoughtBack: 0, buyBackPaid: 0, unitsSupplied: 0 };
        series.push(hour);
        index.set(hourStart.getTime(), hour);
    }
    rows.forEach(row => {
        if (itemBlueprintId != null && row.itemBlueprintId !== itemBlueprintId) return;
        const hour = index.get(utcHourStart(new Date(row.hourStart)).getTime());
        if (!hour) return;
        hour.unitsSold += row.unitsSold;
        hour.revenue += row.revenue;
        hour.unitsBoughtBack += row.unitsBoughtBack;
        hour.buyBackPaid += row.buyBackPaid;
        hour.unitsSupplied += row.unitsSupplied;
    });
    return series;
}

export function seriesTotals(series: TradeStatsHour[]): TradeStatsTotals {
    return series.reduce<TradeStatsTotals>((sum, h) => ({
        unitsSold: sum.unitsSold + h.unitsSold,
        revenue: sum.revenue + h.revenue,
        unitsBoughtBack: sum.unitsBoughtBack + h.unitsBoughtBack,
        buyBackPaid: sum.buyBackPaid + h.buyBackPaid,
        unitsSupplied: sum.unitsSupplied + h.unitsSupplied,
    }), { unitsSold: 0, revenue: 0, unitsBoughtBack: 0, buyBackPaid: 0, unitsSupplied: 0 });
}

/** The blueprints that occur in the rows, by name, for the item filter. */
export function statBlueprints(rows: ShopTradeStatListDto[]): { id: number; name: string }[] {
    const seen = new Map<number, string>();
    rows.forEach(row => {
        if (!seen.has(row.itemBlueprintId)) seen.set(row.itemBlueprintId, row.itemBlueprintName ?? `#${row.itemBlueprintId}`);
    });
    return Array.from(seen, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
}
