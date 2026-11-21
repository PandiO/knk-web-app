import { StructureDto } from '../structure/StructureDto';
import { StructureStorageNavDto } from '../structure/ProductionWorldDtos';
import { NamedRefDto } from './ProductionEngineDtos';

// Shops P10 (PandiO/knk-workspace#248 API, #688 web app; shops DESIGN § 2-5, § 9): shop types with accepted categories
// and levels, shops, the static catalogue, the live offer, hourly trade stats and the town account. Mirrors knk-web-api
// `Dtos/ShopDtos.cs` and `Enums/ShopEnums.cs`. On create/update a null field means "keep" (create: the default).

/** What a shop does with goods (shops DESIGN § 2.2). Every shop can also buy from players and resell. */
export type ShopKind = 'Trading' | 'Processing';
export const SHOP_KINDS: readonly ShopKind[] = ['Trading', 'Processing'];

/** Where a catalogue entry's goods come from: the shop's Merchandise storage, or never sold out (blueprints only). */
export type ShopStockMode = 'Stocked' | 'Unlimited';
export const SHOP_STOCK_MODES: readonly ShopStockMode[] = ['Stocked', 'Unlimited'];

/** Where an offer item's price comes from. */
export type ShopPriceSource = 'Static' | 'Formula' | 'None';

/** The shops section of the game settings (`production.shops`). */
export interface ProductionShopSettingsDto {
    enchantmentPercentPerLevel: number;
    statsLookbackHours: number;
}

// ---- shop types and levels ----

/** `api/ShopTypes/{id}`. `acceptedCategoryIds` replaces the whole list on create/update; null keeps it. */
export interface ShopTypeDto {
    id?: number | null;
    name?: string | null;
    description?: string | null;
    defaultKind?: ShopKind | null;
    isActive?: boolean | null;
    acceptedCategoryIds?: number[] | null;
    /** Read only. */
    acceptedCategories?: NamedRefDto[] | null;
    /** Read only. */
    levels?: ShopTypeLevelDto[] | null;
    createdAt?: string | null;
}

/** Search row of `api/ShopTypes/search`. */
export interface ShopTypeListDto {
    id: number;
    name: string;
    defaultKind: ShopKind;
    isActive: boolean;
    acceptedCategoryCount: number;
    levelCount: number;
}

/** `api/ShopTypeLevels/{id}`. Caps and the default min/max: 0 clears them. */
export interface ShopTypeLevelDto {
    id?: number | null;
    shopTypeId?: number | null;
    shopType?: NamedRefDto | null;
    level?: number | null;
    cycleSpeedMultiplier?: number | null;
    yieldMultiplier?: number | null;
    inputCostMultiplier?: number | null;
    priceMultiplier?: number | null;
    merchandiseMaxUnits?: number | null;
    inputMaxUnits?: number | null;
    unitsPerSlot?: number | null;
    reorderPointUnits?: number | null;
    targetUnits?: number | null;
}

/** Search row of `api/ShopTypeLevels/search` (filter `shopTypeId`). */
export interface ShopTypeLevelListDto {
    id: number;
    shopTypeId: number;
    shopTypeName?: string | null;
    level: number;
    priceMultiplier: number;
    cycleSpeedMultiplier: number;
    yieldMultiplier: number;
    merchandiseMaxUnits?: number | null;
}

// ---- shops ----

/** `api/Shops/{id}`: every structure field plus the shop's own (a shop is a production structure underneath). */
export interface ShopDto extends StructureDto {
    shopTypeId?: number | null;
    shopType?: NamedRefDto | null;
    kind?: ShopKind | null;
    level?: number | null;
    taxModifier?: number | null;
    buyBackPercent?: number | null;
    /** 0 clears it. */
    shopkeeperLocationId?: number | null;
    hideSoldOut?: boolean | null;
    productionEnabled?: boolean | null;
    workersTotal?: number | null;
    /** Read only. */
    workersPresent?: number | null;
    /** 0 clears it (the planner's default). */
    transportCapacity?: number | null;
    /** Read only: the Input and Merchandise storages, created with the shop. */
    storages?: StructureStorageNavDto[] | null;
    /** Read only: the town whose account the shop's income goes to. */
    effectiveTownId?: number | null;
    catalogueEntryCount?: number | null;
}

// ---- catalogue and offer ----

/** `api/ShopCatalogueEntries/{id}`: a blueprint or one unique item at a static price (0 clears it: the formula). */
export interface ShopCatalogueEntryDto {
    id?: number | null;
    shopId?: number | null;
    shop?: NamedRefDto | null;
    itemBlueprintId?: number | null;
    itemBlueprint?: NamedRefDto | null;
    itemInstanceId?: number | null;
    staticPrice?: number | null;
    stockMode?: ShopStockMode | null;
    pinned?: boolean | null;
    sortOrder?: number | null;
    enabled?: boolean | null;
    createdAt?: string | null;
}

/** Search row of `api/ShopCatalogueEntries/search` (filters `shopId`, `itemBlueprintId`). */
export interface ShopCatalogueEntryListDto {
    id: number;
    shopId: number;
    shopName?: string | null;
    itemBlueprintId: number;
    itemBlueprintName?: string | null;
    itemInstanceId?: number | null;
    staticPrice?: number | null;
    stockMode: ShopStockMode;
    pinned: boolean;
    sortOrder: number;
    enabled: boolean;
}

/** `GET api/Shops/{id}/offer`: the catalogue and the Merchandise stock without an entry, with price and stock. */
export interface ShopOfferDto {
    shopId: number;
    shopName: string;
    kind: ShopKind;
    level: number;
    shopTypeName?: string | null;
    townId?: number | null;
    townName?: string | null;
    hideSoldOut: boolean;
    buysFromPlayers: boolean;
    items: ShopOfferItemDto[];
}

export interface ShopOfferItemDto {
    /** Null for Merchandise stock without an entry (restocked goods, bought-back items). */
    catalogueEntryId?: number | null;
    itemBlueprintId: number;
    itemBlueprintName: string;
    itemInstanceId?: number | null;
    unitPrice?: number | null;
    priceSource: ShopPriceSource;
    /** Null = unlimited. */
    stock?: number | null;
    soldOut: boolean;
    pinned: boolean;
    sortOrder: number;
    enchantments?: string[] | null;
}

// ---- trade stats and the town account ----

/** `api/ShopTradeStats/{id}`: one shop, blueprint and UTC hour (shops DESIGN § 9.1). */
export interface ShopTradeStatDto {
    id: number;
    shopId: number;
    shop?: NamedRefDto | null;
    itemBlueprintId: number;
    itemBlueprint?: NamedRefDto | null;
    hourStart: string;
    unitsSold: number;
    revenue: number;
    unitsBoughtBack: number;
    buyBackPaid: number;
    unitsSupplied: number;
    distinctCustomers: number;
    townPlayerCount?: number | null;
    avgSellPrice?: number | null;
    stockAtEnd: number;
    computedAt: string;
}

/** Search row of `api/ShopTradeStats/search` (filters `shopId`, `itemBlueprintId`, `from`, `to`), newest hour first. */
export interface ShopTradeStatListDto {
    id: number;
    shopId: number;
    shopName?: string | null;
    itemBlueprintId: number;
    itemBlueprintName?: string | null;
    hourStart: string;
    unitsSold: number;
    revenue: number;
    unitsBoughtBack: number;
    buyBackPaid: number;
    unitsSupplied: number;
    stockAtEnd: number;
}

/** `POST api/ShopTradeStats/rebuild`: UTC hours, from inclusive, to exclusive; one shop or all. */
export interface ShopTradeStatRebuildDto {
    shopId?: number | null;
    from: string;
    to: string;
}

export interface ShopTradeStatRebuildResultDto {
    hours: number;
    rowsWritten: number;
    rowsDeleted: number;
}

/** `api/TownAccounts/{id}` and `by-town/{townId}`. */
export interface TownAccountDto {
    id: number;
    townId: number;
    town?: NamedRefDto | null;
    coins: number;
    /** Whether the last town leg's balance after equals `coins`. */
    reconciled: boolean;
    ledgerBalance?: number | null;
    createdAt: string;
    updatedAt: string;
}

/** Search row of `api/TownAccounts/search` (filter `townId`). */
export interface TownAccountListDto {
    id: number;
    townId: number;
    townName?: string | null;
    coins: number;
    updatedAt: string;
}

/** One town leg of `GET api/TownAccounts/{id}/ledger`, newest first. */
export interface TownAccountEntryDto {
    entryId: number;
    transactionPublicId: string;
    reasonCode: string;
    amount: number;
    balanceBefore: number;
    balanceAfter: number;
    sourceType?: string | null;
    sourceRef?: string | null;
    userId?: number | null;
    createdAt: string;
}
