import type { EntityMetadataDto } from '../../src/types/dtos/metadata/MetadataModels';
import type {
  AreaSurveyDto,
  AreaSurveyListDto,
  AreaSurveyTrendDto,
  ProductionAreaDto,
  ProductionAreaListDto,
  ProductionAreaOverlapDto,
  ProductionYieldDto,
  ProductionYieldOverrideListDto,
} from '../../src/types/dtos/production/ProductionYieldDtos';
import type { MockApi } from '../support/mockApi';
import { accessMetadata } from './dashboardAccess';
import { COAL, COBBLE_LINE, COBBLESTONE, QUARRY_KIND } from './productionEngine';
import { MILL, QUARRY, WORLD } from './productionWorld';

/**
 * Yield areas P4 in the web app (PandiO/knk-workspace#680) for e2e/production-yield.spec.ts, typed with the app's DTOs:
 * the smoke guide § 5.3 data. The Quarry (Hybrid, level 1, cap 400 blocks) has the exclusive cuboid "Quarry pit"
 * (20 × 16 = 320 blocks) and the shared radius "North slope" that overlaps the Mill's shared "Mill wood". Its latest
 * survey counted 300 stone and 100 coal ore (the coal shared by 2 structures); stone yields Cobblestone (line 41),
 * coal ore yields Coal (primary, scaled × 0.5 by a Hybrid override). `BLOCK:DIORITE` matches no yield row.
 */

export const PIT = 61;
export const SLOPE = 62;
export const MILL_WOOD = 63;
export const SURVEY_1 = 71;
export const SURVEY_2 = 72;
export const COAL_OVERRIDE = 81;
export const IRON = 7;

export const productionAreaMetadata: EntityMetadataDto = accessMetadata('ProductionArea', WORLD);
export const areaSurveyMetadata: EntityMetadataDto = { ...accessMetadata('AreaSurvey', WORLD, false), deletable: false };
export const productionYieldOverrideMetadata: EntityMetadataDto = accessMetadata('ProductionYieldOverride', WORLD);

export function quarryPit(): ProductionAreaDto {
  return {
    id: PIT, productionStructureId: QUARRY, productionStructure: { id: QUARRY, name: 'Quarry' }, name: 'Quarry pit',
    model: 'ExclusiveVolume', shape: 'Cuboid', exclusive: true, worldName: 'world',
    minX: 100, minY: 40, minZ: 200, maxX: 119, maxY: 70, maxZ: 215,
    size: 320, sizeUnit: 'blocks', maxSize: 400, enabled: true,
    surveyRequestedAt: null, surveyRequestTrigger: null, lastSurveyId: SURVEY_2, lastSurveyedAt: '2026-11-19T08:00:00Z',
    createdAt: '2026-11-17T10:00:00Z',
  };
}

export function northSlope(): ProductionAreaDto {
  return {
    id: SLOPE, productionStructureId: QUARRY, productionStructure: { id: QUARRY, name: 'Quarry' }, name: 'North slope',
    model: 'ExclusiveVolume', shape: 'Radius', exclusive: false, worldName: 'world',
    centerX: 110, centerY: 64, centerZ: 180, radius: 12, minX: 98, minY: -64, minZ: 168, maxX: 122, maxY: 319, maxZ: 192,
    size: 12, sizeUnit: 'radius', maxSize: null, enabled: true,
    surveyRequestedAt: null, surveyRequestTrigger: null, lastSurveyId: null, lastSurveyedAt: null, createdAt: '2026-11-18T10:00:00Z',
  };
}

export const pitOverlaps: ProductionAreaOverlapDto[] = [
  {
    productionAreaId: MILL_WOOD, name: 'Mill wood', productionStructureId: MILL, productionStructureName: 'Mill', model: 'SharedRadius',
    shape: 'Radius', exclusive: false, centerX: 125, centerY: 64, centerZ: 210, radius: 8,
    minX: 117, minY: -64, minZ: 202, maxX: 133, maxY: 319, maxZ: 218,
  },
];

export const areaRows: ProductionAreaListDto[] = [
  { id: PIT, name: 'Quarry pit', productionStructureId: QUARRY, productionStructureName: 'Quarry', model: 'ExclusiveVolume', shape: 'Cuboid', exclusive: true, size: 320, enabled: true, lastSurveyedAt: '2026-11-19T08:00:00Z' },
  { id: SLOPE, name: 'North slope', productionStructureId: QUARRY, productionStructureName: 'Quarry', model: 'ExclusiveVolume', shape: 'Radius', exclusive: false, size: 12, enabled: true, lastSurveyedAt: null },
];

export function latestSurvey(): AreaSurveyDto {
  return {
    id: SURVEY_2, productionAreaId: PIT, productionArea: { id: PIT, name: 'Quarry pit' }, productionStructureId: QUARRY,
    surveyedAt: '2026-11-19T08:00:00Z', receivedAt: '2026-11-19T08:00:05Z', profileVersion: 1, trigger: 'Admin',
    contentHash: 'b2', totalUnits: 420, note: null,
    units: [
      { id: 1, unitKey: 'BLOCK:COAL_ORE', count: 100, sharedBy: 2, extra: null },
      { id: 2, unitKey: 'BLOCK:STONE', count: 300, sharedBy: 1, extra: null },
      { id: 3, unitKey: 'BLOCK:DIORITE', count: 20, sharedBy: 1, extra: null },
    ],
    materialization: null,
  };
}

export const surveyRows: AreaSurveyListDto[] = [
  { id: SURVEY_2, name: 'Quarry pit 2026-11-19', productionAreaId: PIT, productionAreaName: 'Quarry pit', productionStructureId: QUARRY, surveyedAt: '2026-11-19T08:00:00Z', trigger: 'Admin', profileVersion: 1, contentHash: 'b2', totalUnits: 420 },
  { id: SURVEY_1, name: 'Quarry pit 2026-11-18', productionAreaId: PIT, productionAreaName: 'Quarry pit', productionStructureId: QUARRY, surveyedAt: '2026-11-18T08:00:00Z', trigger: 'Creation', profileVersion: 1, contentHash: 'b1', totalUnits: 460 },
];

export function pitTrend(): AreaSurveyTrendDto {
  return {
    productionAreaId: PIT,
    surveys: [surveyRows[1], surveyRows[0]],
    series: { 'BLOCK:STONE': [320, 300], 'BLOCK:COAL_ORE': [120, 100], 'BLOCK:DIORITE': [20, 20] },
  };
}

export const quarryOverrides: ProductionYieldOverrideListDto[] = [
  { id: COAL_OVERRIDE, name: 'Quarry: Coal', productionStructureId: QUARRY, productionStructureName: 'Quarry', itemBlueprintId: COAL, itemBlueprintName: 'Coal', kind: 'Scale', value: 0.5 },
];

export function quarryYield(): ProductionYieldDto {
  return {
    productionStructureId: QUARRY, yieldSource: 'Hybrid', productionKind: { id: QUARRY_KIND, name: 'Quarry' }, level: 1, surveysRun: true,
    areas: [quarryPit(), northSlope()],
    outputs: [
      {
        itemBlueprintId: COBBLESTONE, itemBlueprintName: 'Cobblestone', derivedRatePerHour: 3, override: null, overrideValue: null,
        baseRatePerHour: 3, isPrimary: false, productionLineId: COBBLE_LINE, lineRateSource: 'Hybrid',
        contributions: [
          { productionAreaId: PIT, areaName: 'Quarry pit', areaSurveyId: SURVEY_2, unitKey: 'BLOCK:STONE', yieldRowUnitKey: 'BLOCK:STONE', count: 300, sharedBy: 1, share: 1, ratePerUnitPerHour: 0.01, byproductChance: 1, ratePerHour: 3 },
        ],
      },
      {
        itemBlueprintId: COAL, itemBlueprintName: 'Coal', derivedRatePerHour: 1, override: 'Scale', overrideValue: 0.5,
        baseRatePerHour: 0.5, isPrimary: true, productionLineId: null, lineRateSource: null,
        contributions: [
          { productionAreaId: PIT, areaName: 'Quarry pit', areaSurveyId: SURVEY_2, unitKey: 'BLOCK:COAL_ORE', yieldRowUnitKey: 'BLOCK:*', count: 100, sharedBy: 2, share: 0.5, ratePerUnitPerHour: 0.02, byproductChance: 1, ratePerHour: 1 },
        ],
      },
    ],
    unmatchedUnitKeys: ['BLOCK:DIORITE'],
    notes: [],
  };
}

/** A structure page in another spec: the yield panel of a Configured structure (no areas, no outputs). */
export function mockConfiguredYield(api: MockApi): void {
  api.on<ProductionYieldDto>('GET', /^ProductionStructures\/\d+\/yield$/, ({ path }) => ({
    body: {
      productionStructureId: Number(path.split('/')[1]), yieldSource: 'Configured', productionKind: null, level: 1, surveysRun: false,
      areas: [], outputs: [], unmatchedUnitKeys: [], notes: [],
    },
  }));
}
