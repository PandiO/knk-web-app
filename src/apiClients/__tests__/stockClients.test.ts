import { StorageClient } from '../storageClient';
import { StockTransactionClient } from '../stockTransactionClient';
import { Controllers, HttpMethod } from '../../utils';
import {
    getCreateFunctionForEntity,
    getDeleteFunctionForEntity,
    getFetchByIdFunctionForEntity,
    getSearchFunctionForEntity,
    getUpdateFunctionForEntity,
} from '../../utils/entityApiMapping';

/**
 * Stock core P1 (PandiO/knk-workspace#675): storages are registered for the dashboard and the form wizard; ledger
 * transactions are listed and fetched only (append-only); the ledger client reaches every read and write endpoint of
 * api/StockTransactions.
 */
describe('stock clients', () => {
    const spies: jest.SpyInstance[] = [];
    const spyOn = (client: object, value: unknown = { items: [], totalCount: 0 }) => {
        const spy = jest.spyOn(client as any, 'invokeServiceCall').mockResolvedValue(value);
        spies.push(spy);
        return spy;
    };

    afterEach(() => {
        spies.splice(0).forEach(s => s.mockRestore());
    });

    it('Storage: search, fetch, create, update and delete go to api/Storages', async () => {
        const spy = spyOn(StorageClient.getInstance());

        await getSearchFunctionForEntity('Storage')({ page: 2, pageSize: 10 } as any);
        expect(spy).toHaveBeenLastCalledWith(expect.objectContaining({ pageNumber: 2, pageSize: 10 }), 'search', Controllers.Storages, HttpMethod.Post);

        await getFetchByIdFunctionForEntity('Storage')('12');
        expect(spy).toHaveBeenLastCalledWith(null, '12', Controllers.Storages, HttpMethod.Get);

        await getCreateFunctionForEntity('Storage')({ name: 'S1', kind: 'Domain', domainId: 4 });
        expect(spy).toHaveBeenLastCalledWith({ name: 'S1', kind: 'Domain', domainId: 4 }, '', Controllers.Storages, HttpMethod.Post);

        await getUpdateFunctionForEntity('Storage')({ id: 12, name: 'S1', rowVersion: 3 });
        expect(spy).toHaveBeenLastCalledWith({ id: 12, name: 'S1', rowVersion: 3 }, '12', Controllers.Storages, HttpMethod.Put);

        await getDeleteFunctionForEntity('Storage')('12');
        expect(spy).toHaveBeenLastCalledWith(null, '12', Controllers.Storages, HttpMethod.Delete);
    });

    it('StockTransaction: listed and fetched, never created, updated or deleted', async () => {
        const spy = spyOn(StockTransactionClient.getInstance());

        await getSearchFunctionForEntity('StockTransaction')({ page: 1, pageSize: 10 } as any);
        expect(spy).toHaveBeenLastCalledWith(expect.objectContaining({ pageNumber: 1 }), 'search', Controllers.StockTransactions, HttpMethod.Post);

        await getFetchByIdFunctionForEntity('StockTransaction')('40');
        expect(spy).toHaveBeenLastCalledWith(null, '40', Controllers.StockTransactions, HttpMethod.Get);

        expect(() => getCreateFunctionForEntity('StockTransaction')).toThrow();
        expect(() => getUpdateFunctionForEntity('StockTransaction')).toThrow();
        expect(() => getDeleteFunctionForEntity('StockTransaction')).toThrow();
    });

    it('the ledger client calls each endpoint of api/StockTransactions', async () => {
        const client = StockTransactionClient.getInstance();
        const spy = spyOn(client, { status: 'Applied', replayed: false, accepted: 1, lines: [] });
        const query = { pageNumber: 1, pageSize: 50, filters: { storageId: '12', itemBlueprintId: '3' } };

        await client.searchTransactions(query);
        expect(spy).toHaveBeenLastCalledWith(query, 'search', Controllers.StockTransactions, HttpMethod.Post);
        await client.searchMoves(query);
        expect(spy).toHaveBeenLastCalledWith(query, 'moves/search', Controllers.StockTransactions, HttpMethod.Post);
        await client.searchRollups(query);
        expect(spy).toHaveBeenLastCalledWith(query, 'rollups/search', Controllers.StockTransactions, HttpMethod.Post);
        await client.reconcile();
        expect(spy).toHaveBeenLastCalledWith(null, 'reconcile', Controllers.StockTransactions, HttpMethod.Get);

        const move = { reason: 'Distribution' as const, mode: 'Partial' as const, lines: [{ fromStorageId: 12, toStorageId: 13, itemBlueprintId: 3, amount: 30 }] };
        await client.move(move);
        expect(spy).toHaveBeenLastCalledWith(move, '', Controllers.StockTransactions, HttpMethod.Post);
        const adjust = { storageId: 12, itemBlueprintId: 3, delta: 64, note: 'smoke' };
        await client.adjust(adjust);
        expect(spy).toHaveBeenLastCalledWith(adjust, 'adjust', Controllers.StockTransactions, HttpMethod.Post);
        await client.reverse(40, { note: 'undo', idempotencyKey: 'k' });
        expect(spy).toHaveBeenLastCalledWith({ note: 'undo', idempotencyKey: 'k' }, '40/reverse', Controllers.StockTransactions, HttpMethod.Post);
        await client.rollUp();
        expect(spy).toHaveBeenLastCalledWith(null, 'rollup', Controllers.StockTransactions, HttpMethod.Post);
    });
});
