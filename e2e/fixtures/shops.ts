import type { EntityMetadataDto } from '../../src/types/dtos/metadata/MetadataModels';
import type { LookupItemDto, LookupSearchResponseDto } from '../../src/apiClients/lookupClient';
import type { ProductionOverviewDto } from '../../src/types/dtos/production/ProductionEngineDtos';
import type { ConsumerReplenishmentListDto, ConsumerViewDto } from '../../src/types/dtos/production/LogisticsDtos';
import type {
  ShopCatalogueEntryListDto,
  ShopDto,
  ShopOfferDto,
  ShopTradeStatListDto,
  ShopTypeDto,
  ShopTypeListDto,
  TownAccountDto,
  TownAccountEntryDto,
  TownAccountListDto,
} from '../../src/types/dtos/production/ShopDtos';
import type { StockPagedResultDto, StockTransactionListDto } from '../../src/types/dtos/stock/StockDtos';
import type { ProductionWorldListDto } from '../../src/types/dtos/structure/ProductionWorldDtos';
import type { MockApi } from '../support/mockApi';
import { accessMetadata } from './dashboardAccess';
import { MAIN, MARKET, PHOENIX, WORLD } from './productionWorld';
import { bakeryConsumer, mockPaged } from './logistics';

/**
 * Shops P10c in the web app (PandiO/knk-workspace#688) for e2e/shops.spec.ts, typed with the app's DTOs: the smoke
 * guide § 11.3 data. The Processing shop "Phoenix bakery" (31, shop type Bakery 9, level 2) is in the district Market
 * (8) of Phoenix (4), with its Input (131) and Merchandise (132) storages; the shop type buys Food (12); Bread (16) and
 * Apple (17) are the items; Phoenix's town account is 8.
 */

export { PHOENIX, MARKET, WORLD, mockPaged };
export const SHOP = 31;
export const SHOP_TYPE = 9;
export const LEVEL_1 = 91;
export const LEVEL_2 = 92;
export const FOOD = 12;
export const TOOLS = 13;
export const BREAD = 16;
export const APPLE = 17;
export const SHOP_INPUT = 131;
export const SHOP_MERCHANDISE = 132;
export const TOWN_ACCOUNT = 8;
export const ENTRY_BREAD = 51;
export const ENTRY_APPLE = 52;

export const shopTypeMetadata: EntityMetadataDto = accessMetadata('ShopType', WORLD);
export const shopTypeLevelMetadata: EntityMetadataDto = accessMetadata('ShopTypeLevel', WORLD);
export const shopMetadata: EntityMetadataDto = accessMetadata('Shop', WORLD);
export const shopCatalogueEntryMetadata: EntityMetadataDto = accessMetadata('ShopCatalogueEntry', WORLD);
export const shopTradeStatMetadata: EntityMetadataDto = { ...accessMetadata('ShopTradeStat', WORLD, false), deletable: false };
export const townAccountMetadata: EntityMetadataDto = { ...accessMetadata('TownAccount', WORLD, false), deletable: false };

const phoenix = { id: PHOENIX, name: 'Phoenix' };

/** `GET api/ShopTypes/9`: Bakery, buys Food, two levels. */
export function bakeryType(values: Partial<ShopTypeDto> = {}): ShopTypeDto {
  return {
    id: SHOP_TYPE, name: 'Bakery', description: 'Bread and cakes', defaultKind: 'Processing', isActive: true,
    acceptedCategories: [{ id: FOOD, name: 'Food' }],
    levels: [
      {
        id: LEVEL_1, shopTypeId: SHOP_TYPE, level: 1, cycleSpeedMultiplier: 1, yieldMultiplier: 1, inputCostMultiplier: 1, priceMultiplier: 1,
        merchandiseMaxUnits: 640, inputMaxUnits: 320, unitsPerSlot: null, reorderPointUnits: 16, targetUnits: 64,
      },
      {
        id: LEVEL_2, shopTypeId: SHOP_TYPE, level: 2, cycleSpeedMultiplier: 1.25, yieldMultiplier: 1.1, inputCostMultiplier: 0.9, priceMultiplier: 1.2,
        merchandiseMaxUnits: 1280, inputMaxUnits: 640, unitsPerSlot: 64, reorderPointUnits: 32, targetUnits: 128,
      },
    ],
    createdAt: '2026-11-21T08:00:00Z',
    ...values,
  };
}

export const shopTypeRows: ShopTypeListDto[] = [
  { id: SHOP_TYPE, name: 'Bakery', defaultKind: 'Processing', isActive: true, acceptedCategoryCount: 1, levelCount: 2 },
  { id: 10, name: 'General store', defaultKind: 'Trading', isActive: true, acceptedCategoryCount: 0, levelCount: 0 },
];

/** `GET api/Shops/31`: the Processing bakery at level 2 in Market, its worker away restocking. */
export function bakeryShop(values: Partial<ShopDto> = {}): ShopDto {
  return {
    id: SHOP, name: 'Phoenix bakery', description: '', allowEntry: true, wgRegionId: 'domain_31', worldName: 'world',
    districtId: MARKET, streetId: MAIN, houseNumber: 5, townId: null, effectiveTownId: PHOENIX, isRural: false,
    district: { id: MARKET, name: 'Market', townName: 'Phoenix' }, street: { id: MAIN, name: 'Main' }, town: null, territoryFlag: 'None',
    shopTypeId: SHOP_TYPE, shopType: { id: SHOP_TYPE, name: 'Bakery' }, kind: 'Processing', level: 2, taxModifier: 1.1, buyBackPercent: 50,
    shopkeeperLocationId: null, hideSoldOut: false, productionEnabled: true, workersTotal: 1, workersPresent: 0, transportCapacity: null,
    storages: [
      { id: SHOP_INPUT, name: 'Phoenix bakery - input', purpose: 'Input' },
      { id: SHOP_MERCHANDISE, name: 'Phoenix bakery - merchandise', purpose: 'Merchandise' },
    ],
    catalogueEntryCount: 2,
    ...values,
  };
}

export const shopRows: ProductionWorldListDto[] = [{
  id: SHOP, name: 'Phoenix bakery', description: '', wgRegionId: 'domain_31', worldName: 'world', houseNumber: 5, streetId: MAIN, streetName: 'Main',
  districtId: MARKET, districtName: 'Market', townId: PHOENIX, townName: 'Phoenix', isRural: false, territoryFlag: 'None', level: 2, productionEnabled: true,
  kind: 'Processing', shopTypeId: SHOP_TYPE, shopTypeName: 'Bakery',
}, {
  id: 32, name: 'Corner stall', description: '', wgRegionId: 'domain_32', worldName: 'world', houseNumber: 6, streetId: MAIN, streetName: 'Main',
  districtId: MARKET, districtName: 'Market', townId: PHOENIX, townName: 'Phoenix', isRural: false, territoryFlag: 'None', level: 1, productionEnabled: false,
  kind: 'Trading', shopTypeId: null, shopTypeName: null,
}];

/** `GET api/Shops/31/offer`: Bread at a static price, Apple sold out at the formula price, a bought-back enchanted sword. */
export function bakeryOffer(values: Partial<ShopOfferDto> = {}): ShopOfferDto {
  return {
    shopId: SHOP, shopName: 'Phoenix bakery', kind: 'Processing', level: 2, shopTypeName: 'Bakery', townId: PHOENIX, townName: 'Phoenix',
    hideSoldOut: false, buysFromPlayers: true,
    items: [
      { catalogueEntryId: ENTRY_BREAD, itemBlueprintId: BREAD, itemBlueprintName: 'Bread', unitPrice: 12, priceSource: 'Static', stock: null, soldOut: false, pinned: true, sortOrder: 0 },
      { catalogueEntryId: ENTRY_APPLE, itemBlueprintId: APPLE, itemBlueprintName: 'Apple', unitPrice: 4, priceSource: 'Formula', stock: 0, soldOut: true, pinned: false, sortOrder: 1 },
      {
        catalogueEntryId: null, itemBlueprintId: 18, itemBlueprintName: 'Diamond sword', itemInstanceId: 7001, unitPrice: 330, priceSource: 'Formula',
        stock: 1, soldOut: false, pinned: false, sortOrder: 100, enchantments: ['Sharpness 3'],
      },
    ],
    ...values,
  };
}

export const bakeryEntries: ShopCatalogueEntryListDto[] = [
  { id: ENTRY_APPLE, shopId: SHOP, shopName: 'Phoenix bakery', itemBlueprintId: APPLE, itemBlueprintName: 'Apple', staticPrice: null, stockMode: 'Stocked', pinned: false, sortOrder: 1, enabled: true },
  { id: ENTRY_BREAD, shopId: SHOP, shopName: 'Phoenix bakery', itemBlueprintId: BREAD, itemBlueprintName: 'Bread', staticPrice: 12, stockMode: 'Unlimited', pinned: true, sortOrder: 0, enabled: true },
];

/** `GET api/TownAccounts/by-town/4` and `/8`. */
export function phoenixAccount(values: Partial<TownAccountDto> = {}): TownAccountDto {
  return {
    id: TOWN_ACCOUNT, townId: PHOENIX, town: phoenix, coins: 1250, reconciled: true, ledgerBalance: 1250,
    createdAt: '2026-11-21T08:00:00Z', updatedAt: '2026-11-21T10:40:00Z', ...values,
  };
}

export const townAccountRows: TownAccountListDto[] = [{ id: TOWN_ACCOUNT, townId: PHOENIX, townName: 'Phoenix', coins: 1250, updatedAt: '2026-11-21T10:40:00Z' }];

/** The account's town legs, newest first: a buy-back out, two purchases in. */
export const phoenixLedger: TownAccountEntryDto[] = [
  {
    entryId: 903, transactionPublicId: 'ctx-903', reasonCode: 'SHOP_BUYBACK', amount: -20, balanceBefore: 1270, balanceAfter: 1250,
    sourceType: 'ShopBuyBack', sourceRef: String(SHOP), userId: 7, username: 'Mara', stockTransactionId: 703, createdAt: '2026-11-21T10:40:00Z',
  },
  {
    entryId: 902, transactionPublicId: 'ctx-902', reasonCode: 'SHOP_PURCHASE', amount: 48, balanceBefore: 1222, balanceAfter: 1270,
    sourceType: 'ShopPurchase', sourceRef: String(SHOP), userId: 7, username: 'Mara', stockTransactionId: 702, createdAt: '2026-11-21T10:20:00Z',
  },
  {
    entryId: 901, transactionPublicId: 'ctx-901', reasonCode: 'SHOP_PURCHASE', amount: 12, balanceBefore: 1210, balanceAfter: 1222,
    sourceType: 'ShopPurchase', sourceRef: String(SHOP), userId: 8, username: null, stockTransactionId: null, createdAt: '2026-11-21T10:05:00Z',
  },
];

/** The shop's stock ledger: two sales and a buy-back. */
export const bakerySales: StockTransactionListDto[] = [
  { id: 703, reason: 'ShopBuyBack', mode: 'AllOrNothing', actorKind: 'PluginServer', sourceType: 'Shop', sourceRef: String(SHOP), note: null, createdAt: '2026-11-21T10:40:00Z', moveCount: 1, totalAmount: 1 },
  { id: 702, reason: 'ShopSale', mode: 'AllOrNothing', actorKind: 'PluginServer', sourceType: 'Shop', sourceRef: String(SHOP), note: null, createdAt: '2026-11-21T10:20:00Z', moveCount: 1, totalAmount: 4 },
  { id: 701, reason: 'ShopSale', mode: 'AllOrNothing', actorKind: 'PluginServer', sourceType: 'Shop', sourceRef: String(SHOP), note: null, createdAt: '2026-11-21T10:05:00Z', moveCount: 1, totalAmount: 1 },
];

/** The hourly stats of the ledger above: 10:00 UTC (5 Bread sold for 60, 1 Apple bought back for 2) and 11:00 (20 Bread supplied). */
export const bakeryStats: ShopTradeStatListDto[] = [
  {
    id: 3, shopId: SHOP, shopName: 'Phoenix bakery', itemBlueprintId: BREAD, itemBlueprintName: 'Bread', hourStart: '2026-11-21T11:00:00Z',
    unitsSold: 0, revenue: 0, unitsBoughtBack: 0, buyBackPaid: 0, unitsSupplied: 20, stockAtEnd: 20,
  },
  {
    id: 1, shopId: SHOP, shopName: 'Phoenix bakery', itemBlueprintId: BREAD, itemBlueprintName: 'Bread', hourStart: '2026-11-21T10:00:00Z',
    unitsSold: 5, revenue: 60, unitsBoughtBack: 0, buyBackPaid: 0, unitsSupplied: 0, stockAtEnd: 0,
  },
  {
    id: 2, shopId: SHOP, shopName: 'Phoenix bakery', itemBlueprintId: APPLE, itemBlueprintName: 'Apple', hourStart: '2026-11-21T10:00:00Z',
    unitsSold: 0, revenue: 0, unitsBoughtBack: 1, buyBackPaid: 2, unitsSupplied: 0, stockAtEnd: 1,
  },
];

/** `api/ShopTradeStats/search` with its filters applied (shopId, itemBlueprintId, from, to). */
export function mockTradeStats(api: MockApi, rows: ShopTradeStatListDto[]): void {
  api.on<StockPagedResultDto<ShopTradeStatListDto>>('POST', 'ShopTradeStats/search', ({ body }) => {
    const query = body as { pageNumber?: number; pageSize?: number; filters?: Record<string, string> };
    const f = query.filters ?? {};
    const items = rows.filter(r => (!f.shopId || r.shopId === Number(f.shopId))
      && (!f.from || r.hourStart >= f.from.replace('.000Z', 'Z'))
      && (!f.to || r.hourStart < f.to.replace('.000Z', 'Z')));
    return { body: { items, totalCount: items.length, pageNumber: query.pageNumber ?? 1, pageSize: query.pageSize ?? 20 } };
  });
}

/** The production view of the shop (a production structure underneath), no kind of its own. */
export function shopProduction(values: Partial<ProductionOverviewDto> = {}): ProductionOverviewDto {
  return {
    productionStructureId: SHOP, featureEnabled: true, productionEnabled: true, productionKind: null, level: 2, workersPresent: 0, workersTotal: 1,
    outputStorageId: SHOP_MERCHANDISE, inputStorageId: SHOP_INPUT, climateZone: null, weatherToday: null,
    notProducingReasons: ['It has no production kind.'], lines: [], recentCycles: [], ...values,
  };
}

/** The shop as a consumer: Bread restocked into Merchandise at the level's default min/max. */
export function shopConsumer(values: Partial<ConsumerViewDto> = {}): ConsumerViewDto {
  return bakeryConsumer({
    structureId: SHOP, structureName: 'Phoenix bakery', workersTotal: 1, workersPresent: 0, warnings: [],
    storages: [{
      storageId: SHOP_MERCHANDISE, storageName: 'Phoenix bakery - merchandise', purpose: 'Merchandise',
      lines: [{ itemBlueprintId: BREAD, itemBlueprintName: 'Bread', stock: 0, inbound: 20, reorderPoint: 32, targetLevel: 128, priorityClass: 'Normal', settingSource: 'ShopLevel', ruleIds: [] }],
    }],
    ...values,
  });
}

const lookups: Record<string, LookupItemDto[]> = {
  Category: [{ id: FOOD, label: 'Food' }, { id: TOOLS, label: 'Tools' }],
  ItemBlueprint: [{ id: BREAD, label: 'Bread' }, { id: APPLE, label: 'Apple' }],
};

/** `api/Lookup/{type}/search` for the category and item pickers. */
export function mockShopLookups(api: MockApi): void {
  for (const [type, items] of Object.entries(lookups)) {
    api.on<LookupSearchResponseDto>('POST', `Lookup/${type}/search`, ({ body }) => {
      const term = ((body as { searchTerm?: string | null }).searchTerm ?? '').toLowerCase();
      const matches = items.filter(i => !term || i.label.toLowerCase().includes(term));
      return { body: { items: matches, total: matches.length } };
    });
  }
}

/**
 * The town page's account summary (#938) for a town without an account yet (404). Strict specs that open a town page as
 * staff with knk.admin.world use it (territory, landmarks, town detail, logistics); e2e/shops.spec.ts covers the summary.
 */
export function mockNoTownAccount(api: MockApi, townId: number): void {
  api.on('GET', `TownAccounts/by-town/${townId}`, () => ({ status: 404, body: { message: `No town account for town ${townId}.` } }));
}

/** Everything the shop page reads, for the bakery. */
export function mockShopPage(api: MockApi): void {
  api.json<ShopDto>('GET', `Shops/${SHOP}`, bakeryShop());
  api.json<ShopOfferDto>('GET', `Shops/${SHOP}/offer`, bakeryOffer());
  mockPaged<ShopCatalogueEntryListDto>(api, 'ShopCatalogueEntries/search', bakeryEntries);
  api.json<TownAccountDto>('GET', `TownAccounts/by-town/${PHOENIX}`, phoenixAccount());
  mockPaged<StockTransactionListDto>(api, 'StockTransactions/search', bakerySales);
  mockTradeStats(api, bakeryStats);
  api.json<ProductionOverviewDto>('GET', `ProductionStructures/${SHOP}/production`, shopProduction());
  api.json<ConsumerViewDto>('GET', `Logistics/consumers/${SHOP}`, shopConsumer());
  mockPaged<ConsumerReplenishmentListDto>(api, 'ConsumerReplenishments/search', []);
}
