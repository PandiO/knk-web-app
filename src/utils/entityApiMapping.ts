import { CategoryClient } from '../apiClients/categoryClient';
import { DomainClient } from '../apiClients/domainClient';
import { GradeClient } from '../apiClients/gradeClient';
import { TagClient } from '../apiClients/tagClient';
import { LandmarkClient } from '../apiClients/landmarkClient';
import { StructureClient } from '../apiClients/structureClient';
import { StreetClient } from '../apiClients/streetClient';
import { TownClient } from '../apiClients/townClient';
import { DistrictClient } from '../apiClients/districtClient';
import { MinecraftBlockRefClient } from '../apiClients/minecraftBlockRefClient';
import { MinecraftMaterialRefClient } from '../apiClients/minecraftMaterialRefClient';
import { ItemBlueprintClient } from '../apiClients/itemBlueprintClient';
import { KitClient } from '../apiClients/kitClient';
import { EnchantmentDefinitionClient } from '../apiClients/enchantmentDefinitionClient';
import { GateStructureClient } from '../apiClients/gateStructureClient';
import { GateDoorClient } from '../apiClients/gateDoorClient';
import { DomainSubRegionClient } from '../apiClients/domainSubRegionClient';
import { PagedQueryDto, PagedResultDto } from '../types/dtos/common/PagedQuery';
import { LocationClient } from '../apiClients/locationClient';
import { MinecraftEnchantmentRefClient } from '../apiClients/minecraftEnchantmentRefClient';
import { UserClient } from '../apiClients/userClient';
import { PermissionGroupClient } from '../apiClients/permissionGroupClient';
import { PermissionHolderClient } from '../apiClients/permissionHolderClient';
import { PermissionGrantClient } from '../apiClients/permissionGrantClient';
import { LootboxTypeClient } from '../apiClients/lootboxTypeClient';
import { LootboxSpecialEntryClient } from '../apiClients/lootboxSpecialEntryClient';
import { LootboxSpawnAreaClient } from '../apiClients/lootboxSpawnAreaClient';
import { BannerDesignClient } from '../apiClients/bannerDesignClient';
import { BannerLayerClient } from '../apiClients/bannerLayerClient';
import { ClanClient } from '../apiClients/clanClient';
import { SiegeScenarioClient } from '../apiClients/siegeScenarioClient';
import { SiegeTeamClient } from '../apiClients/siegeTeamClient';
import { SiegeSpawnpointClient } from '../apiClients/siegeSpawnpointClient';
import { SiegeObjectiveClient } from '../apiClients/siegeObjectiveClient';
import { SiegeLobbyClient } from '../apiClients/siegeLobbyClient';
import { SiegeWeaponTemplateClient } from '../apiClients/siegeWeaponTemplateClient';
import { SiegeAmmoTypeClient } from '../apiClients/siegeAmmoTypeClient';
import { SiegeWeaponSpotClient } from '../apiClients/siegeWeaponSpotClient';
import { UserSiegeWeaponUnlockClient } from '../apiClients/userSiegeWeaponUnlockClient';
import { TitleBracketClient } from '../apiClients/titleBracketClient';
import { KingdomClient } from '../apiClients/kingdomClient';
import { ProvinceClient } from '../apiClients/provinceClient';
import { CrownLandClient } from '../apiClients/crownLandClient';
import { TerritoryConflictClient } from '../apiClients/territoryConflictClient';
import { StorageClient } from '../apiClients/storageClient';
import { StockTransactionClient } from '../apiClients/stockTransactionClient';
import { WarehouseClient } from '../apiClients/warehouseClient';
import { ProductionStructureClient } from '../apiClients/productionStructureClient';
import { ProductionKindClient } from '../apiClients/productionKindClient';
import { ProductionKindLevelClient } from '../apiClients/productionKindLevelClient';
import { ProductionLineClient } from '../apiClients/productionLineClient';
import { ProductionModifierClient } from '../apiClients/productionModifierClient';
import { ClimateZoneClient } from '../apiClients/climateZoneClient';
import { WeatherTypeClient } from '../apiClients/weatherTypeClient';
import { ProductionCycleRecordClient } from '../apiClients/productionCycleRecordClient';

type EntitySearchFunction<T = any> = (query: PagedQueryDto) => Promise<PagedResultDto<T>>;

// The API contract expects `pageNumber`, while the app-side query object uses `page`.
export function toApiPagedQuery(query: PagedQueryDto): PagedQueryDto {
    return { ...query, pageNumber: query.page } as PagedQueryDto;
}

function normalizePagedResult<T>(result: any, query: PagedQueryDto): PagedResultDto<T> {
    const totalCount = result?.totalCount ?? 0;
    const pageSize = result?.pageSize ?? query.pageSize;

    return {
        items: result?.items ?? [],
        totalCount,
        page: result?.page ?? result?.pageNumber ?? query.page,
        pageSize,
        totalPages: pageSize > 0 ? Math.ceil(totalCount / pageSize) : 0
    };
}

function withPagedQueryMapping<T>(
    search: (query: PagedQueryDto) => Promise<any>
): EntitySearchFunction<T> {
    return async (query) => normalizePagedResult<T>(await search(toApiPagedQuery(query)), query);
}

export function getSearchFunctionForEntity(entityTypeName: string): EntitySearchFunction {
    const normalized = entityTypeName.toLowerCase();
    
    switch (normalized) {
        case 'category':
            return withPagedQueryMapping((query) => CategoryClient.getInstance().searchPaged(query));
        case 'domain':
            return withPagedQueryMapping((query) => DomainClient.getInstance().searchPaged(query));
        case 'grade':
            return withPagedQueryMapping((query) => GradeClient.getInstance().searchPaged(query));
        case 'tag':
            return withPagedQueryMapping((query) => TagClient.getInstance().searchPaged(query));
        case 'landmark':
            return withPagedQueryMapping((query) => LandmarkClient.getInstance().searchPaged(query));
        case 'street':
            return withPagedQueryMapping((query) => StreetClient.getInstance().searchPaged(query));
        case 'town':
            return withPagedQueryMapping((query) => TownClient.getInstance().searchPaged(query));
        case 'district':
            return withPagedQueryMapping((query) => DistrictClient.getInstance().searchPaged(query));
        case 'structure':
            return withPagedQueryMapping((query) => StructureClient.getInstance().searchPaged(query));
        case 'gatestructure':
            return withPagedQueryMapping((query) => GateStructureClient.getInstance().searchPaged(query));
        case 'gatedoor':
            // KNG-273: POST /api/GateDoors/search, the flat door list across all gates.
            return withPagedQueryMapping((query) => GateDoorClient.getInstance().searchPaged(query));
        case 'user':
            return withPagedQueryMapping((query) => UserClient.getInstance().searchPaged(query));
        case 'location':
            return withPagedQueryMapping((query) => LocationClient.getInstance().searchPaged(query));
        case 'itemblueprint':
            return withPagedQueryMapping((query) => ItemBlueprintClient.getInstance().searchPaged(query));
        case 'kit':
            return withPagedQueryMapping((query) => KitClient.getInstance().searchPaged(query));
        case 'enchantmentdefinition':
            return withPagedQueryMapping((query) => EnchantmentDefinitionClient.getInstance().searchPaged(query));
        case 'minecraftblockref':
            return withPagedQueryMapping((query) => MinecraftBlockRefClient.getInstance().searchPaged(query));
        case 'minecraftmaterialref':
            return withPagedQueryMapping((query) => MinecraftMaterialRefClient.getInstance().searchPaged(query));
        case 'minecraftenchantmentref':
            return withPagedQueryMapping((query) => MinecraftEnchantmentRefClient.getInstance().searchPaged(query));
        case 'permissiongroup':
            return withPagedQueryMapping((query) => PermissionGroupClient.getInstance().searchPaged(query));
        case 'permissionholder':
            return withPagedQueryMapping((query) => PermissionHolderClient.getInstance().searchPaged(query));
        // #408: the dashboard's PermissionGrant table. Read-only: no update, create or delete case,
        // grants are written through the by-node routes (player profile, #50's group editor).
        case 'permissiongrant':
            return withPagedQueryMapping((query) => PermissionGrantClient.getInstance().searchPaged(query));
        // Lootboxes (docs/specs/lootboxes/DESIGN.md §3.6). The join entities (grade weights, pool
        // entries, enchant rolls, area types) have no case: they are only edited inside their
        // parent's wizard and travel with it, like KitContent.
        case 'lootboxtype':
            return withPagedQueryMapping((query) => LootboxTypeClient.getInstance().searchPaged(query));
        case 'lootboxspecialentry':
            return withPagedQueryMapping((query) => LootboxSpecialEntryClient.getInstance().searchPaged(query));
        case 'lootboxspawnarea':
            return withPagedQueryMapping((query) => LootboxSpawnAreaClient.getInstance().searchPaged(query));
        case 'bannerdesign':
            return withPagedQueryMapping((query) => BannerDesignClient.getInstance().searchPaged(query));
        // 'bannerlayer' deliberately has no search: layers only exist under their
        // banner (GET /api/BannerDesigns/{id}/layers) and are edited from the banner's own wizard.
        case 'clan':
            return withPagedQueryMapping((query) => ClanClient.getInstance().searchPaged(query));
        case 'siegescenario':
            return withPagedQueryMapping((query) => SiegeScenarioClient.getInstance().searchPaged(query));
        case 'siegeteam':
            return withPagedQueryMapping((query) => SiegeTeamClient.getInstance().searchPaged(query));
        // 'siegespawnpoint' / 'siegeobjective' deliberately have no search: like 'bannerlayer', they
        // only exist under their team/scenario and are edited from the parent's own wizard.
        case 'siegelobby':
            return withPagedQueryMapping((query) => SiegeLobbyClient.getInstance().searchPaged(query));
        // Siege weapons phase 1 (PandiO/knk-workspace#782); 'siegeweaponspot' has no search, like 'siegeobjective'.
        case 'siegeweapontemplate':
            return withPagedQueryMapping((query) => SiegeWeaponTemplateClient.getInstance().searchPaged(query));
        case 'siegeammotype':
            return withPagedQueryMapping((query) => SiegeAmmoTypeClient.getInstance().searchPaged(query));
        case 'usersiegeweaponunlock':
            return withPagedQueryMapping((query) => UserSiegeWeaponUnlockClient.getInstance().searchPaged(query));
        // Territory V1 (PandiO/knk-workspace#690): holders, crown land and the conflicts the game server reports.
        case 'kingdom':
            return withPagedQueryMapping((query) => KingdomClient.getInstance().searchPaged(query));
        case 'province':
            return withPagedQueryMapping((query) => ProvinceClient.getInstance().searchPaged(query));
        case 'crownland':
            return withPagedQueryMapping((query) => CrownLandClient.getInstance().searchPaged(query));
        case 'territoryconflict':
            return withPagedQueryMapping((query) => TerritoryConflictClient.getInstance().searchPaged(query));
        // Stock core P1 (PandiO/knk-workspace#675): storages, and the ledger's transactions (read-only).
        case 'storage':
            return withPagedQueryMapping((query) => StorageClient.getInstance().searchPaged(query));
        case 'stocktransaction':
            return withPagedQueryMapping((query) => StockTransactionClient.getInstance().searchPaged(query));
        // P2 world (PandiO/knk-workspace#676): warehouses and production structures, in a district or rural.
        case 'warehouse':
            return withPagedQueryMapping((query) => WarehouseClient.getInstance().searchPaged(query));
        case 'productionstructure':
            return withPagedQueryMapping((query) => ProductionStructureClient.getInstance().searchPaged(query));
        // Production engine P3 (PandiO/knk-workspace#678): kinds, levels (no create or delete), lines, modifiers, climate
        // zones, weather types and the cycle trace (search and fetch only).
        case 'productionkind':
            return withPagedQueryMapping((query) => ProductionKindClient.getInstance().searchPaged(query));
        case 'productionkindlevel':
            return withPagedQueryMapping((query) => ProductionKindLevelClient.getInstance().searchPaged(query));
        case 'productionline':
            return withPagedQueryMapping((query) => ProductionLineClient.getInstance().searchPaged(query));
        case 'productionmodifier':
            return withPagedQueryMapping((query) => ProductionModifierClient.getInstance().searchPaged(query));
        case 'climatezone':
            return withPagedQueryMapping((query) => ClimateZoneClient.getInstance().searchPaged(query));
        case 'weathertype':
            return withPagedQueryMapping((query) => WeatherTypeClient.getInstance().searchPaged(query));
        case 'productioncyclerecord':
            return withPagedQueryMapping((query) => ProductionCycleRecordClient.getInstance().searchPaged(query));
        // Read-only reference data (seeded): search + fetch only, for TitleBracket object pickers
        // (the siege scenario's minimum title, a domain's warp settings - teleport Phase 5).
        case 'titlebracket':
            return withPagedQueryMapping((query) => TitleBracketClient.getInstance().searchPaged(query));
        default:
            throw new Error(`No search function registered for entity type: ${entityTypeName}`);
    }
}

export function getFetchByIdFunctionForEntity(entityTypeName: string): (id: string) => Promise<any> {
    const normalized = entityTypeName.toLowerCase();
    
    switch (normalized) {
        case 'category':
            return (id) => CategoryClient.getInstance().getById(id);
        case 'domain':
            return (id) => DomainClient.getInstance().getById(id);
        case 'grade':
            return (id) => GradeClient.getInstance().getById(id);
        case 'tag':
            return (id) => TagClient.getInstance().getById(id);
        case 'street':
            return (id) => StreetClient.getInstance().getById(Number(id));
        case 'town':
            return (id) => TownClient.getInstance().getById(Number(id));
        case 'district':
            return (id) => DistrictClient.getInstance().getById(Number(id));
        case 'structure':
            return (id) => StructureClient.getInstance().getById(Number(id));
        case 'gatestructure':
            return (id) => GateStructureClient.getInstance().getById(Number(id), true);
        case 'gatedoor':
            return (id) => GateDoorClient.getInstance().getById(Number(id), true);
        case 'domainsubregion':
            return (id) => DomainSubRegionClient.getInstance().getById(Number(id));
        case 'landmark':
            return (id) => LandmarkClient.getInstance().getById(Number(id));
        case 'location':
            return (id) => LocationClient.getInstance().getById(Number(id));
        case 'itemblueprint':
            return (id) => ItemBlueprintClient.getInstance().getById(id);
        case 'kit':
            return (id) => KitClient.getInstance().getById(id);
        case 'enchantmentdefinition':
            return (id) => EnchantmentDefinitionClient.getInstance().getById(id);
        case 'minecraftblockref':
            return (id) => MinecraftBlockRefClient.getInstance().getById(Number(id));
        case 'minecraftmaterialref':
            return (id) => MinecraftMaterialRefClient.getInstance().getById(Number(id));
        case 'user':
            return (id) => UserClient.getInstance().getById(Number(id));
        case 'permissiongroup':
            return (id) => PermissionGroupClient.getInstance().getById(Number(id));
        case 'permissionholder':
            return (id) => PermissionHolderClient.getInstance().getById(Number(id));
        case 'permissiongrant':
            return (id) => PermissionGrantClient.getInstance().getById(Number(id));
        case 'lootboxtype':
            return (id) => LootboxTypeClient.getInstance().getById(id);
        case 'lootboxspecialentry':
            return (id) => LootboxSpecialEntryClient.getInstance().getById(id);
        case 'lootboxspawnarea':
            return (id) => LootboxSpawnAreaClient.getInstance().getById(id);
        case 'bannerdesign':
            return (id) => BannerDesignClient.getInstance().getById(Number(id));
        case 'bannerlayer':
            return (id) => BannerLayerClient.getInstance().getById(Number(id));
        case 'clan':
            return (id) => ClanClient.getInstance().getById(Number(id));
        case 'siegescenario':
            return (id) => SiegeScenarioClient.getInstance().getById(Number(id));
        case 'siegeteam':
            return (id) => SiegeTeamClient.getInstance().getById(Number(id));
        case 'siegespawnpoint':
            return (id) => SiegeSpawnpointClient.getInstance().getById(Number(id));
        case 'siegeobjective':
            return (id) => SiegeObjectiveClient.getInstance().getById(Number(id));
        case 'siegelobby':
            return (id) => SiegeLobbyClient.getInstance().getById(Number(id));
        case 'siegeweapontemplate':
            return (id) => SiegeWeaponTemplateClient.getInstance().getById(Number(id));
        case 'siegeammotype':
            return (id) => SiegeAmmoTypeClient.getInstance().getById(Number(id));
        case 'siegeweaponspot':
            return (id) => SiegeWeaponSpotClient.getInstance().getById(Number(id));
        case 'usersiegeweaponunlock':
            return (id) => UserSiegeWeaponUnlockClient.getInstance().getById(Number(id));
        case 'kingdom':
            return (id) => KingdomClient.getInstance().getById(Number(id));
        case 'province':
            return (id) => ProvinceClient.getInstance().getById(Number(id));
        case 'crownland':
            return (id) => CrownLandClient.getInstance().getById(Number(id));
        case 'territoryconflict':
            return (id) => TerritoryConflictClient.getInstance().getById(Number(id));
        case 'storage':
            return (id) => StorageClient.getInstance().getById(Number(id));
        case 'stocktransaction':
            return (id) => StockTransactionClient.getInstance().getById(Number(id));
        case 'warehouse':
            return (id) => WarehouseClient.getInstance().getById(Number(id));
        case 'productionstructure':
            return (id) => ProductionStructureClient.getInstance().getById(Number(id));
        // Production engine P3 (PandiO/knk-workspace#678): kinds, levels (no create or delete), lines, modifiers, climate
        // zones, weather types and the cycle trace (search and fetch only).
        case 'productionkind':
            return (id) => ProductionKindClient.getInstance().getById(Number(id));
        case 'productionkindlevel':
            return (id) => ProductionKindLevelClient.getInstance().getById(Number(id));
        case 'productionline':
            return (id) => ProductionLineClient.getInstance().getById(Number(id));
        case 'productionmodifier':
            return (id) => ProductionModifierClient.getInstance().getById(Number(id));
        case 'climatezone':
            return (id) => ClimateZoneClient.getInstance().getById(Number(id));
        case 'weathertype':
            return (id) => WeatherTypeClient.getInstance().getById(Number(id));
        case 'productioncyclerecord':
            return (id) => ProductionCycleRecordClient.getInstance().getById(Number(id));
        case 'titlebracket':
            return (id) => TitleBracketClient.getInstance().getById(Number(id));
        default:
            throw new Error(`No fetchById function registered for entity type: ${entityTypeName}`);
    }
}

export function getUpdateFunctionForEntity(entityTypeName: string): (entity: any) => Promise<any> {
    const normalized = entityTypeName.toLowerCase();
    
    switch (normalized) {
        case 'category':
            return (entity) => CategoryClient.getInstance().update(entity);
        case 'domain':
            return (entity) => DomainClient.getInstance().update(entity);
        case 'grade':
            return (entity) => GradeClient.getInstance().update(entity);
        case 'tag':
            return (entity) => TagClient.getInstance().update(entity);
        case 'street':
            return (entity) => StreetClient.getInstance().update(entity);
        case 'town':
            return (entity) => TownClient.getInstance().update(entity);
        case 'district':
            return (entity) => DistrictClient.getInstance().update(entity);
        case 'structure':
            return (entity) => StructureClient.getInstance().update(entity);
        case 'gatestructure':
            return (entity) => GateStructureClient.getInstance().update(entity);
        case 'gatedoor':
            return (entity) => GateDoorClient.getInstance().update(entity);
        case 'domainsubregion':
            return (entity) => DomainSubRegionClient.getInstance().update(entity);
        case 'landmark':
            return (entity) => LandmarkClient.getInstance().update(entity);
        case 'location':
            return (entity) => LocationClient.getInstance().update(entity);
        case 'itemblueprint':
            return (entity) => ItemBlueprintClient.getInstance().update(entity);
        case 'kit':
            return (entity) => KitClient.getInstance().update(entity);
        case 'enchantmentdefinition':
            return (entity) => EnchantmentDefinitionClient.getInstance().update(entity);
        case 'minecraftblockref':
            return (entity) => MinecraftBlockRefClient.getInstance().update(entity);
        case 'minecraftmaterialref':
            return (entity) => MinecraftMaterialRefClient.getInstance().update(entity);
        case 'minecraftenchantmentref':
            return (entity) => MinecraftEnchantmentRefClient.getInstance().update(entity);
        case 'user':
            return (entity) => UserClient.getInstance().update(entity);
        case 'permissiongroup':
            return (entity) => PermissionGroupClient.getInstance().update(entity);
        case 'lootboxtype':
            return (entity) => LootboxTypeClient.getInstance().update(entity);
        case 'lootboxspecialentry':
            return (entity) => LootboxSpecialEntryClient.getInstance().update(entity);
        case 'lootboxspawnarea':
            return (entity) => LootboxSpawnAreaClient.getInstance().update(entity);
        case 'bannerdesign':
            return (entity) => BannerDesignClient.getInstance().update(entity);
        case 'bannerlayer':
            return (entity) => BannerLayerClient.getInstance().update(entity);
        case 'clan':
            return (entity) => ClanClient.getInstance().update(entity);
        case 'siegescenario':
            return (entity) => SiegeScenarioClient.getInstance().update(entity);
        case 'siegeteam':
            return (entity) => SiegeTeamClient.getInstance().update(entity);
        case 'siegespawnpoint':
            return (entity) => SiegeSpawnpointClient.getInstance().update(entity);
        case 'siegeobjective':
            return (entity) => SiegeObjectiveClient.getInstance().update(entity);
        case 'siegelobby':
            return (entity) => SiegeLobbyClient.getInstance().update(entity);
        case 'siegeweapontemplate':
            return (entity) => SiegeWeaponTemplateClient.getInstance().update(entity);
        case 'siegeammotype':
            return (entity) => SiegeAmmoTypeClient.getInstance().update(entity);
        case 'siegeweaponspot':
            return (entity) => SiegeWeaponSpotClient.getInstance().update(entity);
        case 'usersiegeweaponunlock':
            return (entity) => UserSiegeWeaponUnlockClient.getInstance().update(entity);
        // Territory V1 (PandiO/knk-workspace#690); a conflict has no update (it is resolved on its page).
        case 'kingdom':
            return (entity) => KingdomClient.getInstance().update(entity);
        case 'province':
            return (entity) => ProvinceClient.getInstance().update(entity);
        case 'crownland':
            return (entity) => CrownLandClient.getInstance().update(entity);
        // Stock core P1 (PandiO/knk-workspace#675); ledger transactions are append-only (no update).
        case 'storage':
            return (entity) => StorageClient.getInstance().update(entity);
        // P2 world (PandiO/knk-workspace#676)
        case 'warehouse':
            return (entity) => WarehouseClient.getInstance().update(entity);
        case 'productionstructure':
            return (entity) => ProductionStructureClient.getInstance().update(entity);
        // Production engine P3 (PandiO/knk-workspace#678): kinds, levels (no create or delete), lines, modifiers, climate
        // zones, weather types and the cycle trace (search and fetch only).
        case 'productionkind':
            return (entity) => ProductionKindClient.getInstance().update(entity);
        case 'productionkindlevel':
            return (entity) => ProductionKindLevelClient.getInstance().update(entity);
        case 'productionline':
            return (entity) => ProductionLineClient.getInstance().update(entity);
        case 'productionmodifier':
            return (entity) => ProductionModifierClient.getInstance().update(entity);
        case 'climatezone':
            return (entity) => ClimateZoneClient.getInstance().update(entity);
        case 'weathertype':
            return (entity) => WeatherTypeClient.getInstance().update(entity);
        default:
            throw new Error(`No update function registered for entity type: ${entityTypeName}`);
    }
}

export function getDeleteFunctionForEntity(entityTypeName: string): (id: string | number) => Promise<any> {
    const normalized = entityTypeName.toLowerCase();

    switch (normalized) {
        case 'category':
            return (id) => CategoryClient.getInstance().delete(id as string);
        case 'domain':
            return (id) => DomainClient.getInstance().delete(id as string);
        case 'grade':
            return (id) => GradeClient.getInstance().delete(id as string);
        case 'tag':
            return (id) => TagClient.getInstance().delete(id as string);
        case 'street':
            return (id) => StreetClient.getInstance().delete(Number(id));
        case 'town':
            return (id) => TownClient.getInstance().delete(Number(id));
        case 'district':
            return (id) => DistrictClient.getInstance().delete(Number(id));
        case 'structure':
            return (id) => StructureClient.getInstance().delete(Number(id));
        case 'gatestructure':
            return (id) => GateStructureClient.getInstance().delete(Number(id));
        case 'gatedoor':
            return (id) => GateDoorClient.getInstance().delete(Number(id));
        case 'domainsubregion':
            return (id) => DomainSubRegionClient.getInstance().delete(Number(id));
        case 'landmark':
            return (id) => LandmarkClient.getInstance().delete(Number(id));
        case 'location':
            return (id) => LocationClient.getInstance().delete(Number(id));
        case 'itemblueprint':
            return (id) => ItemBlueprintClient.getInstance().delete(id as string);
        case 'kit':
            return (id) => KitClient.getInstance().delete(id as string);
        case 'enchantmentdefinition':
            return (id) => EnchantmentDefinitionClient.getInstance().delete(id as string);
        case 'minecraftblockref':
            return (id) => MinecraftBlockRefClient.getInstance().delete(Number(id));
        case 'minecraftmaterialref':
            return (id) => MinecraftMaterialRefClient.getInstance().delete(Number(id));
        case 'user':
            return (id) => UserClient.getInstance().delete(Number(id));
        case 'permissiongroup':
            return (id) => PermissionGroupClient.getInstance().delete(Number(id));
        case 'lootboxtype':
            return (id) => LootboxTypeClient.getInstance().delete(id);
        case 'lootboxspecialentry':
            return (id) => LootboxSpecialEntryClient.getInstance().delete(id);
        case 'lootboxspawnarea':
            return (id) => LootboxSpawnAreaClient.getInstance().delete(id);
        case 'bannerdesign':
            return (id) => BannerDesignClient.getInstance().delete(Number(id));
        case 'bannerlayer':
            return (id) => BannerLayerClient.getInstance().delete(Number(id));
        case 'clan':
            return (id) => ClanClient.getInstance().delete(Number(id));
        case 'siegescenario':
            return (id) => SiegeScenarioClient.getInstance().delete(Number(id));
        case 'siegeteam':
            return (id) => SiegeTeamClient.getInstance().delete(Number(id));
        case 'siegespawnpoint':
            return (id) => SiegeSpawnpointClient.getInstance().delete(Number(id));
        case 'siegeobjective':
            return (id) => SiegeObjectiveClient.getInstance().delete(Number(id));
        case 'siegelobby':
            return (id) => SiegeLobbyClient.getInstance().delete(Number(id));
        case 'siegeweapontemplate':
            return (id) => SiegeWeaponTemplateClient.getInstance().delete(Number(id));
        case 'siegeammotype':
            return (id) => SiegeAmmoTypeClient.getInstance().delete(Number(id));
        case 'siegeweaponspot':
            return (id) => SiegeWeaponSpotClient.getInstance().delete(Number(id));
        case 'usersiegeweaponunlock':
            return (id) => UserSiegeWeaponUnlockClient.getInstance().delete(Number(id));
        case 'kingdom':
            return (id) => KingdomClient.getInstance().delete(Number(id));
        case 'province':
            return (id) => ProvinceClient.getInstance().delete(Number(id));
        case 'crownland':
            return (id) => CrownLandClient.getInstance().delete(Number(id));
        case 'territoryconflict':
            return (id) => TerritoryConflictClient.getInstance().delete(Number(id));
        case 'storage':
            return (id) => StorageClient.getInstance().delete(Number(id));
        case 'warehouse':
            return (id) => WarehouseClient.getInstance().delete(Number(id));
        case 'productionstructure':
            return (id) => ProductionStructureClient.getInstance().delete(Number(id));
        // Production engine P3 (PandiO/knk-workspace#678): kinds, levels (no create or delete), lines, modifiers, climate
        // zones, weather types and the cycle trace (search and fetch only).
        case 'productionkind':
            return (id) => ProductionKindClient.getInstance().delete(Number(id));
        case 'productionline':
            return (id) => ProductionLineClient.getInstance().delete(Number(id));
        case 'productionmodifier':
            return (id) => ProductionModifierClient.getInstance().delete(Number(id));
        case 'climatezone':
            return (id) => ClimateZoneClient.getInstance().delete(Number(id));
        case 'weathertype':
            return (id) => WeatherTypeClient.getInstance().delete(Number(id));
        default:
            throw new Error(`No delete function registered for entity type: ${entityTypeName}`);
    }
}

export function getCreateFunctionForEntity(entityTypeName: string): (entity: any) => Promise<any> {
    const normalized = entityTypeName.toLowerCase();

    switch (normalized) {
        case 'category':
            return (entity) => CategoryClient.getInstance().create(entity);
        case 'domain':
            return (entity) => DomainClient.getInstance().create(entity);
        case 'grade':
            return (entity) => GradeClient.getInstance().create(entity);
        case 'tag':
            return (entity) => TagClient.getInstance().create(entity);
        case 'street':
            return (entity) => StreetClient.getInstance().create(entity);
        case 'town':
            return (entity) => TownClient.getInstance().create(entity);
        case 'district':
            return (entity) => DistrictClient.getInstance().create(entity);
        case 'structure':
            return (entity) => StructureClient.getInstance().create(entity);
        case 'gatestructure':
            return (entity) => GateStructureClient.getInstance().create(entity);
        case 'gatedoor':
            return (entity) => GateDoorClient.getInstance().create(entity);
        case 'domainsubregion':
            return (entity) => DomainSubRegionClient.getInstance().create(entity);
        case 'landmark':
            return (entity) => LandmarkClient.getInstance().create(entity);
        case 'location':
            return (entity) => LocationClient.getInstance().create(entity);
        case 'itemblueprint':
            return (entity) => ItemBlueprintClient.getInstance().create(entity);
        case 'kit':
            return (entity) => KitClient.getInstance().create(entity);
        case 'enchantmentdefinition':
            return (entity) => EnchantmentDefinitionClient.getInstance().create(entity);
        case 'minecraftblockref':
            return (entity) => MinecraftBlockRefClient.getInstance().create(entity);
        case 'minecraftmaterialref':
            return (entity) => MinecraftMaterialRefClient.getInstance().create(entity);
        case 'minecraftenchantmentref':
            return (entity) => MinecraftEnchantmentRefClient.getInstance().create(entity);
        case 'user':
            return (entity) => UserClient.getInstance().create(entity);
        case 'permissiongroup':
            return (entity) => PermissionGroupClient.getInstance().create(entity);
        case 'lootboxtype':
            return (entity) => LootboxTypeClient.getInstance().create(entity);
        case 'lootboxspecialentry':
            return (entity) => LootboxSpecialEntryClient.getInstance().create(entity);
        case 'lootboxspawnarea':
            return (entity) => LootboxSpawnAreaClient.getInstance().create(entity);
        case 'bannerdesign':
            return (entity) => BannerDesignClient.getInstance().create(entity);
        case 'bannerlayer':
            return (entity) => BannerLayerClient.getInstance().create(entity);
        case 'clan':
            return (entity) => ClanClient.getInstance().create(entity);
        case 'siegescenario':
            return (entity) => SiegeScenarioClient.getInstance().create(entity);
        case 'siegeteam':
            return (entity) => SiegeTeamClient.getInstance().create(entity);
        case 'siegespawnpoint':
            return (entity) => SiegeSpawnpointClient.getInstance().create(entity);
        case 'siegeobjective':
            return (entity) => SiegeObjectiveClient.getInstance().create(entity);
        case 'siegelobby':
            return (entity) => SiegeLobbyClient.getInstance().create(entity);
        case 'siegeweapontemplate':
            return (entity) => SiegeWeaponTemplateClient.getInstance().create(entity);
        case 'siegeammotype':
            return (entity) => SiegeAmmoTypeClient.getInstance().create(entity);
        case 'siegeweaponspot':
            return (entity) => SiegeWeaponSpotClient.getInstance().create(entity);
        case 'usersiegeweaponunlock':
            return (entity) => UserSiegeWeaponUnlockClient.getInstance().create(entity);
        // Territory V1 (PandiO/knk-workspace#690); conflicts are created by the game server's report only.
        case 'kingdom':
            return (entity) => KingdomClient.getInstance().create(entity);
        case 'province':
            return (entity) => ProvinceClient.getInstance().create(entity);
        case 'crownland':
            return (entity) => CrownLandClient.getInstance().create(entity);
        // Stock core P1 (PandiO/knk-workspace#675); transactions are written by moves and adjustments only.
        case 'storage':
            return (entity) => StorageClient.getInstance().create(entity);
        // P2 world (PandiO/knk-workspace#676): the answer carries `placementWarnings` (shown after the save).
        case 'warehouse':
            return (entity) => WarehouseClient.getInstance().create(entity);
        case 'productionstructure':
            return (entity) => ProductionStructureClient.getInstance().create(entity);
        // Production engine P3 (PandiO/knk-workspace#678): kinds, levels (no create or delete), lines, modifiers, climate
        // zones, weather types and the cycle trace (search and fetch only).
        case 'productionkind':
            return (entity) => ProductionKindClient.getInstance().create(entity);
        case 'productionline':
            return (entity) => ProductionLineClient.getInstance().create(entity);
        case 'productionmodifier':
            return (entity) => ProductionModifierClient.getInstance().create(entity);
        case 'climatezone':
            return (entity) => ClimateZoneClient.getInstance().create(entity);
        case 'weathertype':
            return (entity) => WeatherTypeClient.getInstance().create(entity);
        default:
            throw new Error(`No create function registered for entity type: ${entityTypeName}`);
    }
}

/** True when the app can create this entity type (a create client is registered above). */
export function hasCreateFunctionForEntity(entityTypeName: string): boolean {
    try {
        getCreateFunctionForEntity(entityTypeName);
        return true;
    } catch {
        return false;
    }
}
