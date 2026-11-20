import {
    ProductionTransportSettingsDto,
    TransportOrderCreateDto,
    TransportOrderDto,
    TransportPlanDto,
} from '../types/dtos/production/TransportDtos';
import { formatNumber } from './productionEngine';

/**
 * Transport core P5 helpers for the web app (PandiO/knk-workspace#682; production DESIGN § 7, § 11.1). Pure functions:
 * the panels, the manual order page and the settings card use them, Jest tests them.
 */

/** Manual orders, dry runs, cancel and Run transport now need this node (or the plugin key). */
export const TRANSPORT_WRITE_NODE = 'knk.admin.world';

const STATUS_WORDS: Record<string, string> = {
    Planned: 'Planned',
    Assigned: 'Carrier assigned',
    Loading: 'Loading',
    InTransit: 'On the road',
    AtStop: 'At a stop',
    AwaitingSpace: 'Waiting for room',
    Returning: 'Returning',
    ReturnBlocked: 'Back, waiting for room at the source',
    Delivered: 'Delivered',
    Returned: 'Returned',
    Cancelled: 'Cancelled',
    Ambushed: 'Ambushed',
    Defended: 'Defended',
    Robbed: 'Robbed',
    Lost: 'Lost',
    Stalled: 'Stalled',
};

/** An order status in words ("InTransit" → "On the road"); unknown values as sent. */
export function transportStatusLabel(status: string | null | undefined): string {
    if (!status) return '-';
    return STATUS_WORDS[status] ?? status;
}

/** The final statuses (DESIGN § 7.2): nothing moves any more. */
export const FINAL_TRANSPORT_STATUSES: readonly string[] = ['Delivered', 'Returned', 'Cancelled', 'Lost'];

/** A status that needs a look: waiting for room, held at the source, stalled or worse. */
export function transportStatusIsProblem(status: string | null | undefined): boolean {
    return status === 'AwaitingSpace' || status === 'ReturnBlocked' || status === 'Stalled' || status === 'Robbed'
        || status === 'Lost' || status === 'Ambushed';
}

/** Whether staff can still cancel the order (the API answers 409 for a final or returning order). */
export function canCancelOrder(order: Pick<TransportOrderDto, 'status' | 'isFinal'>): boolean {
    return !order.isFinal && !FINAL_TRANSPORT_STATUSES.includes(order.status)
        && order.status !== 'Returning' && order.status !== 'ReturnBlocked';
}

const EVENT_WORDS: Record<string, string> = {
    Created: 'Created',
    WaitingForWorker: 'Waiting for a worker',
    Assigned: 'Carrier assigned',
    Loaded: 'Loaded',
    Departed: 'Departed',
    ArrivedAtStop: 'Arrived at a stop',
    Delivered: 'Delivered',
    AwaitingSpace: 'Waiting for room',
    Rerouted: 'Re-routed',
    ReturnStarted: 'Return started',
    Returned: 'Returned',
    ReturnBlocked: 'Return blocked',
    WorkerReturned: 'Worker back',
    Completed: 'Completed',
    CancelRequested: 'Cancel requested',
    Cancelled: 'Cancelled',
    Note: 'Note',
};

/** An event kind in words ("ArrivedAtStop" → "Arrived at a stop"). */
export function transportEventLabel(kind: string | null | undefined): string {
    if (!kind) return '-';
    return EVENT_WORDS[kind] ?? kind;
}

const DISTANCE_WORDS: Record<string, string> = {
    Lane: 'measured lane',
    Estimated: 'estimated (straight line × factor)',
    Fallback: 'fallback distance',
    TurnedAround: 'turned around (the way it came)',
};

/** Where a leg's distance came from, in words. */
export function distanceSourceLabel(source: string | null | undefined): string {
    if (!source) return 'not planned yet';
    return DISTANCE_WORDS[source] ?? source;
}

/** "431.7 blocks (measured lane)". */
export function formatDistance(blocks: number | null | undefined, source?: string | null): string {
    if (blocks == null || !Number.isFinite(blocks)) return '-';
    const text = `${formatNumber(blocks, 1)} blocks`;
    return source ? `${text} (${distanceSourceLabel(source)})` : text;
}

/** The order's events oldest first (the API sends them in its own order; ties keep the id order). */
export function timelineOf<T extends { at: string; id: number }>(events: T[] | null | undefined): T[] {
    return [...(events ?? [])].sort((a, b) => {
        const diff = new Date(a.at).getTime() - new Date(b.at).getTime();
        return diff !== 0 ? diff : a.id - b.id;
    });
}

/** "64 / 100 units" or "64 units" for an uncapped storage. */
export function formatUnits(units: number | null | undefined, max?: number | null): string {
    const value = formatNumber(units ?? 0, 2);
    return max != null ? `${value} / ${formatNumber(max, 0)} units` : `${value} units`;
}

// ---------------------------------------------------------------- manual order form

/** One stop line on the manual order page, as typed. */
export interface OrderFormLine {
    blueprintId: number | null;
    amount: string;
}

/** One stop on the manual order page, as typed. */
export interface OrderFormStop {
    storageId: number | null;
    lines: OrderFormLine[];
}

export interface OrderForm {
    sourceStorageId: number | null;
    carrierStructureId: number | null;
    origin: 'Manual' | 'Quest';
    /** A `datetime-local` value, or empty for "now". */
    executeAfter: string;
    note: string;
}

/** What the form would send; amounts that are not whole numbers become NaN, which `orderFormErrors` reports. */
export function toOrderRequest(form: OrderForm, stops: OrderFormStop[], clientKey?: string | null): TransportOrderCreateDto {
    const executeAfter = form.executeAfter.trim() ? new Date(form.executeAfter).toISOString() : null;
    return {
        sourceStorageId: form.sourceStorageId ?? 0,
        carrierStructureId: form.carrierStructureId ?? null,
        origin: form.origin,
        executeAfter,
        note: form.note.trim() || null,
        clientKey: clientKey ?? null,
        stops: stops.map(stop => ({
            storageId: stop.storageId ?? 0,
            lines: stop.lines.map(line => ({
                itemBlueprintId: line.blueprintId ?? 0,
                amount: line.amount.trim() === '' ? Number.NaN : Number(line.amount),
            })),
        })),
    };
}

/** The problems the API would refuse before planning (a missing source, stop, blueprint or amount); empty when the
 *  request can be dry-run. The plan's own errors (no stock, no route) come from the API. */
export function orderFormErrors(request: TransportOrderCreateDto): string[] {
    const errors: string[] = [];
    if (!request.sourceStorageId) errors.push('Pick the source storage.');
    if (request.stops.length === 0) errors.push('Add at least one stop.');
    request.stops.forEach((stop, i) => {
        const n = i + 1;
        if (!stop.storageId) errors.push(`Stop ${n}: pick its storage.`);
        else if (stop.storageId === request.sourceStorageId) errors.push(`Stop ${n}: the source storage can't be a stop.`);
        if (stop.lines.length === 0) errors.push(`Stop ${n}: add at least one item.`);
        stop.lines.forEach((line, j) => {
            if (!line.itemBlueprintId) errors.push(`Stop ${n}, item ${j + 1}: pick the blueprint.`);
            if (!Number.isInteger(line.amount) || line.amount < 1) errors.push(`Stop ${n}, item ${j + 1}: the amount is a whole number of at least 1.`);
        });
    });
    const storages = request.stops.map(stop => stop.storageId).filter(Boolean);
    if (new Set(storages).size !== storages.length) errors.push('Each storage can be a stop once.');
    return errors;
}

/** The requested units per blueprint that the source can't fully cover (the dry run's short stock). */
export function shortLines(plan: Pick<TransportPlanDto, 'lines'>): { name: string; requested: number; available: number }[] {
    return plan.lines
        .filter(line => line.available < line.requested)
        .map(line => ({ name: line.itemBlueprintName ?? `Blueprint #${line.itemBlueprintId}`, requested: line.requested, available: line.available }));
}

// ---------------------------------------------------------------- settings

/** The transport defaults (knk-web-api `ProductionTransportSettingsDto`). */
export const defaultTransportSettings = (): ProductionTransportSettingsDto => ({
    walkingSpeedBlocksPerSecond: 4.317,
    defaultCarrierCapacity: 64,
    defaultThresholdPercent: 75,
    defaultThresholdUnits: 64,
    unmeasuredRouteFactor: 1.4,
    fallbackDistanceBlocks: 200,
    awaitingSpaceMinutes: 30,
    maxReroutes: 2,
    laneMaxAgeHours: 24,
});

/** The API's bounds for `production.transport`: [min, max, whole numbers only]. */
export const TRANSPORT_SETTINGS_LIMITS: Record<keyof ProductionTransportSettingsDto, [number, number, boolean]> = {
    walkingSpeedBlocksPerSecond: [0.1, 50, false],
    defaultCarrierCapacity: [1, 1_000_000, true],
    defaultThresholdPercent: [1, 100, true],
    defaultThresholdUnits: [1, 1_000_000, true],
    unmeasuredRouteFactor: [1, 10, false],
    fallbackDistanceBlocks: [1, 1_000_000, true],
    awaitingSpaceMinutes: [1, 10_080, true],
    maxReroutes: [0, 10, true],
    laneMaxAgeHours: [1, 8760, true],
};

/** The transport settings the API would refuse, one sentence each; empty when valid. */
export function transportSettingsErrors(settings: ProductionTransportSettingsDto): string[] {
    const errors: string[] = [];
    (Object.keys(TRANSPORT_SETTINGS_LIMITS) as (keyof ProductionTransportSettingsDto)[]).forEach(key => {
        const [min, max, whole] = TRANSPORT_SETTINGS_LIMITS[key];
        const value = settings[key];
        if (!Number.isFinite(value) || value < min || value > max || (whole && !Number.isInteger(value))) {
            errors.push(`production.transport.${key} must be ${whole ? 'a whole number' : 'a number'} between ${min} and ${max}.`);
        }
    });
    return errors;
}

// ---------------------------------------------------------------- pages

export const TRANSPORT_ORDERS_PATH = '/admin/transport/orders';
export const NEW_TRANSPORT_ORDER_PATH = '/admin/transport/orders/new';

/** The order list's filters, as URL parameters (the API's search filter names). */
export const ORDER_FILTER_KEYS = ['status', 'origin', 'open', 'structureId', 'storageId'] as const;
export type OrderFilterKey = typeof ORDER_FILTER_KEYS[number];

/** The order list with these filters (empty ones are left out). */
export function ordersPath(filters: Partial<Record<OrderFilterKey, string>> = {}): string {
    const params = new URLSearchParams();
    ORDER_FILTER_KEYS.forEach(key => {
        const value = filters[key]?.trim();
        if (value) params.set(key, value);
    });
    const search = params.toString();
    return search ? `${TRANSPORT_ORDERS_PATH}?${search}` : TRANSPORT_ORDERS_PATH;
}

/** The manual order page, optionally with the source storage and carrier filled in. */
export function newOrderPath(sourceStorageId?: number | null, carrierStructureId?: number | null): string {
    const params = new URLSearchParams();
    if (sourceStorageId) params.set('sourceStorageId', String(sourceStorageId));
    if (carrierStructureId) params.set('carrierStructureId', String(carrierStructureId));
    const search = params.toString();
    return search ? `${NEW_TRANSPORT_ORDER_PATH}?${search}` : NEW_TRANSPORT_ORDER_PATH;
}

/** The list filters read from the URL; unknown keys are dropped. */
export function readOrderFilters(params: URLSearchParams): Partial<Record<OrderFilterKey, string>> {
    const filters: Partial<Record<OrderFilterKey, string>> = {};
    ORDER_FILTER_KEYS.forEach(key => {
        const value = params.get(key)?.trim();
        if (value) filters[key] = value;
    });
    return filters;
}
