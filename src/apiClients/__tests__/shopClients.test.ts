import { ShopTypeClient } from '../shopTypeClient';
import { ShopTypeLevelClient } from '../shopTypeLevelClient';
import { ShopClient } from '../shopClient';
import { ShopCatalogueEntryClient } from '../shopCatalogueEntryClient';
import { ShopTradeStatClient } from '../shopTradeStatClient';
import { TownAccountClient } from '../townAccountClient';
import { Controllers, HttpMethod } from '../../utils';
import {
    getCreateFunctionForEntity,
    getDeleteFunctionForEntity,
    getFetchByIdFunctionForEntity,
    getSearchFunctionForEntity,
    getUpdateFunctionForEntity,
} from '../../utils/entityApiMapping';

/**
 * Shops P10c (PandiO/knk-workspace#688): the dashboard registry reaches every shop endpoint with full CRUD for the
 * types, levels, shops and catalogue entries and reads only for trade stats and town accounts; the offer, rebuild,
 * by-town and ledger calls reach their routes.
 */
describe('shop clients', () => {
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
        ['ShopType', ShopTypeClient.getInstance(), Controllers.ShopTypes],
        ['ShopTypeLevel', ShopTypeLevelClient.getInstance(), Controllers.ShopTypeLevels],
        ['Shop', ShopClient.getInstance(), Controllers.Shops],
        ['ShopCatalogueEntry', ShopCatalogueEntryClient.getInstance(), Controllers.ShopCatalogueEntries],
    ])('%s: search, fetch, create, update and delete go to its endpoint', async (type, client, controller) => {
        const spy = spyOn(client);
        await getSearchFunctionForEntity(type)({ page: 1, pageSize: 10 } as any);
        expect(spy).toHaveBeenLastCalledWith(expect.objectContaining({ pageNumber: 1, pageSize: 10 }), 'search', controller, HttpMethod.Post);
        await getFetchByIdFunctionForEntity(type)('3');
        expect(spy).toHaveBeenLastCalledWith(null, '3', controller, HttpMethod.Get);
        await getCreateFunctionForEntity(type)({ name: 'Bakery' });
        expect(spy).toHaveBeenLastCalledWith({ name: 'Bakery' }, '', controller, HttpMethod.Post);
        await getUpdateFunctionForEntity(type)({ id: 3, name: 'Bakery' });
        expect(spy).toHaveBeenLastCalledWith({ id: 3, name: 'Bakery' }, '3', controller, HttpMethod.Put);
        await getDeleteFunctionForEntity(type)(3);
        expect(spy).toHaveBeenLastCalledWith(null, '3', controller, HttpMethod.Delete);
    });

    it.each([
        ['ShopTradeStat', ShopTradeStatClient.getInstance(), Controllers.ShopTradeStats],
        ['TownAccount', TownAccountClient.getInstance(), Controllers.TownAccounts],
    ])('%s: search and fetch only', async (type, client, controller) => {
        const spy = spyOn(client);
        await getSearchFunctionForEntity(type)({ page: 1, pageSize: 10 } as any);
        expect(spy).toHaveBeenLastCalledWith(expect.objectContaining({ pageNumber: 1 }), 'search', controller, HttpMethod.Post);
        await getFetchByIdFunctionForEntity(type)('8');
        expect(spy).toHaveBeenLastCalledWith(null, '8', controller, HttpMethod.Get);
        expect(() => getCreateFunctionForEntity(type)).toThrow();
        expect(() => getUpdateFunctionForEntity(type)).toThrow();
        expect(() => getDeleteFunctionForEntity(type)).toThrow();
    });

    it('the offer, the stats rebuild, a town\'s account and its ledger reach their routes', async () => {
        const shop = spyOn(ShopClient.getInstance());
        await ShopClient.getInstance().getOffer(31);
        expect(shop).toHaveBeenLastCalledWith(null, '31/offer', Controllers.Shops, HttpMethod.Get);

        const stats = spyOn(ShopTradeStatClient.getInstance());
        const range = { shopId: 31, from: '2026-11-20T13:00:00.000Z', to: '2026-11-21T13:00:00.000Z' };
        await ShopTradeStatClient.getInstance().rebuild(range);
        expect(stats).toHaveBeenLastCalledWith(range, 'rebuild', Controllers.ShopTradeStats, HttpMethod.Post);

        const accounts = spyOn(TownAccountClient.getInstance());
        await TownAccountClient.getInstance().getByTown(4);
        expect(accounts).toHaveBeenLastCalledWith(null, 'by-town/4', Controllers.TownAccounts, HttpMethod.Get);
        await TownAccountClient.getInstance().ledger(8, 2, 25);
        expect(accounts).toHaveBeenLastCalledWith(null, '8/ledger?pageNumber=2&pageSize=25', Controllers.TownAccounts, HttpMethod.Get);
    });
});
