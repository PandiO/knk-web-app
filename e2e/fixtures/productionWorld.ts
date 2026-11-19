import type { PagedQueryDto, PagedResultDto } from '../../src/types/dtos/common/PagedQuery';
import type { FormConfigurationDto, FormFieldDto, FormStepDto } from '../../src/types/dtos/forms/FormModels';
import type { EntityMetadataDto } from '../../src/types/dtos/metadata/MetadataModels';
import type { StockPagedResultDto, StorageDto, StorageListDto } from '../../src/types/dtos/stock/StockDtos';
import type {
  ProductionStructureDto,
  ProductionWorldListDto,
  WarehouseDto,
} from '../../src/types/dtos/structure/ProductionWorldDtos';
import type { StructureListDto } from '../../src/types/dtos/structure/StructureDto';
import type { StructureTerritoryDto } from '../../src/types/dtos/territory/TerritoryDtos';
import { FieldType } from '../../src/utils/enums';
import type { MockApi } from '../support/mockApi';
import { accessMetadata } from './dashboardAccess';

/**
 * P2 world in the web app (PandiO/knk-workspace#676) for e2e/production-world.spec.ts, typed with the app's DTOs: the
 * smoke guide § 3 data. Town Phoenix with district Market and street Main, town Rivertown; the Market warehouse (in the
 * district, with its delivery storage), the Quarry (rural in Phoenix, contested and not connected to the roads, with its
 * output storage) and the Mill (a production structure in Market).
 */

export const WORLD = 'knk.admin.world';
export const ECONOMY = 'knk.economy.admin';

export const PHOENIX = 4;
export const RIVERTOWN = 5;
export const MARKET = 8;
export const MAIN = 11;
export const CONFLICT = 3;
export const QUARRY = 21;
export const MILL = 22;
export const MARKET_WAREHOUSE = 23;
export const QUARRY_OUTPUT = 31;
export const MILL_OUTPUT = 32;
export const WAREHOUSE_DELIVERY = 33;

export const CONTESTED_WARNING = 'Its land is contested: it keeps its town and keeps producing.';
export const UNCONNECTED_WARNING = "Not connected to its town's road network: automatic transport is held.";
export const P2_WARNING = "P-2: the production structure's region is not inside its town's territory (or part of it is contested).";

export const warehouseMetadata: EntityMetadataDto = accessMetadata('Warehouse', WORLD);
export const productionStructureMetadata: EntityMetadataDto = accessMetadata('ProductionStructure', WORLD);
export const structureMetadata: EntityMetadataDto = accessMetadata('Structure', WORLD);

/** Search rows (`ProductionWorldListDto`): `townId` and `townName` are the structure's own town, rural or not. */
export const warehouseRows: ProductionWorldListDto[] = [
  {
    id: MARKET_WAREHOUSE, name: 'Market warehouse', description: '', wgRegionId: 'domain_23', worldName: 'world', houseNumber: 3,
    streetId: MAIN, streetName: 'Main', districtId: MARKET, districtName: 'Market', townId: PHOENIX, townName: 'Phoenix',
    isRural: false, territoryFlag: 'None', acceptsDeliveries: true, priority: 10,
  },
];

export const productionRows: ProductionWorldListDto[] = [
  {
    id: QUARRY, name: 'Quarry', description: '', wgRegionId: 'domain_21', worldName: 'world', houseNumber: 0,
    streetId: null, streetName: null, districtId: null, districtName: null, townId: PHOENIX, townName: 'Phoenix',
    isRural: true, territoryFlag: 'Contested', level: 1, productionEnabled: true, roadConnection: 'Unconnected',
  },
  {
    id: MILL, name: 'Mill', description: '', wgRegionId: 'domain_22', worldName: 'world', houseNumber: 2,
    streetId: MAIN, streetName: 'Main', districtId: MARKET, districtName: 'Market', townId: PHOENIX, townName: 'Phoenix',
    isRural: false, territoryFlag: 'None', level: 4, productionEnabled: false, roadConnection: 'Unmeasured',
  },
];

/** The generic structure list: every structure, its subtypes included (TPT). */
export const structureRows: StructureListDto[] = [
  { ...productionRows[0] },
  { ...productionRows[1] },
  { ...warehouseRows[0] },
  {
    id: 12, name: 'Market keep', wgRegionId: 'domain_12', worldName: 'world', houseNumber: 1, streetId: MAIN, streetName: 'Main',
    districtId: MARKET, districtName: 'Market', townId: PHOENIX, townName: 'Phoenix', isRural: false, territoryFlag: 'OutsideTerritory',
  },
];

/** `POST <path>` answering the rows that match the `territoryFlag` filter (all without one). */
export function mockStructureSearch<T extends StructureListDto>(api: MockApi, path: string, rows: T[]): void {
  api.on<PagedResultDto<T>>('POST', path, ({ body }) => {
    const query = body as PagedQueryDto & { pageNumber?: number };
    const flag = query.filters?.territoryFlag as string | undefined;
    const items = rows.filter(r => !flag || r.territoryFlag === flag);
    return { body: { items, totalCount: items.length, page: query.pageNumber ?? 1, pageSize: query.pageSize ?? 10, totalPages: 1 } };
  });
}

/** The Quarry (§ 3.1 steps 3, 8 and 9): rural in Phoenix, contested, not connected to its town's roads. */
export function quarry(): ProductionStructureDto {
  return {
    id: QUARRY, name: 'Quarry', description: '', allowEntry: true, wgRegionId: 'domain_21', worldName: 'world',
    districtId: null, streetId: null, houseNumber: 0, townId: PHOENIX, effectiveTownId: PHOENIX, isRural: true,
    town: { id: PHOENIX, name: 'Phoenix', wgRegionId: 'town_phoenix', worldName: 'world' },
    territoryFlag: 'Contested', territoryFlaggedAt: '2026-11-19T12:00:00Z', territoryConflictId: CONFLICT,
    productionKindId: null, level: 1, productionEnabled: true, automaticTransport: true, transportThreshold: null, transportCapacity: null,
    warehousePreference: 'Preferred', preferredWarehouseId: MARKET_WAREHOUSE, preferredWarehouse: { id: MARKET_WAREHOUSE, name: 'Market warehouse' },
    roadConnection: 'Unconnected', roadConnectionMeasuredAt: '2026-11-19T12:30:00Z', workersTotal: 2, workersPresent: 1,
    warnings: [UNCONNECTED_WARNING, CONTESTED_WARNING],
    storages: [{ id: QUARRY_OUTPUT, name: 'Quarry - output', purpose: 'Output' }],
  };
}

/** The Mill (§ 3.1 step 10, before it moved): in Market at Main 2, no warnings. */
export function mill(): ProductionStructureDto {
  return {
    id: MILL, name: 'Mill', description: '', allowEntry: true, wgRegionId: 'domain_22', worldName: 'world',
    districtId: MARKET, streetId: MAIN, houseNumber: 2, townId: null, effectiveTownId: PHOENIX, isRural: false,
    district: { id: MARKET, name: 'Market', townName: 'Phoenix' }, street: { id: MAIN, name: 'Main' }, town: null,
    territoryFlag: 'None', level: 4, productionEnabled: false, warehousePreference: 'Nearest', preferredWarehouseId: null,
    roadConnection: 'Unmeasured', roadConnectionMeasuredAt: null, workersTotal: 2, workersPresent: 2, warnings: [],
    storages: [{ id: MILL_OUTPUT, name: 'Mill - output', purpose: 'Output' }],
  };
}

/** The Market warehouse (§ 3.1 step 2): in Market at Main 3, with its delivery storage. */
export function marketWarehouse(): WarehouseDto {
  return {
    id: MARKET_WAREHOUSE, name: 'Market warehouse', description: '', allowEntry: true, wgRegionId: 'domain_23', worldName: 'world',
    districtId: MARKET, streetId: MAIN, houseNumber: 3, townId: null, effectiveTownId: PHOENIX, isRural: false,
    district: { id: MARKET, name: 'Market', townName: 'Phoenix' }, street: { id: MAIN, name: 'Main' }, town: null,
    territoryFlag: 'None', acceptsDeliveries: true, priority: 10, defaultStorageId: WAREHOUSE_DELIVERY,
    storages: [{ id: WAREHOUSE_DELIVERY, name: 'Market warehouse - deliveries', purpose: 'Delivery' }],
  };
}

export function territoryOf(structureId: number, name: string, flag: 'None' | 'Contested' = 'None'): StructureTerritoryDto {
  return {
    structureId, structureName: name, townId: PHOENIX, loyaltyTownId: null, loyaltyTownName: null, territoryFlag: flag,
    territoryFlaggedAt: flag === 'None' ? null : '2026-11-19T12:00:00Z', territoryConflictId: flag === 'None' ? null : CONFLICT,
  };
}

/** A structure's storage as `api/Storages/search` lists it. */
export function storageRow(id: number, name: string, purpose: StorageListDto['purpose'], domainId: number, holderName: string, totalUnits = 0): StorageListDto {
  return { id, name, kind: 'Domain', purpose, holderName, domainId, totalUnits, distinctItems: totalUnits > 0 ? 1 : 0, maxUnits: null };
}

/** The same storage as `GET api/Storages/{id}` reads it, with its stock. */
export function storageDetail(row: StorageListDto, stoneAmount = 0): StorageDto {
  return {
    id: row.id, name: row.name, kind: row.kind, purpose: row.purpose, domainId: row.domainId, holderName: row.holderName,
    maxUnits: null, maxDistinct: null, totalUnits: stoneAmount, distinctItems: stoneAmount > 0 ? 1 : 0, capacityUsed: stoneAmount * 2,
    rowVersion: 1, lockedUntil: null, lockReason: null, isLocked: false, createdAt: '2026-11-19T12:00:00Z',
    lines: stoneAmount > 0
      ? [{ id: 401, storageId: row.id, itemBlueprintId: 6, itemBlueprintName: 'Stone', amount: stoneAmount, storageWeight: 2, updatedAt: '2026-11-19T13:00:00Z' }]
      : [],
    units: [],
  };
}

/** `POST api/Storages/search` answering the storages of the domain in the `domainId` filter. */
export function mockStoragesOf(api: MockApi, rows: StorageListDto[]): void {
  api.on<StockPagedResultDto<StorageListDto>>('POST', 'Storages/search', ({ body }) => {
    const domainId = Number((body as { filters?: Record<string, string> }).filters?.domainId);
    const items = rows.filter(r => r.domainId === domainId);
    return { body: { items, totalCount: items.length, pageNumber: 1, pageSize: 50 } };
  });
}

function field(values: Pick<FormFieldDto, 'id' | 'fieldName' | 'label' | 'fieldType' | 'order'> & Partial<FormFieldDto>): FormFieldDto {
  return { isRequired: false, isReadOnly: false, isReusable: false, isLinkedToSource: false, hasCompatibilityIssues: false, validations: [], ...values };
}

function step(values: Pick<FormStepDto, 'id' | 'stepName' | 'order' | 'fields'> & Partial<FormStepDto>): FormStepDto {
  return {
    isReusable: false, isLinkedToSource: false, hasCompatibilityIssues: false, isManyToManyRelationship: false,
    childFormSteps: [], conditions: [], ...values,
  };
}

const REGION_CLAIM = '{"worldTask": {"enabled": true, "taskType": "RegionClaim"}}';

/** The placement step of the Warehouse and ProductionStructure seeds: a district (with street and house number) or a town. */
function placementStep(id: number): FormStepDto {
  return step({
    id: String(id),
    stepName: 'Placement',
    order: 1,
    fields: [
      field({ id: String(id + 1), fieldName: 'DistrictId', label: 'District', fieldType: FieldType.Object, objectType: 'District', order: 0 }),
      field({ id: String(id + 2), fieldName: 'StreetId', label: 'Street', fieldType: FieldType.Object, objectType: 'Street', order: 1 }),
      field({ id: String(id + 3), fieldName: 'HouseNumber', label: 'House number', fieldType: FieldType.Integer, order: 2 }),
      field({ id: String(id + 4), fieldName: 'TownId', label: 'Town (rural)', fieldType: FieldType.Object, objectType: 'Town', order: 3 }),
    ],
  });
}

/** knk-web-api `Data/FormConfigurationSeeds/Warehouse.json`: name, placement, the region with its RegionClaim task. */
export const warehouseForm: FormConfigurationDto = {
  id: '761',
  entityTypeName: 'Warehouse',
  configurationName: 'Warehouse - Default (seed v1)',
  isDefault: true,
  steps: [
    step({
      id: '762', stepName: 'General information', order: 0,
      fields: [
        field({ id: '763', fieldName: 'Name', label: 'Name', fieldType: FieldType.String, isRequired: true, order: 0 }),
        field({ id: '764', fieldName: 'Description', label: 'Description', fieldType: FieldType.String, order: 1 }),
      ],
    }),
    placementStep(765),
    step({
      id: '770', stepName: 'Region and access', order: 2,
      fields: [field({ id: '771', fieldName: 'WgRegionId', label: 'Region', fieldType: FieldType.String, isRequired: true, order: 0, settingsJson: REGION_CLAIM })],
    }),
  ],
};

/** knk-web-api `Data/FormConfigurationSeeds/ProductionStructure.json`: name, placement, region, level. */
export const productionStructureForm: FormConfigurationDto = {
  id: '781',
  entityTypeName: 'ProductionStructure',
  configurationName: 'ProductionStructure - Default (seed v1)',
  isDefault: true,
  steps: [
    step({
      id: '782', stepName: 'General information', order: 0,
      fields: [
        field({ id: '783', fieldName: 'Name', label: 'Name', fieldType: FieldType.String, isRequired: true, order: 0 }),
        field({ id: '784', fieldName: 'Description', label: 'Description', fieldType: FieldType.String, order: 1 }),
      ],
    }),
    placementStep(785),
    step({
      id: '790', stepName: 'Region and access', order: 2,
      fields: [field({ id: '791', fieldName: 'WgRegionId', label: 'Region', fieldType: FieldType.String, isRequired: true, order: 0, settingsJson: REGION_CLAIM })],
    }),
    step({
      id: '792', stepName: 'Production', order: 3,
      fields: [field({ id: '793', fieldName: 'Level', label: 'Level', fieldType: FieldType.Integer, defaultValue: '1', order: 0 })],
    }),
  ],
};

const placementFields: EntityMetadataDto['fields'] = [
  { fieldName: 'Name', fieldType: 'String', isNullable: false, isRelatedEntity: false, hasDefaultValue: false },
  { fieldName: 'Description', fieldType: 'String', isNullable: false, isRelatedEntity: false, hasDefaultValue: false },
  { fieldName: 'DistrictId', fieldType: 'Int32', isNullable: true, isRelatedEntity: true, relatedEntityType: 'District', hasDefaultValue: false },
  { fieldName: 'StreetId', fieldType: 'Int32', isNullable: true, isRelatedEntity: true, relatedEntityType: 'Street', hasDefaultValue: false },
  { fieldName: 'HouseNumber', fieldType: 'Int32', isNullable: false, isRelatedEntity: false, hasDefaultValue: false },
  { fieldName: 'TownId', fieldType: 'Int32', isNullable: true, isRelatedEntity: true, relatedEntityType: 'Town', hasDefaultValue: false },
  { fieldName: 'WgRegionId', fieldType: 'String', isNullable: false, isRelatedEntity: false, hasDefaultValue: false },
];

export const warehouseFormMetadata: EntityMetadataDto = { ...warehouseMetadata, fields: placementFields };
export const productionStructureFormMetadata: EntityMetadataDto = {
  ...productionStructureMetadata,
  fields: [...placementFields, { fieldName: 'Level', fieldType: 'Int32', isNullable: false, isRelatedEntity: false, hasDefaultValue: true, defaultValue: '1' }],
};
