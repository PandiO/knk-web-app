import type { EntityMetadataDto } from '../../src/types/dtos/metadata/MetadataModels';
import type { LookupItemDto, LookupSearchResponseDto } from '../../src/apiClients/lookupClient';
import type {
  ConsumerReplenishmentListDto,
  ConsumerViewDto,
  LogisticsPlanDto,
  LogisticsPlanEntryDto,
  LogisticsPlannerRunDto,
  LogisticsPlannerRunListDto,
  LogisticsPolicyDto,
  LogisticsPolicyListDto,
  LogisticsReservationDto,
  LogisticsReservationListDto,
  TownServiceAreasDto,
  TownSupplyDto,
} from '../../src/types/dtos/production/LogisticsDtos';
import type { MockApi } from '../support/mockApi';
import { accessMetadata } from './dashboardAccess';
import { MARKET, PHOENIX, WORLD } from './productionWorld';
import { COAL, NORTH, NORTH_DELIVERY, SOUTH, SOUTH_DELIVERY, mockPaged } from './transport';

/**
 * Town logistics P9b in the web app (PandiO/knk-workspace#686) for e2e/logistics.spec.ts, typed with the app's DTOs: the
 * smoke guide § 10 data. Phoenix (4) has the warehouses North (51, delivery storage 61) and South (52, 62); the
 * consumers Bakery (24, Input storage 94) and Garrison (25, Input storage 95) are in the district Market (8). Coal (6)
 * stands in for flour and Iron ore (7) for bread. Policy 40 is Phoenix's v2 (v1 is 39), 50 a template.
 */

export { COAL, NORTH, NORTH_DELIVERY, SOUTH, SOUTH_DELIVERY, PHOENIX, MARKET, WORLD, mockPaged };
export const IRON_ORE = 7;
export const BAKERY = 24;
export const GARRISON = 25;
export const BAKERY_INPUTS = 94;
export const GARRISON_INPUTS = 95;
export const POLICY_V1 = 39;
export const POLICY_V2 = 40;
export const TEMPLATE = 50;
export const RUN = 300;
export const RESERVATION = 600;
export const COLLECTION_ORDER = 710;

export const logisticsPolicyMetadata: EntityMetadataDto = accessMetadata('LogisticsPolicy', WORLD);
export const logisticsRunMetadata: EntityMetadataDto = { ...accessMetadata('LogisticsPlannerRun', WORLD, false), deletable: false };
export const logisticsReservationMetadata: EntityMetadataDto = { ...accessMetadata('LogisticsReservation', WORLD, false), deletable: false };
export const consumerReplenishmentMetadata: EntityMetadataDto = accessMetadata('ConsumerReplenishment', WORLD);

const phoenix = { id: PHOENIX, name: 'Phoenix' };
const coal = { id: COAL, name: 'Coal' };

/** `GET api/LogisticsPolicies/40`: Phoenix's current policy, a town reserve of 70 Coal and a Critical garrison. */
export function phoenixPolicy(values: Partial<LogisticsPolicyDto> = {}): LogisticsPolicyDto {
  return {
    id: POLICY_V2, name: 'Phoenix logistics', scope: 'Town', townId: PHOENIX, town: phoenix, warehouseId: null, warehouse: null,
    specialization: null, townSize: null, isDefaultTemplate: false, version: 2, lineageId: POLICY_V1, isCurrent: true,
    basedOnPolicyId: POLICY_V1, supersededByPolicyId: null, supersededAt: null, author: 'Admin', reason: 'Bread reserve 14 days',
    createdAt: '2026-11-21T10:00:00Z', createdByUserId: 7,
    rules: [
      {
        id: 401, logisticsPolicyId: POLICY_V2, sequence: 1, type: 'Reserve', scope: 'Town', targetKind: 'Blueprint', itemBlueprintId: COAL,
        itemBlueprint: coal, consumerKind: 'Any', units: 70, daysOfCover: null, author: 'Admin', reason: 'Keep some back',
        summary: 'Town reserve: 70 × Coal',
      },
      {
        id: 402, logisticsPolicyId: POLICY_V2, sequence: 2, type: 'PriorityClass', scope: 'Town', targetKind: 'Any', consumerKind: 'Structure',
        structureId: GARRISON, structure: { id: GARRISON, name: 'Garrison' }, priorityClass: 'Critical', author: 'Admin', reason: null,
        summary: 'Garrison: Critical for every item',
      },
    ],
    ...values,
  };
}

export const policyVersions: LogisticsPolicyListDto[] = [
  {
    id: POLICY_V2, name: 'Phoenix logistics', scope: 'Town', townId: PHOENIX, townName: 'Phoenix', isDefaultTemplate: false, version: 2,
    lineageId: POLICY_V1, isCurrent: true, ruleCount: 2, reason: 'Bread reserve 14 days', createdAt: '2026-11-21T10:00:00Z',
  },
  {
    id: POLICY_V1, name: 'Phoenix logistics', scope: 'Town', townId: PHOENIX, townName: 'Phoenix', isDefaultTemplate: false, version: 1,
    lineageId: POLICY_V1, isCurrent: false, ruleCount: 1, reason: 'From template "Farming village" v1.', createdAt: '2026-11-20T10:00:00Z',
  },
];

export const templateRow: LogisticsPolicyListDto = {
  id: TEMPLATE, name: 'Farming village', scope: 'Template', specialization: 'Crops', townSize: 'Village', isDefaultTemplate: true,
  version: 1, lineageId: TEMPLATE, isCurrent: true, ruleCount: 1, reason: 'First', createdAt: '2026-11-19T10:00:00Z',
};

export function farmingTemplate(values: Partial<LogisticsPolicyDto> = {}): LogisticsPolicyDto {
  return {
    id: TEMPLATE, name: 'Farming village', scope: 'Template', townId: null, warehouseId: null, specialization: 'Crops', townSize: 'Village',
    isDefaultTemplate: true, version: 1, lineageId: TEMPLATE, isCurrent: true, author: 'Admin', reason: 'First', createdAt: '2026-11-19T10:00:00Z',
    rules: [{ id: 501, sequence: 1, type: 'Reserve', scope: 'Town', targetKind: 'Blueprint', itemBlueprintId: COAL, itemBlueprint: coal, units: 80, summary: 'Town reserve: 80 × Coal' }],
    ...values,
  };
}

export const openReservation: LogisticsReservationListDto = {
  id: RESERVATION, townId: PHOENIX, townName: 'Phoenix', warehouseId: NORTH, warehouseName: 'North', consumerStructureId: GARRISON,
  consumerStructureName: 'Garrison', consumerStorageId: GARRISON_INPUTS, itemBlueprintId: COAL, itemBlueprintName: 'Coal', amount: 30,
  collected: 0, status: 'Open', priorityClass: 'Critical', transportOrderId: COLLECTION_ORDER, createdAt: '2026-11-21T10:00:00Z',
  expiresAt: '2026-11-21T10:30:00Z',
};

export const lastRun: LogisticsPlannerRunListDto = {
  id: RUN, townId: PHOENIX, townName: 'Phoenix', trigger: 'Scheduled', startedAt: '2026-11-21T10:00:00Z', policyVersion: 2, demandLines: 2,
  reservationsCreated: 1, ordersCreated: 1, reservationsReleased: 0, shortfalls: 1, summary: '1 reserved (30 units) in 1 collection order(s); 1 short',
};

/** `GET api/Logistics/towns/4/supply`: 100 Coal (70 held by the reserve, 30 reserved for the garrison), Iron ore running low. */
export function phoenixSupply(values: Partial<TownSupplyDto> = {}): TownSupplyDto {
  return {
    townId: PHOENIX, townName: 'Phoenix', featureEnabled: true, at: '2026-11-21T10:05:00Z', consumptionWindowDays: 7,
    warehouses: [{ id: NORTH, name: 'North' }, { id: SOUTH, name: 'South' }],
    lines: [
      {
        itemBlueprintId: COAL, itemBlueprintName: 'Coal', stock: 100, reserved: 30, reserveUnits: 70, available: 0, inflowPerDay: 24,
        outflowPerDay: 10, daysOfCover: 10,
        warehouses: [
          { warehouseId: NORTH, warehouseName: 'North', stock: 100, reserved: 30, reserveUnits: 70, available: 0 },
          { warehouseId: SOUTH, warehouseName: 'South', stock: 0, reserved: 0, reserveUnits: 0, available: 0 },
        ],
      },
      {
        itemBlueprintId: IRON_ORE, itemBlueprintName: 'Iron ore', stock: 20, reserved: 0, reserveUnits: 0, available: 20, inflowPerDay: 0,
        outflowPerDay: 8, daysOfCover: 2.5,
        warehouses: [{ warehouseId: SOUTH, warehouseName: 'South', stock: 20, reserved: 0, reserveUnits: 0, available: 20 }],
      },
    ],
    openReservations: [openReservation], policyId: POLICY_V2, policySource: 'Town', lastRun, nextRunAt: '2026-11-21T10:10:00Z',
    ...values,
  };
}

export const phoenixServiceAreas: TownServiceAreasDto = {
  townId: PHOENIX,
  entries: [
    { areaKind: 'District', districtId: MARKET, districtName: 'Market', warehouseId: SOUTH, warehouseName: 'South', source: 'Rule', ruleId: 403 },
    { areaKind: 'Rural', warehouseId: NORTH, warehouseName: 'North', source: 'Nearest' },
    { areaKind: 'Structure', structureId: BAKERY, structureName: 'Bakery', warehouseId: SOUTH, warehouseName: 'South', source: 'Rule', ruleId: 403 },
  ],
};

export const bakeryHeld: LogisticsPlanEntryDto = {
  consumerStructureId: BAKERY, consumerStructureName: 'Bakery', consumerStorageId: BAKERY_INPUTS, consumerStorageName: 'Bakery inputs',
  itemBlueprintId: COAL, itemBlueprintName: 'Coal', warehouseId: null, warehouseName: null, priorityClass: 'Normal', stock: 0, reorderPoint: 20,
  targetLevel: 60, shortfall: 60, reserved: 0, outcome: 'HeldByReserve', settingSource: 'Setting', ruleIds: [401],
  explanation: 'Bakery inputs: min 20, max 60 (replenishment setting #3). Coal 0 with what is on the way: short 60; Normal priority (the default). '
    + 'Nothing reserved: town reserve 70 (rule #401) and 30 already reserved.',
};

export const garrisonReserved: LogisticsPlanEntryDto = {
  consumerStructureId: GARRISON, consumerStructureName: 'Garrison', consumerStorageId: GARRISON_INPUTS, consumerStorageName: 'Garrison inputs',
  itemBlueprintId: COAL, itemBlueprintName: 'Coal', warehouseId: NORTH, warehouseName: 'North', priorityClass: 'Critical', stock: 0, reorderPoint: 20,
  targetLevel: 60, shortfall: 60, reserved: 30, outcome: 'PartlyReserved', settingSource: 'Setting', ruleIds: [401, 402],
  reservationId: null, transportOrderId: null,
  explanation: 'Garrison inputs: short 60; Critical priority (rule #402). Reserved 30 of 60 at North (town reserve 70); collected by its own worker.',
};

/** `POST api/Logistics/towns/4/dry-run`: the garrison first (Critical) gets 30, the bakery is held by the reserve. */
export function phoenixDryRun(values: Partial<LogisticsPlanDto> = {}): LogisticsPlanDto {
  return {
    townId: PHOENIX, townName: 'Phoenix', featureEnabled: false, dryRun: true, at: '2026-11-21T10:05:00Z', runId: null, policyId: POLICY_V2,
    policyName: 'Phoenix logistics', policyVersion: 2, policySource: 'Town', entries: [garrisonReserved, bakeryHeld],
    orders: [{
      consumerStructureId: GARRISON, consumerStructureName: 'Garrison', consumerStorageId: GARRISON_INPUTS, warehouseId: NORTH, warehouseName: 'North',
      warehouseStorageId: NORTH_DELIVERY, lines: [{ itemBlueprintId: COAL, amount: 30 }], carrierCapacity: 64, workersPresent: 2, workersTotal: 2,
      transportOrderId: null, warnings: [],
    }],
    released: [], collected: [], warnings: ['Production is off: this is a dry run only.'],
    summary: '1 reserved (30 units) in 1 collection order(s); 1 held',
    ...values,
  };
}

export function storedRun(values: Partial<LogisticsPlannerRunDto> = {}): LogisticsPlannerRunDto {
  return {
    id: RUN, townId: PHOENIX, town: phoenix, logisticsPolicyId: POLICY_V2, policyVersion: 2, trigger: 'Manual', startedAt: '2026-11-21T10:00:00Z',
    finishedAt: '2026-11-21T10:00:01Z', demandLines: 2, reservationsCreated: 1, ordersCreated: 1, reservationsReleased: 0, reservationsCollected: 0,
    shortfalls: 1, summary: '1 reserved (30 units) in 1 collection order(s); 1 held', createdByUserId: 7,
    entries: [{ ...garrisonReserved, reservationId: RESERVATION, transportOrderId: COLLECTION_ORDER }, bakeryHeld],
    ...values,
  };
}

export function reservationDetail(values: Partial<LogisticsReservationDto> = {}): LogisticsReservationDto {
  return {
    id: RESERVATION, townId: PHOENIX, town: phoenix, warehouseId: NORTH, warehouse: { id: NORTH, name: 'North' }, warehouseStorageId: NORTH_DELIVERY,
    warehouseStorage: { id: NORTH_DELIVERY, name: 'North - deliveries' }, consumerStructureId: GARRISON, consumerStructure: { id: GARRISON, name: 'Garrison' },
    consumerStorageId: GARRISON_INPUTS, consumerStorage: { id: GARRISON_INPUTS, name: 'Garrison inputs' }, itemBlueprintId: COAL, itemBlueprint: coal,
    amount: 30, collected: 0, status: 'Open', priorityClass: 'Critical', transportOrderId: COLLECTION_ORDER, transportOrderStatus: 'Planned',
    plannerRunId: RUN, createdAt: '2026-11-21T10:00:00Z', expiresAt: '2026-11-21T10:30:00Z', closedAt: null,
    explanation: garrisonReserved.explanation, statusReason: null,
    ...values,
  };
}

/** `GET api/Logistics/consumers/24`: the bakery, its Input storage with a setting for Coal and a min/max from its inputs for Iron ore. */
export function bakeryConsumer(values: Partial<ConsumerViewDto> = {}): ConsumerViewDto {
  return {
    structureId: BAKERY, structureName: 'Bakery', townId: PHOENIX, isConsumer: true, hasWorkers: true, workersTotal: 2, workersPresent: 1,
    carrierCapacity: 64, serviceWarehouseId: SOUTH, serviceWarehouseName: 'South', serviceSource: 'Rule',
    storages: [{
      storageId: BAKERY_INPUTS, storageName: 'Bakery inputs', purpose: 'Input',
      lines: [
        { itemBlueprintId: COAL, itemBlueprintName: 'Coal', stock: 10, inbound: 0, reorderPoint: 20, targetLevel: 60, priorityClass: 'Normal', settingSource: 'Setting', consumerReplenishmentId: 3, ruleIds: [] },
        { itemBlueprintId: IRON_ORE, itemBlueprintName: 'Iron ore', stock: 40, inbound: 0, reorderPoint: 10, targetLevel: 30, priorityClass: 'Normal', settingSource: 'Inputs', ruleIds: [] },
      ],
    }],
    openReservations: [], warnings: ['One of 2 workers is away: output is lowered while it is (DESIGN § 7.7).'],
    ...values,
  };
}

export const bakerySettings: ConsumerReplenishmentListDto[] = [{
  id: 3, storageId: BAKERY_INPUTS, storageName: 'Bakery inputs', structureId: BAKERY, structureName: 'Bakery', itemBlueprintId: COAL,
  itemBlueprintName: 'Coal', reorderPoint: 20, targetLevel: 60, priorityClass: null, enabled: true, updatedAt: '2026-11-21T09:00:00Z',
}];

const lookups: Record<string, LookupItemDto[]> = {
  ItemBlueprint: [{ id: COAL, label: 'Coal' }, { id: IRON_ORE, label: 'Iron ore' }],
  Warehouse: [{ id: NORTH, label: 'North' }, { id: SOUTH, label: 'South' }],
  District: [{ id: MARKET, label: 'Market' }],
  Structure: [{ id: BAKERY, label: 'Bakery' }, { id: GARRISON, label: 'Garrison' }],
  Town: [{ id: PHOENIX, label: 'Phoenix' }],
};

/** `api/Lookup/{type}/search` for the rule editor's and the settings form's pickers. */
export function mockLogisticsLookups(api: MockApi): void {
  for (const [type, items] of Object.entries(lookups)) {
    api.on<LookupSearchResponseDto>('POST', `Lookup/${type}/search`, ({ body }) => {
      const term = ((body as { searchTerm?: string | null }).searchTerm ?? '').toLowerCase();
      const matches = items.filter(i => !term || i.label.toLowerCase().includes(term));
      return { body: { items: matches, total: matches.length } };
    });
  }
}

/**
 * The town page's logistics panel with nothing to show (no warehouses, no lines, no runs). Strict specs that open a town
 * page as staff with knk.admin.world use it (territory, landmarks); e2e/logistics.spec.ts covers the panel.
 */
export function mockNoTownLogistics(api: MockApi, townId: number): void {
  api.json<TownSupplyDto>('GET', `Logistics/towns/${townId}/supply`, phoenixSupply({
    townId, warehouses: [], lines: [], openReservations: [], policyId: null, policySource: 'None', lastRun: null, nextRunAt: null,
  }));
  api.json<TownServiceAreasDto>('GET', `Logistics/towns/${townId}/service-areas`, { townId, entries: [] });
  mockPaged<LogisticsPlannerRunListDto>(api, 'LogisticsPlannerRuns/search', []);
}

/**
 * A production structure page's consumer panel with nothing to show (not a consumer). Strict specs that open a
 * production structure page (production-world, -engine, -yield, transport) use it.
 */
export function mockNoConsumerLogistics(api: MockApi): void {
  api.on<ConsumerViewDto>('GET', /^Logistics\/consumers\/\d+$/, ({ path }) => ({
    body: bakeryConsumer({ structureId: Number(path.split('/')[2]), structureName: null, isConsumer: false, storages: [], warnings: [], serviceWarehouseId: null }),
  }));
  mockPaged<ConsumerReplenishmentListDto>(api, 'ConsumerReplenishments/search', []);
}

/** A warehouse page's logistics panel with nothing to show: it serves nobody, no warehouse policy, no reservations. */
export function mockNoWarehouseLogistics(api: MockApi): void {
  api.on<TownServiceAreasDto>('GET', /^Logistics\/towns\/\d+\/service-areas$/, ({ path }) => ({ body: { townId: Number(path.split('/')[2]), entries: [] } }));
  mockPaged<LogisticsPolicyListDto>(api, 'LogisticsPolicies/search', []);
  mockPaged<LogisticsReservationListDto>(api, 'LogisticsReservations/search', []);
}
