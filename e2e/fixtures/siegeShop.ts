import type { PagedQueryDto, PagedResultDto } from '../../src/types/dtos/common/PagedQuery';
import type { FormConfigurationDto, FormFieldDto, FormStepDto } from '../../src/types/dtos/forms/FormModels';
import type { EntityMetadataDto } from '../../src/types/dtos/metadata/MetadataModels';
import type { SiegeShopCategoryDto, SiegeShopEntryListDto } from '../../src/types/dtos/siege/SiegeShopDtos';
import { FieldType } from '../../src/utils/enums';
import type { MockApi } from '../support/mockApi';
import { siegeMetadata } from './siegeWeapons';

/**
 * Siege shop catalogue (PandiO/knk-workspace#867) for e2e/siege-shop.spec.ts, typed with the app's DTOs: the three
 * seeded categories, default and scenario-only entries (the § 12.2 seed and a weapon at its template price) and
 * one-step forms for the save paths. The seeded forms have more steps; the API tests check their fields.
 */

export const categoryRows: SiegeShopCategoryDto[] = [
  { id: 1, key: 'siege-weapons', name: 'Siege weapons', iconMaterial: 'minecraft:crossbow', sortOrder: 0 },
  { id: 2, key: 'consumables', name: 'Consumables', iconMaterial: 'minecraft:golden_apple', sortOrder: 1 },
  { id: 3, key: 'magic', name: 'Magic', iconMaterial: 'minecraft:blaze_rod', sortOrder: 2 },
];

export const entryRows: SiegeShopEntryListDto[] = [
  { id: 1, name: 'Ender Pearl', gameMode: 'Siege', categoryName: 'Consumables', kind: 'Item', quantity: 1, price: 300, maxPerMatch: 8, sortOrder: 0, enabled: true },
  { id: 2, name: 'Splash Potion of Healing II', gameMode: 'Siege', categoryName: 'Consumables', kind: 'Item', quantity: 1, price: 150, maxPerMatch: 10, sortOrder: 1, enabled: true },
  { id: 9, name: 'Trebuchet', gameMode: 'Siege', categoryName: 'Siege weapons', kind: 'SiegeWeapon', quantity: 1, price: null, maxPerMatch: null, sortOrder: 0, enabled: true },
  { id: 5, name: 'Ender Pearl', gameMode: 'SiegeSurvival', categoryName: 'Consumables', kind: 'Item', quantity: 1, price: 3000, maxPerMatch: 8, sortOrder: 0, enabled: true },
  { id: 12, name: 'Arrow x16', gameMode: 'Siege', siegeScenarioId: 100, siegeScenarioName: 'Siege of Cinix', categoryName: 'Consumables', kind: 'Item', quantity: 16, price: 40, maxPerMatch: null, sortOrder: 5, enabled: false },
];

function mockSearch<T extends { name: string }>(api: MockApi, path: string, rows: T[]): void {
  api.on<PagedResultDto<T>>('POST', path, ({ body }) => {
    const query = body as PagedQueryDto & { pageNumber?: number };
    const term = (query.searchTerm ?? '').toLowerCase();
    const items = rows.filter(r => !term || r.name.toLowerCase().includes(term));
    return { body: { items, totalCount: items.length, page: query.pageNumber ?? query.page ?? 1, pageSize: query.pageSize ?? 10, totalPages: 1 } };
  });
}

export const mockCategorySearch = (api: MockApi) => mockSearch(api, 'SiegeShopCategories/search', categoryRows);
export const mockEntrySearch = (api: MockApi) => mockSearch(api, 'SiegeShopEntries/search', entryRows);

function field(values: Pick<FormFieldDto, 'id' | 'fieldName' | 'label' | 'fieldType' | 'order'> & Partial<FormFieldDto>): FormFieldDto {
  return { isRequired: false, isReadOnly: false, isReusable: false, isLinkedToSource: false, hasCompatibilityIssues: false, validations: [], ...values };
}

function step(values: Pick<FormStepDto, 'id' | 'stepName' | 'order' | 'fields'> & Partial<FormStepDto>): FormStepDto {
  return {
    isReusable: false, isLinkedToSource: false, hasCompatibilityIssues: false, isManyToManyRelationship: false,
    childFormSteps: [], conditions: [], ...values,
  };
}

/** A category form: key, name, icon and order. */
export const categoryForm: FormConfigurationDto = {
  id: '871',
  entityTypeName: 'SiegeShopCategory',
  configurationName: 'SiegeShopCategory (e2e)',
  isDefault: true,
  steps: [
    step({
      id: '872',
      stepName: 'Category',
      order: 0,
      fields: [
        field({ id: '873', fieldName: 'Key', label: 'Key', fieldType: FieldType.String, isRequired: true, order: 0 }),
        field({ id: '874', fieldName: 'Name', label: 'Name', fieldType: FieldType.String, isRequired: true, order: 1 }),
        field({ id: '875', fieldName: 'IconMaterial', label: 'Icon', fieldType: FieldType.String, order: 2 }),
        field({ id: '876', fieldName: 'SortOrder', label: 'Order', fieldType: FieldType.Integer, order: 3 }),
      ],
    }),
  ],
};

export const categoryFormMetadata: EntityMetadataDto = {
  ...siegeMetadata('SiegeShopCategory'),
  fields: [
    { fieldName: 'Key', fieldType: 'String', isNullable: false, isRelatedEntity: false, hasDefaultValue: false },
    { fieldName: 'Name', fieldType: 'String', isNullable: false, isRelatedEntity: false, hasDefaultValue: false },
    { fieldName: 'IconMaterial', fieldType: 'String', isNullable: true, isRelatedEntity: false, hasDefaultValue: false },
    { fieldName: 'SortOrder', fieldType: 'Int32', isNullable: false, isRelatedEntity: false, hasDefaultValue: true, defaultValue: '0' },
  ],
};

/** An entry form with the price and brake fields (the category, kind and target pickers are left to the API tests). */
export const entryForm: FormConfigurationDto = {
  id: '881',
  entityTypeName: 'SiegeShopEntry',
  configurationName: 'SiegeShopEntry (e2e)',
  isDefault: true,
  steps: [
    step({
      id: '882',
      stepName: 'Price',
      order: 0,
      fields: [
        field({ id: '883', fieldName: 'DisplayName', label: 'Display name', fieldType: FieldType.String, order: 0 }),
        field({ id: '884', fieldName: 'Price', label: 'Price', fieldType: FieldType.Integer, order: 1 }),
        field({ id: '885', fieldName: 'PriceStep', label: 'Price step', fieldType: FieldType.Integer, order: 2 }),
        field({ id: '886', fieldName: 'CooldownSeconds', label: 'Cooldown (seconds)', fieldType: FieldType.Integer, order: 3 }),
        field({ id: '887', fieldName: 'MaxPerMatch', label: 'Max per match', fieldType: FieldType.Integer, order: 4 }),
      ],
    }),
  ],
};

export const entryFormMetadata: EntityMetadataDto = {
  ...siegeMetadata('SiegeShopEntry'),
  fields: [
    { fieldName: 'DisplayName', fieldType: 'String', isNullable: true, isRelatedEntity: false, hasDefaultValue: false },
    { fieldName: 'Price', fieldType: 'Int32', isNullable: true, isRelatedEntity: false, hasDefaultValue: false },
    { fieldName: 'PriceStep', fieldType: 'Int32', isNullable: true, isRelatedEntity: false, hasDefaultValue: false },
    { fieldName: 'CooldownSeconds', fieldType: 'Int32', isNullable: true, isRelatedEntity: false, hasDefaultValue: false },
    { fieldName: 'MaxPerMatch', fieldType: 'Int32', isNullable: true, isRelatedEntity: false, hasDefaultValue: false },
  ],
};
