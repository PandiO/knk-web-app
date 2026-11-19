import type { PagedQueryDto, PagedResultDto } from '../../src/types/dtos/common/PagedQuery';
import type { DisplayConfigurationDto } from '../../src/types/dtos/displayConfig/DisplayModels';
import type { FormConfigurationDto, FormFieldDto, FormStepDto } from '../../src/types/dtos/forms/FormModels';
import type { GameSettingsDto } from '../../src/types/dtos/gameSettings/GameSettingsModels';
import type { EntityMetadataDto } from '../../src/types/dtos/metadata/MetadataModels';
import type {
  CrownLandListDto,
  KingdomDto,
  KingdomListDto,
  ProvinceDto,
  ProvinceListDto,
  StructureTerritoryDto,
  TerritoryConflictDto,
  TerritoryConflictListDto,
  TownTerritoryDto,
} from '../../src/types/dtos/territory/TerritoryDtos';
import { FieldType } from '../../src/utils/enums';
import type { MockApi } from '../support/mockApi';
import { accessMetadata } from './dashboardAccess';

/**
 * Territory V1 in the web app (PandiO/knk-workspace#690) for e2e/territory.spec.ts, typed with the app's DTOs: the
 * kingdom Aurelia with province North, towns Phoenix (power 50, capital district Old Town) and Rivertown, crown land
 * Royal forest, and one open conflict Phoenix vs Rivertown with a flagged structure (smoke guide § 1.2 data).
 */

export const WORLD = 'knk.admin.world';
export const CONTENT = 'knk.admin.content';

export const PHOENIX = 4;
export const RIVERTOWN = 5;
export const OLD_TOWN = 7;
export const MARKET = 8;
export const KEEP = 12;
export const CONFLICT = 3;

export const kingdomRows: KingdomListDto[] = [
  { id: 1, name: 'Aurelia', description: 'The northern crown', townCount: 2, crownLandCount: 1 },
  { id: 2, name: 'Valemont', description: null, townCount: 0, crownLandCount: 0 },
];

export const kingdoms: KingdomDto[] = [
  { id: 1, name: 'Aurelia', description: 'The northern crown' },
  { id: 2, name: 'Valemont' },
];

export const provinceRows: ProvinceListDto[] = [
  { id: 21, name: 'North', kingdomId: 1, kingdomName: 'Aurelia', townCount: 1 },
  { id: 22, name: 'Lowlands', kingdomId: 2, kingdomName: 'Valemont', townCount: 0 },
];

export const provinces: ProvinceDto[] = [
  { id: 21, name: 'North', kingdomId: 1 },
  { id: 22, name: 'Lowlands', kingdomId: 2 },
];

export const crownLandRows: CrownLandListDto[] = [
  { id: 31, name: 'Royal forest', wgRegionId: 'domain_31', worldName: 'world', kingdomId: 1, kingdomName: 'Aurelia', range: 80 },
];

export const conflictRows: TerritoryConflictListDto[] = [
  {
    id: CONFLICT, name: 'Phoenix vs Rivertown', world: 'world', status: 'Open', stillOverlapping: true, chunkCount: 3,
    resolution: 'None', detectedAt: '2026-11-19T09:00:00Z', flaggedStructureCount: 1,
  },
];

export const openConflict: TerritoryConflictDto = {
  id: CONFLICT,
  world: 'world',
  holderA: { kind: 'Town', id: PHOENIX, name: 'Phoenix' },
  holderB: { kind: 'Town', id: RIVERTOWN, name: 'Rivertown' },
  status: 'Open',
  stillOverlapping: true,
  chunks: [[4, 2], [5, 2], [6, 2]],
  chunkCount: 3,
  minChunkX: 4,
  minChunkZ: 2,
  maxChunkX: 6,
  maxChunkZ: 2,
  detectedAt: '2026-11-19T09:00:00Z',
  lastReportedAt: '2026-11-19T09:30:00Z',
  resolution: 'None',
  awardedHolder: null,
  resolvedAt: null,
  resolvedByUserId: null,
  resolutionNote: null,
  flaggedStructures: [{ id: KEEP, name: 'Market keep' }],
};

/** Phoenix: power 50 under the default settings, so 200 blocks and 300 for the capital Old Town (G11). */
export const phoenixTerritory: TownTerritoryDto = {
  townId: PHOENIX,
  power: 50,
  kingdomId: 1,
  provinceId: 21,
  range: 200,
  capitalRange: 300,
  districts: [
    {
      id: OLD_TOWN, name: 'Old Town', world: 'world', wgRegionId: 'domain_7', subRegionIds: [],
      holder: { kind: 'Town', id: PHOENIX, name: 'Phoenix' }, isCapital: true, rank: 1, range: 300,
    },
    {
      id: MARKET, name: 'Market', world: 'world', wgRegionId: 'domain_8', subRegionIds: [],
      holder: { kind: 'Town', id: PHOENIX, name: 'Phoenix' }, isCapital: false, rank: 1, range: 200,
    },
  ],
};

/** Phoenix as `GET api/Towns/4` sends it (the fields the territory save sends back), with teleport settings set. */
export const phoenixTown = {
  id: PHOENIX, name: 'Phoenix', description: 'Capital of Aurelia', allowEntry: true, allowExit: true, wgRegionId: 'domain_4',
  worldName: 'world', locationId: 40, location: { id: 40, name: 'Phoenix spawn', x: 1, y: 64, z: 2, world: 'world' },
  teleportEnabled: true, teleportPriceGems: 5, navigationDefaultOverride: 'Spawn', roadAccessOverride: null,
  power: 50, kingdomId: 1, kingdomName: 'Aurelia', provinceId: 21, provinceName: 'North', requiredTitle: 0,
  streetIds: [], streets: [],
};

/** Market as `GET api/Districts/8` sends it. */
export const marketDistrict = {
  id: MARKET, name: 'Market', description: 'Trade quarter', allowEntry: true, allowExit: true, wgRegionId: 'domain_8',
  worldName: 'world', locationId: null, townId: PHOENIX, streetIds: [11], isCapital: false, teleportEnabled: false,
};

export const keepTerritory: StructureTerritoryDto = {
  structureId: KEEP,
  structureName: 'Market keep',
  townId: PHOENIX,
  loyaltyTownId: null,
  loyaltyTownName: null,
  territoryFlag: 'Contested',
  territoryFlaggedAt: '2026-11-19T09:30:00Z',
  territoryConflictId: CONFLICT,
};

/** The API's metadata for a World-area type (DashboardAccess registry): every action needs knk.admin.world. */
export const worldMetadata = (entityName: string): EntityMetadataDto => accessMetadata(entityName, WORLD);

function mockSearch<T extends { name: string }>(api: MockApi, path: string, rows: T[]): void {
  api.on<PagedResultDto<T>>('POST', path, ({ body }) => {
    const query = body as PagedQueryDto & { pageNumber?: number };
    const term = (query.searchTerm ?? '').toLowerCase();
    const items = rows.filter(r => !term || r.name.toLowerCase().includes(term));
    return { body: { items, totalCount: items.length, page: query.pageNumber ?? query.page ?? 1, pageSize: query.pageSize ?? 10, totalPages: 1 } };
  });
}

export const mockKingdomSearch = (api: MockApi) => mockSearch(api, 'Kingdoms/search', kingdomRows);
export const mockProvinceSearch = (api: MockApi) => mockSearch(api, 'Provinces/search', provinceRows);
export const mockCrownLandSearch = (api: MockApi) => mockSearch(api, 'CrownLands/search', crownLandRows);
export const mockConflictSearch = (api: MockApi) => mockSearch(api, 'TerritoryConflicts/search', conflictRows);

/** The reads of the town page's territory panel (Phoenix unless given). */
export function mockTownTerritory(api: MockApi, territory: TownTerritoryDto = phoenixTerritory): void {
  api.json<TownTerritoryDto>('GET', `Territory/towns/${territory.townId}`, territory);
  api.json<KingdomDto[]>('GET', /^Kingdoms\/?$/, kingdoms);
  api.json<ProvinceDto[]>('GET', /^Provinces\/?$/, provinces);
}

/** A detail page configuration with one General section showing the name. */
export function generalDisplay(entityTypeName: string, id: string): DisplayConfigurationDto {
  return {
    id,
    name: `${entityTypeName} (e2e)`,
    entityTypeName,
    isDefault: true,
    isDraft: false,
    sections: [{
      sectionGuid: 'general',
      sectionName: 'General',
      isCollection: false,
      isReusable: false,
      isLinkedToSource: false,
      fields: [{ fieldGuid: `${id}-name`, label: 'Name', fieldName: 'name', isReusable: false, isLinkedToSource: false }],
      subSections: [],
    }],
  };
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

/** The Kingdom seed's form (knk-web-api `Data/FormConfigurationSeeds/Kingdom.json`): name and description. */
export const kingdomForm: FormConfigurationDto = {
  id: '701',
  entityTypeName: 'Kingdom',
  configurationName: 'Kingdom (e2e)',
  isDefault: true,
  steps: [
    step({
      id: '702',
      stepName: 'General information',
      order: 0,
      fields: [
        field({ id: '703', fieldName: 'Name', label: 'Name', fieldType: FieldType.String, isRequired: true, order: 0 }),
        field({ id: '704', fieldName: 'Description', label: 'Description', fieldType: FieldType.String, order: 1 }),
      ],
    }),
  ],
};

export const kingdomFormMetadata: EntityMetadataDto = {
  ...worldMetadata('Kingdom'),
  fields: [
    { fieldName: 'Name', fieldType: 'String', isNullable: false, isRelatedEntity: false, hasDefaultValue: false },
    { fieldName: 'Description', fieldType: 'String', isNullable: true, isRelatedEntity: false, hasDefaultValue: false },
  ],
};

/**
 * The first step of the CrownLand seed's form (knk-web-api `Data/FormConfigurationSeeds/CrownLand.json`): name,
 * description, the holding kingdom (an Object field, picked through api/Kingdoms/search) and the range. The region
 * step (world task) is the same field type districts use; e2e/form-wizard specs cover world tasks.
 */
export const crownLandForm: FormConfigurationDto = {
  id: '711',
  entityTypeName: 'CrownLand',
  configurationName: 'CrownLand (e2e)',
  isDefault: true,
  steps: [
    step({
      id: '712',
      stepName: 'General information',
      order: 0,
      fields: [
        field({ id: '713', fieldName: 'Name', label: 'Name', fieldType: FieldType.String, isRequired: true, order: 0 }),
        field({ id: '714', fieldName: 'Description', label: 'Description', fieldType: FieldType.String, isRequired: true, order: 1 }),
        field({ id: '715', fieldName: 'KingdomId', label: 'Kingdom', fieldType: FieldType.Object, objectType: 'Kingdom', isRequired: true, order: 2 }),
        field({ id: '716', fieldName: 'Range', label: 'Range (blocks)', fieldType: FieldType.Integer, isRequired: true, defaultValue: '0', order: 3 }),
      ],
    }),
  ],
};

export const crownLandFormMetadata: EntityMetadataDto = {
  ...worldMetadata('CrownLand'),
  fields: [
    { fieldName: 'Name', fieldType: 'String', isNullable: false, isRelatedEntity: false, hasDefaultValue: false },
    { fieldName: 'Description', fieldType: 'String', isNullable: false, isRelatedEntity: false, hasDefaultValue: false },
    { fieldName: 'KingdomId', fieldType: 'Int32', isNullable: false, isRelatedEntity: true, relatedEntityType: 'Kingdom', hasDefaultValue: false },
    { fieldName: 'Range', fieldType: 'Int32', isNullable: false, isRelatedEntity: false, hasDefaultValue: true, defaultValue: '0' },
  ],
};

/** Game settings as the API sends them, with the production section at its defaults (flag off). */
export const gameSettings: GameSettingsDto = {
  id: 'global',
  settingsVersion: '7',
  joinAnnouncement: '&a{player} joined the server.',
  leaveAnnouncement: '&e{player} left the server.',
  joinSpawnMode: 'WorldSpawn',
  joinSpawnReference: null,
  defaultRespawnPolicy: { mode: 'WorldSpawn', useWorldSpawnFallback: true, maxNearestTownDistance: null, locationReference: null },
  worldSettings: [],
  runtimeWorlds: [],
  runtimeWorldsLastUpdatedAt: null,
  motd: null,
  groupOverrides: [],
  chatTokens: { maxTokensPerMessage: 0, statCooldownSeconds: 0 },
  production: { enabled: false, territory: { baseRange: 100, powerFactor: 2, capitalMultiplier: 1.5 } },
  createdAt: '2026-11-01T10:00:00Z',
  updatedAt: '2026-11-19T10:00:00Z',
};

/**
 * The town page's territory panel (PandiO/knk-workspace#690) for specs about other parts of the page: power 0, no
 * kingdom, no districts, so the panel loads and stays out of the way. e2e/territory.spec.ts covers it.
 */
export function mockNoTownTerritory(api: MockApi, townId: number): void {
  mockTownTerritory(api, { townId, power: 0, kingdomId: null, provinceId: null, range: 100, capitalRange: 150, districts: [] });
  api.json<KingdomDto[]>('GET', /^Kingdoms\/?$/, []);
  api.json<ProvinceDto[]>('GET', /^Provinces\/?$/, []);
}

/**
 * The structure page's territory panel (PandiO/knk-workspace#690) for specs about other parts of the page: no flag,
 * loyal to its own town, no towns to pick. e2e/territory.spec.ts covers it.
 */
export function mockNoStructureTerritory(api: MockApi, structureId: number): void {
  api.json<StructureTerritoryDto>('GET', `Territory/structures/${structureId}`, {
    structureId, townId: null, loyaltyTownId: null, territoryFlag: 'None', territoryConflictId: null,
  });
  api.json<unknown[]>('GET', /^Towns\/?$/, []);
}
