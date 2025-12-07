import { CategoryClient } from '../apiClients/categoryClient';
import { StructuresManager } from '../apiClients/structures';
import { TownsManager } from '../apiClients/towns';
import { StreetManager } from '../apiClients/streets';
import { PagedQueryDto, PagedResultDto } from './domain/dto/common/PagedQuery';
import { LocationClient } from '../apiClients/locationClient';

type EntitySearchFunction<T = any> = (query: PagedQueryDto) => Promise<PagedResultDto<T>>;

export function getSearchFunctionForEntity(entityTypeName: string): EntitySearchFunction {
    const normalized = entityTypeName.toLowerCase();
    
    switch (normalized) {
        case 'category':
            return (query) => CategoryClient.getInstance().searchPaged(query);
        case 'user':
            return () => Promise.reject(new Error('User search not implemented'));
        case 'location':
            return (query) => LocationClient.getInstance().searchPaged(query);
        // case 'structure':
        //     return (query) => StructuresManager.getInstance().searchPaged(query);
        // case 'town':
        //     return (query) => TownsManager.getInstance().searchPaged(query);
        // case 'street':
        //     return (query) => StreetManager.getInstance().searchPaged(query);
        default:
            throw new Error(`No search function registered for entity type: ${entityTypeName}`);
    }
}

export function getFetchByIdFunctionForEntity(entityTypeName: string): (id: string) => Promise<any> {
    const normalized = entityTypeName.toLowerCase();
    
    switch (normalized) {
        case 'category':
            return (id) => CategoryClient.getInstance().getById(id);
        case 'location':
            return (id) => LocationClient.getInstance().getById(Number(id));
        case 'user':
            return () => Promise.reject(new Error('User fetchById not implemented'));
        // case 'town':
        //     return (id) => TownsManager.getInstance().getById(Number(id));
        // case 'street':
        //     return (id) => StreetManager.getInstance().getById(Number(id));
        // case 'structure':
        default:
            throw new Error(`No fetchById function registered for entity type: ${entityTypeName}`);
    }
}