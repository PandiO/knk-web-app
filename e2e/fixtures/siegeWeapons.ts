import type { PagedQueryDto, PagedResultDto } from '../../src/types/dtos/common/PagedQuery';
import type { FormConfigurationDto, FormFieldDto, FormStepDto } from '../../src/types/dtos/forms/FormModels';
import type { EntityMetadataDto } from '../../src/types/dtos/metadata/MetadataModels';
import type { SiegeAmmoTypeListDto, SiegeWeaponTemplateListDto } from '../../src/types/dtos/siege/SiegeWeaponDtos';
import { FieldType } from '../../src/utils/enums';
import type { MockApi } from '../support/mockApi';
import { accessMetadata } from './dashboardAccess';

/**
 * Siege weapons phase 1 (PandiO/knk-workspace#782) for e2e/siege-weapons.spec.ts, typed with the app's DTOs: two
 * weapon templates and two ammo types, the metadata the API sends (Siege area, knk.siege.admin.manage) and one-step
 * forms for the save paths. The seeded forms have more steps; the API tests check their fields.
 */

export const SIEGE = 'knk.siege.admin.manage';
export const CONTENT = 'knk.admin.content';

export const templateRows: SiegeWeaponTemplateListDto[] = [
  { id: 1, name: 'Trebuchet', kind: 'Indirect', sizeClass: 'Large', matchPrice: 800, unlockPrice: 5000, ammoTypeCount: 4 },
  { id: 2, name: 'Ballista', kind: 'Direct', sizeClass: 'Small', matchPrice: 200, unlockPrice: 1500, ammoTypeCount: 3 },
];

export const ammoRows: SiegeAmmoTypeListDto[] = [
  { id: 11, name: 'Heavy boulder', effect: 'Impact', damage: 12, structureDamage: 120, blastRadius: 2, pricePerShot: 20 },
  { id: 12, name: 'Heavy bomb', effect: 'Explosion', damage: 8, structureDamage: 60, blastRadius: 5, pricePerShot: 30 },
];

/** The API's metadata for a Siege-area type: view with the siege node, create and edit with it and the content node. */
export function siegeMetadata(entityName: string): EntityMetadataDto {
  const base = accessMetadata(entityName, SIEGE);
  return { ...base, actionNodes: { ...base.actionNodes, create: [SIEGE, CONTENT], edit: [SIEGE, CONTENT] } };
}

function mockSearch<T extends { name: string }>(api: MockApi, path: string, rows: T[]): void {
  api.on<PagedResultDto<T>>('POST', path, ({ body }) => {
    const query = body as PagedQueryDto & { pageNumber?: number };
    const term = (query.searchTerm ?? '').toLowerCase();
    const items = rows.filter(r => !term || r.name.toLowerCase().includes(term));
    return { body: { items, totalCount: items.length, page: query.pageNumber ?? query.page ?? 1, pageSize: query.pageSize ?? 10, totalPages: 1 } };
  });
}

export const mockTemplateSearch = (api: MockApi) => mockSearch(api, 'SiegeWeaponTemplates/search', templateRows);
export const mockAmmoSearch = (api: MockApi) => mockSearch(api, 'SiegeAmmoTypes/search', ammoRows);

function field(values: Pick<FormFieldDto, 'id' | 'fieldName' | 'label' | 'fieldType' | 'order'> & Partial<FormFieldDto>): FormFieldDto {
  return { isRequired: false, isReadOnly: false, isReusable: false, isLinkedToSource: false, hasCompatibilityIssues: false, validations: [], ...values };
}

function step(values: Pick<FormStepDto, 'id' | 'stepName' | 'order' | 'fields'> & Partial<FormStepDto>): FormStepDto {
  return {
    isReusable: false, isLinkedToSource: false, hasCompatibilityIssues: false, isManyToManyRelationship: false,
    childFormSteps: [], conditions: [], ...values,
  };
}

/** A template form with the name, range and the W58 spread fields. */
export const templateForm: FormConfigurationDto = {
  id: '81',
  entityTypeName: 'SiegeWeaponTemplate',
  configurationName: 'SiegeWeaponTemplate (e2e)',
  isDefault: true,
  steps: [
    step({
      id: '82',
      stepName: 'General',
      order: 0,
      fields: [
        field({ id: '83', fieldName: 'Name', label: 'Name', fieldType: FieldType.String, isRequired: true, order: 0 }),
        field({ id: '84', fieldName: 'MaxRange', label: 'Max range (blocks)', fieldType: FieldType.Decimal, order: 1 }),
        field({ id: '85', fieldName: 'StartSpreadRadius', label: 'Start spread (blocks)', fieldType: FieldType.Decimal, order: 2 }),
        field({ id: '86', fieldName: 'MinSpreadRadius', label: 'Minimum spread (blocks)', fieldType: FieldType.Decimal, order: 3 }),
        field({ id: '87', fieldName: 'UnlockPrice', label: 'Unlock price (coins)', fieldType: FieldType.Integer, order: 4 }),
      ],
    }),
  ],
};

export const templateFormMetadata: EntityMetadataDto = {
  ...siegeMetadata('SiegeWeaponTemplate'),
  fields: [
    { fieldName: 'Name', fieldType: 'String', isNullable: false, isRelatedEntity: false, hasDefaultValue: false },
    { fieldName: 'MaxRange', fieldType: 'Double', isNullable: false, isRelatedEntity: false, hasDefaultValue: true, defaultValue: '100' },
    { fieldName: 'StartSpreadRadius', fieldType: 'Double', isNullable: false, isRelatedEntity: false, hasDefaultValue: true, defaultValue: '8' },
    { fieldName: 'MinSpreadRadius', fieldType: 'Double', isNullable: false, isRelatedEntity: false, hasDefaultValue: true, defaultValue: '3' },
    { fieldName: 'UnlockPrice', fieldType: 'Int32', isNullable: false, isRelatedEntity: false, hasDefaultValue: true, defaultValue: '1000' },
  ],
};

/** An ammo type form with the name, player damage and structure damage (W65). */
export const ammoForm: FormConfigurationDto = {
  id: '91',
  entityTypeName: 'SiegeAmmoType',
  configurationName: 'SiegeAmmoType (e2e)',
  isDefault: true,
  steps: [
    step({
      id: '92',
      stepName: 'General',
      order: 0,
      fields: [
        field({ id: '93', fieldName: 'Name', label: 'Name', fieldType: FieldType.String, isRequired: true, order: 0 }),
        field({ id: '94', fieldName: 'Damage', label: 'Player damage', fieldType: FieldType.Decimal, order: 1 }),
        field({ id: '95', fieldName: 'StructureDamage', label: 'Structure damage', fieldType: FieldType.Decimal, order: 2 }),
        field({ id: '96', fieldName: 'PricePerShot', label: 'Price per shot (siege points)', fieldType: FieldType.Integer, order: 3 }),
      ],
    }),
  ],
};

export const ammoFormMetadata: EntityMetadataDto = {
  ...siegeMetadata('SiegeAmmoType'),
  fields: [
    { fieldName: 'Name', fieldType: 'String', isNullable: false, isRelatedEntity: false, hasDefaultValue: false },
    { fieldName: 'Damage', fieldType: 'Double', isNullable: false, isRelatedEntity: false, hasDefaultValue: true, defaultValue: '10' },
    { fieldName: 'StructureDamage', fieldType: 'Double', isNullable: false, isRelatedEntity: false, hasDefaultValue: true, defaultValue: '100' },
    { fieldName: 'PricePerShot', fieldType: 'Int32', isNullable: false, isRelatedEntity: false, hasDefaultValue: true, defaultValue: '10' },
  ],
};

/**
 * #799: the weapon spot form's "Place and size" step as the seed has it, with the SiegeWeaponSpot world task on Min X,
 * plus the scenario id the save path needs (read-only and filled from the scenario in the real form).
 */
export const spotForm: FormConfigurationDto = {
  id: '71',
  entityTypeName: 'SiegeWeaponSpot',
  configurationName: 'SiegeWeaponSpot (e2e)',
  isDefault: true,
  steps: [
    step({
      id: '72',
      stepName: 'Place and size',
      order: 0,
      fields: [
        field({ id: '700', fieldName: 'SiegeScenarioId', label: 'Scenario id', fieldType: FieldType.Integer, order: 0 }),
        field({ id: '701', fieldName: 'Name', label: 'Name', fieldType: FieldType.String, isRequired: true, order: 1 }),
        field({
          id: '702', fieldName: 'Facing', label: 'Facing', fieldType: FieldType.Enum, defaultValue: 'North', order: 2,
          settingsJson: JSON.stringify({ enumValues: ['North', 'East', 'South', 'West'] }),
        }),
        field({
          id: '703', fieldName: 'SizeClass', label: 'Size class', fieldType: FieldType.Enum, defaultValue: 'Small', order: 3,
          settingsJson: JSON.stringify({ enumValues: ['Small', 'Medium', 'Large'] }),
        }),
        field({ id: '704', fieldName: 'WgRegionId', label: 'WorldGuard region', fieldType: FieldType.String, order: 4 }),
        field({
          id: '705', fieldName: 'MinX', label: 'Min X', fieldType: FieldType.Integer, order: 5,
          settingsJson: JSON.stringify({ worldTask: { enabled: true, taskType: 'SiegeWeaponSpot' } }),
        }),
        field({ id: '706', fieldName: 'MinY', label: 'Min Y', fieldType: FieldType.Integer, order: 6 }),
        field({ id: '707', fieldName: 'MinZ', label: 'Min Z', fieldType: FieldType.Integer, order: 7 }),
        field({ id: '708', fieldName: 'MaxX', label: 'Max X', fieldType: FieldType.Integer, order: 8 }),
        field({ id: '709', fieldName: 'MaxY', label: 'Max Y', fieldType: FieldType.Integer, order: 9 }),
        field({ id: '710', fieldName: 'MaxZ', label: 'Max Z', fieldType: FieldType.Integer, order: 10 }),
      ],
    }),
  ],
};

export const spotFormMetadata: EntityMetadataDto = {
  ...siegeMetadata('SiegeWeaponSpot'),
  fields: [
    { fieldName: 'SiegeScenarioId', fieldType: 'Int32', isNullable: false, isRelatedEntity: false, hasDefaultValue: false },
    { fieldName: 'Name', fieldType: 'String', isNullable: false, isRelatedEntity: false, hasDefaultValue: false },
    { fieldName: 'Facing', fieldType: 'SiegeWeaponFacing', isNullable: false, isRelatedEntity: false, hasDefaultValue: true, defaultValue: 'North' },
    { fieldName: 'SizeClass', fieldType: 'SiegeWeaponSizeClass', isNullable: false, isRelatedEntity: false, hasDefaultValue: true, defaultValue: 'Small' },
    { fieldName: 'WgRegionId', fieldType: 'String', isNullable: true, isRelatedEntity: false, hasDefaultValue: false },
    ...['MinX', 'MinY', 'MinZ', 'MaxX', 'MaxY', 'MaxZ'].map(fieldName => (
      { fieldName, fieldType: 'Int32', isNullable: true, isRelatedEntity: false, hasDefaultValue: false })),
  ],
};

/**
 * The world task the panel creates and the result the plugin's WeaponSpotTaskHandler completes it with
 * (knk-core SpotTaskOutput): 15 along x, 16 high, 9 along z, facing east (Large), from a WorldGuard region, with a
 * floor warning.
 */
export const SPOT_TASK_OUTPUT = {
  fieldName: 'SiegeWeaponSpot',
  status: 'Warning',
  minX: 100, minY: 64, minZ: -20, maxX: 114, maxY: 79, maxZ: -12,
  facing: 'East',
  sizeClass: 'Large',
  wgRegionId: 'spot_east_tower',
  world: 'siege',
  warnings: ["The floor isn't solid: 3 of 135 blocks under the spot are air or not solid, so a weapon would hang in the air."],
  capturedAt: 1763550000000,
};
