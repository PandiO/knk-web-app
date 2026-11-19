import { WarehouseClient } from '../warehouseClient';
import { ProductionStructureClient } from '../productionStructureClient';
import { StorageClient } from '../storageClient';
import { Controllers, HttpMethod } from '../../utils';
import {
    getCreateFunctionForEntity,
    getDeleteFunctionForEntity,
    getFetchByIdFunctionForEntity,
    getSearchFunctionForEntity,
    getUpdateFunctionForEntity,
} from '../../utils/entityApiMapping';

/**
 * P2 world (PandiO/knk-workspace#676): warehouses and production structures are registered for the dashboard, the detail
 * page and the form wizard (all five operations); the road connection and a structure's storages reach their endpoints.
 */
describe('P2 world clients', () => {
    const spies: jest.SpyInstance[] = [];
    const spyOn = (client: object, value: unknown = { items: [], totalCount: 0 }) => {
        const spy = jest.spyOn(client as any, 'invokeServiceCall').mockResolvedValue(value);
        spies.push(spy);
        return spy;
    };

    afterEach(() => {
        spies.splice(0).forEach(s => s.mockRestore());
    });

    it.each([
        ['Warehouse', WarehouseClient.getInstance(), Controllers.Warehouses],
        ['ProductionStructure', ProductionStructureClient.getInstance(), Controllers.ProductionStructures],
    ])('%s: search, fetch, create, update and delete go to its endpoint', async (type, client, controller) => {
        const spy = spyOn(client);

        await getSearchFunctionForEntity(type)({ page: 2, pageSize: 10, filters: { territoryFlag: 'Contested' } } as any);
        expect(spy).toHaveBeenLastCalledWith(expect.objectContaining({ pageNumber: 2, pageSize: 10, filters: { territoryFlag: 'Contested' } }),
            'search', controller, HttpMethod.Post);

        await getFetchByIdFunctionForEntity(type)('21');
        expect(spy).toHaveBeenLastCalledWith(null, '21', controller, HttpMethod.Get);

        await getCreateFunctionForEntity(type)({ Name: 'Quarry', TownId: 4 });
        expect(spy).toHaveBeenLastCalledWith({ Name: 'Quarry', TownId: 4 }, '', controller, HttpMethod.Post);

        await getUpdateFunctionForEntity(type)({ id: 21, Name: 'Quarry', TownId: 4 });
        expect(spy).toHaveBeenLastCalledWith({ id: 21, Name: 'Quarry', TownId: 4 }, '21', controller, HttpMethod.Put);

        await getDeleteFunctionForEntity(type)('21');
        expect(spy).toHaveBeenLastCalledWith(null, '21', controller, HttpMethod.Delete);
    });

    it('sets the road connection through PUT api/ProductionStructures/{id}/road-connection', async () => {
        const spy = spyOn(ProductionStructureClient.getInstance());
        await ProductionStructureClient.getInstance().setRoadConnection(21, { roadConnection: 'Unconnected' });
        expect(spy).toHaveBeenLastCalledWith({ roadConnection: 'Unconnected' }, '21/road-connection', Controllers.ProductionStructures, HttpMethod.Put);
    });

    it("searches a structure's storages with the API's own paging", async () => {
        const spy = spyOn(StorageClient.getInstance());
        await StorageClient.getInstance().searchStorages({ pageNumber: 1, pageSize: 50, filters: { domainId: '21' } });
        expect(spy).toHaveBeenLastCalledWith({ pageNumber: 1, pageSize: 50, filters: { domainId: '21' } }, 'search', Controllers.Storages, HttpMethod.Post);
    });
});
