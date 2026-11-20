import type { LookupItemDto, LookupSearchResponseDto } from '../../src/apiClients/lookupClient';
import type { EntityMetadataDto } from '../../src/types/dtos/metadata/MetadataModels';
import type { StockPagedResultDto } from '../../src/types/dtos/stock/StockDtos';
import type {
  TransportLaneListDto,
  TransportOrderDto,
  TransportOrderListDto,
  TransportPlanDto,
  TransportStructureViewDto,
} from '../../src/types/dtos/production/TransportDtos';
import type { MockApi } from '../support/mockApi';
import { accessMetadata } from './dashboardAccess';
import { QUARRY, QUARRY_OUTPUT, WORLD } from './productionWorld';

/**
 * Transport core P5 in the web app (PandiO/knk-workspace#682) for e2e/transport.spec.ts, typed with the app's DTOs: the
 * smoke guide § 6 data. The Quarry (21, Output storage 31) sends Cobblestone to the warehouses North (delivery storage
 * 61, structure 51) and South (62, structure 52). Order 701 is on the road to North (a measured lane), order 702 was
 * delivered, order 703 waits for room at South (an estimated leg).
 */

export const NORTH = 51;
export const SOUTH = 52;
export const NORTH_DELIVERY = 61;
export const SOUTH_DELIVERY = 62;
export const TRANSIT = 69;
export const ORDER_ON_ROAD = 701;
export const ORDER_DELIVERED = 702;
export const ORDER_WAITING = 703;
export const LANE_NORTH = 81;
export const COBBLESTONE = 5;
export const COAL = 6;

export const UNCONNECTED_ROAD = "Not connected to its town's road network: automatic transport is held (D5).";
export const OUTPUT_FULL = 'Its Output storage is full: production stops until goods are carried away.';

export const transportOrderMetadata: EntityMetadataDto = { ...accessMetadata('TransportOrder', WORLD, false), deletable: false };
export const transportLaneMetadata: EntityMetadataDto = accessMetadata('TransportLane', WORLD);

export const orderRows: TransportOrderListDto[] = [
  {
    id: ORDER_ON_ROAD, origin: 'Automatic', status: 'InTransit', statusReason: null, sourceStorageId: QUARRY_OUTPUT, sourceStorageName: 'Quarry - output',
    sourceStructureId: QUARRY, sourceStructureName: 'Quarry', destinations: 'North - deliveries', unitsRequested: 64, unitsLoaded: 64,
    unitsDelivered: 0, unitsReturned: 0, createdAt: '2026-11-20T10:00:00Z', etaAt: '2026-11-20T10:01:40Z', completedAt: null,
  },
  {
    id: ORDER_DELIVERED, origin: 'Manual', status: 'Delivered', statusReason: null, sourceStorageId: QUARRY_OUTPUT, sourceStorageName: 'Quarry - output',
    sourceStructureId: QUARRY, sourceStructureName: 'Quarry', destinations: 'North - deliveries → South - deliveries', unitsRequested: 20,
    unitsLoaded: 20, unitsDelivered: 20, unitsReturned: 0, createdAt: '2026-11-20T09:00:00Z', etaAt: null, completedAt: '2026-11-20T09:05:00Z',
  },
  {
    id: ORDER_WAITING, origin: 'Automatic', status: 'AwaitingSpace', statusReason: 'South - deliveries has no room for 30 Cobblestone.',
    sourceStorageId: QUARRY_OUTPUT, sourceStorageName: 'Quarry - output', sourceStructureId: QUARRY, sourceStructureName: 'Quarry',
    destinations: 'South - deliveries', unitsRequested: 30, unitsLoaded: 30, unitsDelivered: 0, unitsReturned: 0,
    createdAt: '2026-11-20T08:00:00Z', etaAt: null, completedAt: null,
  },
];

/** `GET api/TransportOrders/701`: Cobblestone on the road to North over a measured lane, loaded by transaction 901. */
export function orderOnRoad(values: Partial<TransportOrderDto> = {}): TransportOrderDto {
  return {
    id: ORDER_ON_ROAD, origin: 'Automatic', status: 'InTransit', statusReason: null,
    sourceStorageId: QUARRY_OUTPUT, sourceStorage: { id: QUARRY_OUTPUT, name: 'Quarry - output' },
    sourceStructureId: QUARRY, sourceStructure: { id: QUARRY, name: 'Quarry' },
    cargoStorageId: TRANSIT, cargoStorage: { id: TRANSIT, name: 'Transport #701 - transit' },
    carrierStructureId: QUARRY, carrierStructure: { id: QUARRY, name: 'Quarry' }, carrierCapacity: 64, risk: null,
    currentStructureId: null, currentStopId: 7011, reroutes: 0, cancelRequested: false,
    executeAfter: '2026-11-20T10:00:00Z', nextActionAt: '2026-11-20T10:01:40Z', createdAt: '2026-11-20T10:00:00Z',
    departedAt: '2026-11-20T10:00:00Z', legStartedAt: '2026-11-20T10:00:00Z', etaAt: '2026-11-20T10:01:40Z',
    waitingSince: null, completedAt: null, createdByUserId: null, note: null, clientKey: null, isFinal: false,
    inTransit: [{ itemBlueprintId: COBBLESTONE, itemBlueprintName: 'Cobblestone', amount: 64 }],
    stops: [{
      id: 7011, sequence: 1, storageId: NORTH_DELIVERY, storage: { id: NORTH_DELIVERY, name: 'North - deliveries' },
      structureId: NORTH, structure: { id: NORTH, name: 'North' }, status: 'Pending', reroutedFromStopId: null,
      distanceBlocks: 431.7, distanceSource: 'Lane', etaAt: '2026-11-20T10:01:40Z', arrivedAt: null, completedAt: null, attempts: 1,
      lines: [{ id: 1, itemBlueprintId: COBBLESTONE, itemBlueprintName: 'Cobblestone', planned: 64, delivered: 0 }],
    }],
    lines: [{ id: 1, itemBlueprintId: COBBLESTONE, itemBlueprintName: 'Cobblestone', requested: 64, loaded: 64, delivered: 0, returned: 0, lost: 0 }],
    assignments: [{
      id: 1, mode: 'Simulated', carrierStructureId: QUARRY, carrierStructure: { id: QUARRY, name: 'Quarry' }, workers: 1,
      speedBlocksPerSecond: 4.317, capacity: 64, assignedAt: '2026-11-20T10:00:00Z', releasedAt: null,
    }],
    // Sent newest first on purpose: the timeline shows them oldest first.
    events: [
      { id: 4, at: '2026-11-20T10:00:00Z', kind: 'Departed', statusAfter: 'InTransit', transportStopId: 7011, stockTransactionId: null, message: 'On the way to North - deliveries (431.7 blocks).' },
      { id: 3, at: '2026-11-20T10:00:00Z', kind: 'Loaded', statusAfter: 'Loading', transportStopId: null, stockTransactionId: 901, message: 'Loaded 64 Cobblestone.' },
      { id: 2, at: '2026-11-20T10:00:00Z', kind: 'Assigned', statusAfter: 'Assigned', transportStopId: null, stockTransactionId: null, message: 'A worker of Quarry carries it.' },
      { id: 1, at: '2026-11-20T10:00:00Z', kind: 'Created', statusAfter: 'Planned', transportStopId: null, stockTransactionId: null, message: 'Output at 80 of 100 units (threshold 75).' },
    ],
    ...values,
  };
}

/** A dry run of a manual order: 64 Cobblestone wanted, 40 at the source, one estimated leg to South. */
export function dryRun(values: Partial<TransportPlanDto> = {}): TransportPlanDto {
  return {
    valid: true, errors: [], warnings: ['Only 40 of 64 Cobblestone at the source: loading takes 40.', 'No measured lane to South: estimated route.'],
    sourceStorageId: QUARRY_OUTPUT, sourceStructureId: QUARRY, carrierStructureId: QUARRY, carrierCapacity: 64, speedBlocksPerSecond: 4.317,
    workersPresent: 1, workersTotal: 2,
    lines: [{ itemBlueprintId: COBBLESTONE, itemBlueprintName: 'Cobblestone', requested: 64, available: 40 }],
    legs: [{
      sequence: 1, fromStructureId: QUARRY, toStructureId: SOUTH, toStorageId: SOUTH_DELIVERY, toStorageName: 'South - deliveries',
      distanceBlocks: 420, distanceSource: 'Estimated', seconds: 97, lines: [{ itemBlueprintId: COBBLESTONE, amount: 64 }], roomUnits: null,
    }],
    totalUnits: 64, totalSeconds: 97,
    ...values,
  };
}

/** `GET api/ProductionStructures/21/transport`: the Quarry, unconnected and full, so the trigger is held (A13). */
export function quarryTransport(values: Partial<TransportStructureViewDto> = {}): TransportStructureViewDto {
  return {
    productionStructureId: QUARRY, featureEnabled: true, automaticTransport: true, roadConnection: 'Unconnected', isRural: true,
    effectiveTownId: 4, outputStorageId: QUARRY_OUTPUT, outputUnits: 100, outputMaxUnits: 100, threshold: 75, carrierCapacity: 64,
    workersPresent: 1, workersTotal: 2, workersAway: 1,
    warnings: [UNCONNECTED_ROAD, OUTPUT_FULL],
    triggerReasons: ['Output at 100 of 100 units (threshold 75).'],
    heldReasons: ['No road connection: automatic transport is held (D5).'],
    wouldCreate: null, destinationWarehouseId: NORTH,
    openOrders: [orderRows[0]],
    ...values,
  };
}

export const laneRows: TransportLaneListDto[] = [
  {
    id: LANE_NORTH, fromStructureId: QUARRY, fromStructureName: 'Quarry', toStructureId: NORTH, toStructureName: 'North', reachable: true,
    roadDistance: 431.7, straightDistance: 300, source: 'Plugin', measuredAt: '2026-11-20T09:00:00Z',
  },
];

/** A `POST .../search` answering fixed rows with the API's paging (`pageNumber`). */
export function mockPaged<T>(api: MockApi, path: string | RegExp, rows: T[]): void {
  api.on<StockPagedResultDto<T>>('POST', path, ({ body }) => {
    const query = body as { pageNumber?: number; pageSize?: number };
    return { body: { items: rows, totalCount: rows.length, pageNumber: query.pageNumber ?? 1, pageSize: query.pageSize ?? 25 } };
  });
}

const lookups: Record<string, LookupItemDto[]> = {
  ItemBlueprint: [{ id: COBBLESTONE, label: 'Cobblestone' }, { id: COAL, label: 'Coal' }],
  Storage: [
    { id: QUARRY_OUTPUT, label: 'Quarry - output' },
    { id: NORTH_DELIVERY, label: 'North - deliveries' },
    { id: SOUTH_DELIVERY, label: 'South - deliveries' },
  ],
  ProductionStructure: [{ id: QUARRY, label: 'Quarry' }],
};

/** `api/Lookup/{type}/search` for the manual order page's pickers. */
export function mockTransportLookups(api: MockApi): void {
  for (const [type, items] of Object.entries(lookups)) {
    api.on<LookupSearchResponseDto>('POST', `Lookup/${type}/search`, ({ body }) => {
      const term = ((body as { searchTerm?: string | null }).searchTerm ?? '').toLowerCase();
      const matches = items.filter(i => !term || i.label.toLowerCase().includes(term));
      return { body: { items: matches, total: matches.length } };
    });
  }
}

/**
 * The transport panel of any production structure page with nothing to show: no warnings, no orders, no lanes. Strict
 * specs that open a production structure page (production-world, -engine, -yield) use it; e2e/transport.spec.ts covers
 * the panel.
 */
export function mockNoTransport(api: MockApi): void {
  api.on<TransportStructureViewDto>('GET', /^ProductionStructures\/\d+\/transport$/, ({ path }) => ({
    body: quarryTransport({
      productionStructureId: Number(path.split('/')[1]), roadConnection: 'Connected', outputUnits: 0, workersAway: 0,
      warnings: [], triggerReasons: [], heldReasons: [], destinationWarehouseId: null, openOrders: [],
    }),
  }));
  mockPaged<TransportLaneListDto>(api, 'TransportLanes/search', []);
}
