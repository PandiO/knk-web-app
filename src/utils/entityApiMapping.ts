import { CategoryClient } from '../apiClients/categoryClient';
import { StructureClient } from '../apiClients/structureClient';
import { StreetClient } from '../apiClients/streetClient';
import { TownClient } from '../apiClients/townClient';
import { DistrictClient } from '../apiClients/districtClient';
import { MinecraftBlockRefClient } from '../apiClients/minecraftBlockRefClient';
import { MinecraftMaterialRefClient } from '../apiClients/minecraftMaterialRefClient';
import { ItemBlueprintClient } from '../apiClients/itemBlueprintClient';
import { EnchantmentDefinitionClient } from '../apiClients/enchantmentDefinitionClient';
import { GateStructureClient } from '../apiClients/gateStructureClient';
import { PagedQueryDto, PagedResultDto } from './domain/dto/common/PagedQuery';
import { LocationClient } from '../apiClients/locationClient';
import { MinecraftEnchantmentRefClient } from '../apiClients/minecraftEnchantmentRefClient';

type EntitySearchFunction<T = any> = (query: PagedQueryDto) => Promise<PagedResultDto<T>>;

export function getSearchFunctionForEntity(entityTypeName: string): EntitySearchFunction {
    const normalized = entityTypeName.toLowerCase();
    
    switch (normalized) {
        case 'category':
            return (query) => CategoryClient.getInstance().searchPaged(query);
        case 'street':
            return (query) => StreetClient.getInstance().searchPaged(query);
        case 'town':
            return (query) => TownClient.getInstance().searchPaged(query);
        case 'district':
            return (query) => DistrictClient.getInstance().searchPaged(query);
        case 'structure':
            return (query) => StructureClient.getInstance().searchPaged(query);
        case 'gatestructure':
            return (query) => GateStructureClient.getInstance().searchPaged(query);
        case 'user':
            return () => Promise.reject(new Error('User search not implemented'));
        case 'location':
            return (query) => LocationClient.getInstance().searchPaged(query);
        case 'itemblueprint':
            return (query) => ItemBlueprintClient.getInstance().searchPaged(query);
        case 'enchantmentdefinition':
            return (query) => EnchantmentDefinitionClient.getInstance().searchPaged(query);
        case 'minecraftblockref':
            return (query) => MinecraftBlockRefClient.getInstance().searchPaged(query);
        case 'minecraftmaterialref':
            return (query) => MinecraftMaterialRefClient.getInstance().searchPaged(query);
        case 'minecraftenchantmentref':
            return (query) => MinecraftEnchantmentRefClient.getInstance().searchPaged(query);
        default:
            throw new Error(`No search function registered for entity type: ${entityTypeName}`);
    }
}

export function getFetchByIdFunctionForEntity(entityTypeName: string): (id: string) => Promise<any> {
    const normalized = entityTypeName.toLowerCase();
    
    switch (normalized) {
        case 'category':
            return (id) => CategoryClient.getInstance().getById(id);
        case 'street':
            return (id) => StreetClient.getInstance().getById(Number(id));
        case 'town':
            return (id) => TownClient.getInstance().getById(Number(id));
        case 'district':
            return (id) => DistrictClient.getInstance().getById(Number(id));
        case 'structure':
            return (id) => StructureClient.getInstance().getById(Number(id));
        case 'gatestructure':
            return (id) => GateStructureClient.getInstance().getById(Number(id));
        case 'location':
            return (id) => LocationClient.getInstance().getById(Number(id));
        case 'itemblueprint':
            return (id) => ItemBlueprintClient.getInstance().getById(id);
        case 'enchantmentdefinition':
            return (id) => EnchantmentDefinitionClient.getInstance().getById(id);
        case 'minecraftblockref':
            return (id) => MinecraftBlockRefClient.getInstance().getById(Number(id));
        case 'minecraftmaterialref':
            return (id) => MinecraftMaterialRefClient.getInstance().getById(Number(id));
        case 'user':
            return () => Promise.reject(new Error('User fetchById not implemented'));
        default:
            throw new Error(`No fetchById function registered for entity type: ${entityTypeName}`);
    }
}

export function getUpdateFunctionForEntity(entityTypeName: string): (entity: any) => Promise<any> {
    const normalized = entityTypeName.toLowerCase();
    
    switch (normalized) {
        case 'category':
            return (entity) => CategoryClient.getInstance().update(entity);
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
        case 'location':
            return (entity) => LocationClient.getInstance().update(entity);
        case 'itemblueprint':
            return (entity) => ItemBlueprintClient.getInstance().update(entity);
        case 'enchantmentdefinition':
            return (entity) => EnchantmentDefinitionClient.getInstance().update(entity);
        case 'minecraftblockref':
            return (entity) => MinecraftBlockRefClient.getInstance().update(entity);
        case 'minecraftmaterialref':
            return (entity) => MinecraftMaterialRefClient.getInstance().update(entity);
        case 'minecraftenchantmentref':
            return (entity) => MinecraftEnchantmentRefClient.getInstance().update(entity);
        case 'user':
            return () => Promise.reject(new Error('User update not implemented'));
        default:
            throw new Error(`No update function registered for entity type: ${entityTypeName}`);
    }
}

export function getDeleteFunctionForEntity(entityTypeName: string): (id: string | number) => Promise<any> {
    const normalized = entityTypeName.toLowerCase();

    switch (normalized) {
        case 'category':
            return (id) => CategoryClient.getInstance().delete(id as string);
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
        case 'location':
            return (id) => LocationClient.getInstance().delete(Number(id));
        case 'itemblueprint':
            return (id) => ItemBlueprintClient.getInstance().delete(id as string);
        case 'enchantmentdefinition':
            return (id) => EnchantmentDefinitionClient.getInstance().delete(id as string);
        case 'minecraftblockref':
            return (id) => MinecraftBlockRefClient.getInstance().delete(Number(id));
        case 'minecraftmaterialref':
            return (id) => MinecraftMaterialRefClient.getInstance().delete(Number(id));
        case 'user':
            return () => Promise.reject(new Error('User delete not implemented'));
        default:
            throw new Error(`No delete function registered for entity type: ${entityTypeName}`);
    }
}

export function getCreateFunctionForEntity(entityTypeName: string): (entity: any) => Promise<any> {
    const normalized = entityTypeName.toLowerCase();

    switch (normalized) {
        case 'category':
            return (entity) => CategoryClient.getInstance().create(entity);
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
        case 'location':
            return (entity) => LocationClient.getInstance().create(entity);
        case 'itemblueprint':
            return (entity) => ItemBlueprintClient.getInstance().create(entity);
        case 'enchantmentdefinition':
            return (entity) => EnchantmentDefinitionClient.getInstance().create(entity);
        case 'minecraftblockref':
            return (entity) => MinecraftBlockRefClient.getInstance().create(entity);
        case 'minecraftmaterialref':
            return (entity) => MinecraftMaterialRefClient.getInstance().create(entity);
        case 'minecraftenchantmentref':
            return (entity) => MinecraftEnchantmentRefClient.getInstance().create(entity);
        case 'user':
            return () => Promise.reject(new Error('User create not implemented'));
        default:
            throw new Error(`No create function registered for entity type: ${entityTypeName}`);
    }
}