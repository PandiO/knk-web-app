import { TransportOrderClient } from '../transportOrderClient';
import { TransportLaneClient } from '../transportLaneClient';
import { ProductionStructureClient } from '../productionStructureClient';
import { Controllers, HttpMethod } from '../../utils';
import {
    getCreateFunctionForEntity,
    getDeleteFunctionForEntity,
    getFetchByIdFunctionForEntity,
    getSearchFunctionForEntity,
    getUpdateFunctionForEntity,
    hasCreateFunctionForEntity,
} from '../../utils/entityApiMapping';
import type { TransportOrderCreateDto } from '../../types/dtos/production/TransportDtos';

/**
 * Transport core P5 (PandiO/knk-workspace#682): lanes are registered for the dashboard, detail page and form wizard;
 * orders are search and fetch only (made on the manual order page); the order actions and the structure's transport
 * view reach their endpoints.
 */
describe('transport clients', () => {
    const spies: jest.SpyInstance[] = [];
    const spyOn = (client: object, value: unknown = { items: [], totalCount: 0 }) => {
        const spy = jest.spyOn(client as any, 'invokeServiceCall').mockResolvedValue(value);
        spies.push(spy);
        return spy;
    };

    afterEach(() => {
        spies.splice(0).forEach(s => s.mockRestore());
    });

    it('TransportLane: search, fetch, create, update and delete go to its endpoint', async () => {
        const spy = spyOn(TransportLaneClient.getInstance());
        const controller = Controllers.TransportLanes;

        await getSearchFunctionForEntity('TransportLane')({ page: 2, pageSize: 10 } as any);
        expect(spy).toHaveBeenLastCalledWith(expect.objectContaining({ pageNumber: 2, pageSize: 10 }), 'search', controller, HttpMethod.Post);
        await getFetchByIdFunctionForEntity('TransportLane')('7');
        expect(spy).toHaveBeenLastCalledWith(null, '7', controller, HttpMethod.Get);
        await getCreateFunctionForEntity('TransportLane')({ fromStructureId: 1, toStructureId: 2 });
        expect(spy).toHaveBeenLastCalledWith({ fromStructureId: 1, toStructureId: 2 }, '', controller, HttpMethod.Post);
        await getUpdateFunctionForEntity('TransportLane')({ id: 7, roadDistance: 10 });
        expect(spy).toHaveBeenLastCalledWith({ id: 7, roadDistance: 10 }, '7', controller, HttpMethod.Put);
        await getDeleteFunctionForEntity('TransportLane')(7);
        expect(spy).toHaveBeenLastCalledWith(null, '7', controller, HttpMethod.Delete);
    });

    it('TransportOrder: search and fetch only; no create, edit or delete through the generic registry', async () => {
        const spy = spyOn(TransportOrderClient.getInstance());

        await getSearchFunctionForEntity('TransportOrder')({ page: 1, pageSize: 10 } as any);
        expect(spy).toHaveBeenLastCalledWith(expect.objectContaining({ pageNumber: 1 }), 'search', Controllers.TransportOrders, HttpMethod.Post);
        await getFetchByIdFunctionForEntity('TransportOrder')('9');
        expect(spy).toHaveBeenLastCalledWith(null, '9', Controllers.TransportOrders, HttpMethod.Get);
        expect(hasCreateFunctionForEntity('TransportOrder')).toBe(false);
        expect(() => getUpdateFunctionForEntity('TransportOrder')).toThrow();
        expect(() => getDeleteFunctionForEntity('TransportOrder')).toThrow();
    });

    it('sends the manual order, its dry run, cancel and run-now to their endpoints', async () => {
        const client = TransportOrderClient.getInstance();
        const spy = spyOn(client, {});
        const body: TransportOrderCreateDto = { sourceStorageId: 3, stops: [{ storageId: 4, lines: [{ itemBlueprintId: 5, amount: 10 }] }] };

        await client.dryRun(body);
        expect(spy).toHaveBeenLastCalledWith(body, 'dry-run', Controllers.TransportOrders, HttpMethod.Post);
        await client.create(body);
        expect(spy).toHaveBeenLastCalledWith(body, '', Controllers.TransportOrders, HttpMethod.Post);
        await client.cancel(9, { reason: 'Wrong stop' });
        expect(spy).toHaveBeenLastCalledWith({ reason: 'Wrong stop' }, '9/cancel', Controllers.TransportOrders, HttpMethod.Post);
        await client.runNow();
        expect(spy).toHaveBeenLastCalledWith(null, 'run-now', Controllers.TransportOrders, HttpMethod.Post);
    });

    it('reads a structure\'s transport view', async () => {
        const client = ProductionStructureClient.getInstance();
        const spy = spyOn(client, {});
        await client.getTransport(821);
        expect(spy).toHaveBeenLastCalledWith(null, '821/transport', Controllers.ProductionStructures, HttpMethod.Get);
    });
});
