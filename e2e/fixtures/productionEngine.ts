import type { LookupItemDto, LookupSearchResponseDto } from '../../src/apiClients/lookupClient';
import type { EntityMetadataDto } from '../../src/types/dtos/metadata/MetadataModels';
import type { PagedQueryDto, PagedResultDto } from '../../src/types/dtos/common/PagedQuery';
import type {
  ClimateZoneDto,
  ProductionCycleRecordDto,
  ProductionKindDto,
  ProductionKindLevelDto,
  ProductionKindListDto,
  ProductionLineDto,
  ProductionLineListDto,
  ProductionModifierListDto,
  ProductionOverviewDto,
  WeatherRollDto,
  WeatherTypeDto,
} from '../../src/types/dtos/production/ProductionEngineDtos';
import type { MockApi } from '../support/mockApi';
import { accessMetadata } from './dashboardAccess';
import { PHOENIX, QUARRY, QUARRY_OUTPUT, WORLD } from './productionWorld';

/**
 * Production engine P3 in the web app (PandiO/knk-workspace#678) for e2e/production-engine.spec.ts, typed with the app's
 * DTOs: the smoke guide § 4 data. The Quarry (kind Quarry, level 1, two workers, one present) with a Cobblestone line
 * (10/h, an Admin +2/h, Rain × 0.5, half the workers) and a Coal line that is blocked because its output storage is
 * full; the Quarry kind's levels 1 and 2 (level 2 costs 500 coins and 64 Cobblestone, unlocks Coal); the default climate
 * zone with Rain at 30%; the weather type Rain.
 */

export const QUARRY_KIND = 3;
export const LEVEL_1 = 31;
export const LEVEL_2 = 32;
export const COBBLE_LINE = 41;
export const COAL_LINE = 42;
export const DEFAULT_ZONE = 1;
export const RAIN = 2;
export const STORM = 3;
export const COBBLESTONE = 5;
export const COAL = 6;
export const STEVE = 9;

export const OFF_REASON = 'Production is turned off for the whole server.';
export const FULL_REASON = 'Its output storage is full: nothing accrues until there is room (D4).';

export const productionKindMetadata: EntityMetadataDto = accessMetadata('ProductionKind', WORLD);
export const productionKindLevelMetadata: EntityMetadataDto = { ...accessMetadata('ProductionKindLevel', WORLD, false), deletable: false };
export const productionLineMetadata: EntityMetadataDto = accessMetadata('ProductionLine', WORLD);
export const productionModifierMetadata: EntityMetadataDto = accessMetadata('ProductionModifier', WORLD);
export const climateZoneMetadata: EntityMetadataDto = accessMetadata('ClimateZone', WORLD);
export const weatherTypeMetadata: EntityMetadataDto = accessMetadata('WeatherType', WORLD);

export const kindRows: ProductionKindListDto[] = [
  { id: QUARRY_KIND, name: 'Quarry', areaModel: 'ExclusiveVolume', resourceCategory: 'Stone', defaultWorkers: 2, isActive: true, structureCount: 1 },
  { id: 1, name: 'Farm', areaModel: 'BorderedField', resourceCategory: 'Crops', defaultWorkers: 2, isActive: true, structureCount: 0 },
];

export const modifierRows: ProductionModifierListDto[] = [
  {
    id: 7, name: 'Festival', source: 'Admin', scope: 'Town', scopeRefId: PHOENIX, target: 'Any', effect: 'Add', value: 2,
    activeFrom: '2026-11-19T00:00:00Z', activeUntil: null, enabled: true,
  },
];

export const lineRows: ProductionLineListDto[] = [
  {
    id: COBBLE_LINE, name: 'Quarry - Cobblestone', productionStructureId: QUARRY, productionStructureName: 'Quarry', itemBlueprintId: COBBLESTONE,
    itemBlueprintName: 'Cobblestone', rateSource: 'Configured', configuredRatePerHour: 10, status: 'Running', nextSettleAt: '2026-11-19T14:10:00Z',
  },
  {
    id: COAL_LINE, name: 'Quarry - Coal', productionStructureId: QUARRY, productionStructureName: 'Quarry', itemBlueprintId: COAL,
    itemBlueprintName: 'Coal', rateSource: 'Configured', configuredRatePerHour: 4, status: 'BlockedFull', nextSettleAt: '2026-11-19T14:10:00Z',
  },
];

function level(id: number, n: number, values: Partial<ProductionKindLevelDto> = {}): ProductionKindLevelDto {
  return {
    id, productionKindId: QUARRY_KIND, productionKind: { id: QUARRY_KIND, name: 'Quarry' }, level: n,
    yieldMultiplier: 1 + (n - 1) * 0.1, cycleSpeedMultiplier: 1, maxAreaSize: n * 1000, outputMaxUnits: n * 500, unitsPerSlot: 64,
    transportCapacity: 0, upkeepReduction: 0, upgradeCoins: n === 1 ? 0 : n * 250, upgradeDurationMinutes: 0, items: [], ...values,
  };
}

/** Level 1 (free) and level 2: 500 coins and 64 Cobblestone, unlocks Coal. */
export function quarryLevels(): ProductionKindLevelDto[] {
  return [
    level(LEVEL_1, 1),
    level(LEVEL_2, 2, {
      items: [
        { id: 1, role: 'UpgradeCost', itemBlueprintId: COBBLESTONE, itemBlueprintName: 'Cobblestone', itemBlueprint: { id: COBBLESTONE, name: 'Cobblestone' }, amount: 64 },
        { id: 2, role: 'Unlock', itemBlueprintId: COAL, itemBlueprintName: 'Coal', itemBlueprint: { id: COAL, name: 'Coal' }, amount: 0 },
      ],
    }),
  ];
}

export function quarryKind(): ProductionKindDto {
  return {
    id: QUARRY_KIND, name: 'Quarry', description: '', icon: null, areaModel: 'ExclusiveVolume', exclusiveAreas: true, allowsDerived: true,
    allowsConfigured: true, allowsHybrid: true, resourceCategory: 'Stone', defaultWorkers: 2, cycleVariation: false,
    defaultStoragesJson: '', isActive: true, createdAt: '2026-11-19T12:00:00Z', levels: quarryLevels(),
  };
}

export function cobblestoneLine(): ProductionLineDto {
  return {
    id: COBBLE_LINE, productionStructureId: QUARRY, productionStructure: { id: QUARRY, name: 'Quarry' }, itemBlueprintId: COBBLESTONE,
    itemBlueprint: { id: COBBLESTONE, name: 'Cobblestone' }, rateSource: 'Configured', configuredRatePerHour: 10, resourceCategory: null,
    enabled: true, status: 'Running', statusReason: null, accrued: 0.25, anchorAt: '2026-11-19T12:00:00Z',
    lastSettledAt: '2026-11-19T14:00:00Z', nextSettleAt: '2026-11-19T14:10:00Z', createdAt: '2026-11-19T12:00:00Z', inputs: [],
  };
}

export function coalLine(): ProductionLineDto {
  return {
    ...cobblestoneLine(), id: COAL_LINE, itemBlueprintId: COAL, itemBlueprint: { id: COAL, name: 'Coal' }, configuredRatePerHour: 4,
    status: 'BlockedFull', statusReason: 'Output storage full', accrued: 0,
  };
}

/** The 14:00 cycle of the Cobblestone line: 10/h + 2 = 12 × 0.5 rain × 0.5 workers = 3/h over 1 h 10 min (A08). */
export function cobblestoneCycle(): ProductionCycleRecordDto {
  return {
    id: 501, productionLineId: COBBLE_LINE, productionStructureId: QUARRY, itemBlueprintId: COBBLESTONE, itemBlueprintName: 'Cobblestone',
    settledAt: '2026-11-19T14:00:00Z', periodStart: '2026-11-19T12:50:00Z', periodEnd: '2026-11-19T14:00:00Z', elapsedSeconds: 4200,
    skippedSeconds: 0, rateSource: 'Configured', baseRatePerHour: 10,
    modifiers: [
      { source: 'Admin', name: 'Festival', scope: 'Town', effect: 'Add', value: 2, modifierId: 7 },
      { source: 'Weather', name: 'Rain', scope: 'Global', effect: 'Multiply', value: 0.5, modifierId: null },
    ],
    unlockFactor: 1, workersPresent: 1, workersTotal: 2, workerFactor: 0.5, effectiveRatePerHour: 3, accruedBefore: 0.75,
    accruedAfter: 0.25, emitted: 4, accepted: 4, inputs: [], statusAfter: 'Running', shortfallReason: null, stockTransactionId: 901,
  };
}

/** The Coal line's last cycle: nothing accepted, the output storage is full (D4). */
export function coalCycle(): ProductionCycleRecordDto {
  return {
    ...cobblestoneCycle(), id: 502, productionLineId: COAL_LINE, itemBlueprintId: COAL, itemBlueprintName: 'Coal', baseRatePerHour: 4,
    modifiers: [], effectiveRatePerHour: 2, emitted: 2, accepted: 0, statusAfter: 'BlockedFull',
    shortfallReason: 'The output storage refused 2 units (full).', stockTransactionId: null,
  };
}

/** `GET api/ProductionStructures/21/production` for the Quarry. */
export function quarryProduction(values: Partial<ProductionOverviewDto> = {}): ProductionOverviewDto {
  return {
    productionStructureId: QUARRY, featureEnabled: true, productionEnabled: true, productionKind: { id: QUARRY_KIND, name: 'Quarry' },
    level: 1, workersPresent: 1, workersTotal: 2, outputStorageId: QUARRY_OUTPUT, inputStorageId: null, climateZone: 'Default climate',
    weatherToday: 'Rain', notProducingReasons: [],
    lines: [
      {
        line: cobblestoneLine(), baseRatePerHour: 10, modifiers: cobblestoneCycle().modifiers, unlockFactor: 1, workerFactor: 0.5,
        effectiveRatePerHour: 3, notProducingReasons: [],
      },
      {
        line: coalLine(), baseRatePerHour: 4, modifiers: [], unlockFactor: 1, workerFactor: 0.5, effectiveRatePerHour: 2,
        notProducingReasons: [FULL_REASON],
      },
    ],
    recentCycles: [cobblestoneCycle(), coalCycle()],
    ...values,
  };
}

export function defaultZone(): ClimateZoneDto {
  return {
    id: DEFAULT_ZONE, name: 'Default climate', description: '', isDefault: true, createdAt: '2026-11-19T12:00:00Z',
    weatherOdds: [{ id: 1, weatherTypeId: RAIN, weatherTypeName: 'Rain', weatherType: { id: RAIN, name: 'Rain' }, chancePercent: 30 }],
    towns: [{ townId: PHOENIX, townName: 'Phoenix', town: { id: PHOENIX, name: 'Phoenix' } }],
    rolls: [],
  };
}

export const zoneRolls: WeatherRollDto[] = [
  {
    id: 12, climateZoneId: DEFAULT_ZONE, climateZoneName: 'Default climate', day: 1452, dayStartsAt: '2026-11-19T14:00:00Z',
    dayEndsAt: '2026-11-19T14:20:00Z', weatherTypeId: RAIN, weatherTypeName: 'Rain', weatherType: { id: RAIN, name: 'Rain' },
    rollValue: 12.5, rolledAt: '2026-11-19T14:00:03Z',
  },
  {
    id: 11, climateZoneId: DEFAULT_ZONE, climateZoneName: 'Default climate', day: 1451, dayStartsAt: '2026-11-19T13:40:00Z',
    dayEndsAt: '2026-11-19T14:00:00Z', weatherTypeId: null, weatherTypeName: 'Clear', weatherType: null, rollValue: 81, rolledAt: '2026-11-19T13:40:02Z',
  },
];

export function rain(): WeatherTypeDto {
  return {
    id: RAIN, name: 'Rain', description: '', createdAt: '2026-11-19T12:00:00Z',
    effects: [{ id: 1, category: 'Crops', effect: 'Multiply', value: 1.2 }],
  };
}

const lookups: Record<string, LookupItemDto[]> = {
  ItemBlueprint: [{ id: COBBLESTONE, label: 'Cobblestone' }, { id: COAL, label: 'Coal' }],
  WeatherType: [{ id: RAIN, label: 'Rain' }, { id: STORM, label: 'Storm' }],
  Town: [{ id: PHOENIX, label: 'Phoenix' }, { id: 5, label: 'Rivertown' }],
  User: [{ id: STEVE, label: 'Steve' }],
  Storage: [{ id: QUARRY_OUTPUT, label: 'Quarry - output' }],
};

/** `api/Lookup/{type}/search` for the pickers, filtered by the typed term. */
export function mockProductionLookups(api: MockApi): void {
  for (const [type, items] of Object.entries(lookups)) {
    api.on<LookupSearchResponseDto>('POST', `Lookup/${type}/search`, ({ body }) => {
      const term = ((body as { searchTerm?: string | null }).searchTerm ?? '').toLowerCase();
      const matches = items.filter(i => !term || i.label.toLowerCase().includes(term));
      return { body: { items: matches, total: matches.length } };
    });
  }
}

/** A dashboard search answering fixed rows. */
export function mockRows<T>(api: MockApi, path: string, rows: T[]): void {
  api.on<PagedResultDto<T>>('POST', path, ({ body }) => {
    const query = body as PagedQueryDto & { pageNumber?: number };
    return { body: { items: rows, totalCount: rows.length, page: query.pageNumber ?? 1, pageSize: query.pageSize ?? 10, totalPages: 1 } };
  });
}
