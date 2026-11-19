import { KingdomClient } from '../kingdomClient';
import { ProvinceClient } from '../provinceClient';
import { CrownLandClient } from '../crownLandClient';
import { TerritoryConflictClient } from '../territoryConflictClient';
import { TerritoryClient } from '../territoryClient';
import { Controllers, HttpMethod } from '../../utils';
import {
    getCreateFunctionForEntity,
    getDeleteFunctionForEntity,
    getFetchByIdFunctionForEntity,
    getSearchFunctionForEntity,
    getUpdateFunctionForEntity,
} from '../../utils/entityApiMapping';

/**
 * Territory V1 (PandiO/knk-workspace#690): the holder clients are registered for the dashboard and the form wizard; a
 * conflict is listed, fetched and deleted but has no create or update (it is resolved on its page); the territory
 * client reads a town's ranges and saves only the territory fields.
 */
describe('territory clients', () => {
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
        ['Kingdom', KingdomClient.getInstance(), Controllers.Kingdoms],
        ['Province', ProvinceClient.getInstance(), Controllers.Provinces],
        ['CrownLand', CrownLandClient.getInstance(), Controllers.CrownLands],
    ])('%s: search, fetch, create, update and delete go to its own controller', async (type, client, controller) => {
        const spy = spyOn(client);

        await getSearchFunctionForEntity(type)({ page: 1, pageSize: 10 } as any);
        expect(spy).toHaveBeenLastCalledWith(expect.objectContaining({ pageNumber: 1, pageSize: 10 }), 'search', controller, HttpMethod.Post);

        await getFetchByIdFunctionForEntity(type)('7');
        expect(spy).toHaveBeenLastCalledWith(null, '7', controller, HttpMethod.Get);

        await getCreateFunctionForEntity(type)({ name: 'Aurelia' });
        expect(spy).toHaveBeenLastCalledWith({ name: 'Aurelia' }, '', controller, HttpMethod.Post);

        await getUpdateFunctionForEntity(type)({ id: 7, name: 'Aurelia' });
        expect(spy).toHaveBeenLastCalledWith({ id: 7, name: 'Aurelia' }, '7', controller, HttpMethod.Put);

        await getDeleteFunctionForEntity(type)('7');
        expect(spy).toHaveBeenLastCalledWith(null, '7', controller, HttpMethod.Delete);
    });

    it('a conflict is searched, fetched, resolved, reopened and deleted, never created or edited', async () => {
        const client = TerritoryConflictClient.getInstance();
        const spy = spyOn(client);

        await getSearchFunctionForEntity('TerritoryConflict')({ page: 1, pageSize: 10 } as any);
        expect(spy).toHaveBeenLastCalledWith(expect.anything(), 'search', Controllers.TerritoryConflicts, HttpMethod.Post);
        await getFetchByIdFunctionForEntity('TerritoryConflict')('3');
        expect(spy).toHaveBeenLastCalledWith(null, '3', Controllers.TerritoryConflicts, HttpMethod.Get);
        await getDeleteFunctionForEntity('TerritoryConflict')('3');
        expect(spy).toHaveBeenLastCalledWith(null, '3', Controllers.TerritoryConflicts, HttpMethod.Delete);

        await client.resolve(3, { resolution: 'Awarded', awardedHolder: { kind: 'Town', id: 4 } });
        expect(spy).toHaveBeenLastCalledWith({ resolution: 'Awarded', awardedHolder: { kind: 'Town', id: 4 } }, '3/resolve', Controllers.TerritoryConflicts, HttpMethod.Post);
        await client.reopen(3);
        expect(spy).toHaveBeenLastCalledWith(null, '3/reopen', Controllers.TerritoryConflicts, HttpMethod.Post);

        expect(() => getCreateFunctionForEntity('TerritoryConflict')).toThrow(/No create function/);
        expect(() => getUpdateFunctionForEntity('TerritoryConflict')).toThrow(/No update function/);
    });

    it('reads a town\'s ranges and a structure\'s territory, and sets loyalty', async () => {
        const client = TerritoryClient.getInstance();
        const spy = spyOn(client, {});

        await client.getTown(4);
        expect(spy).toHaveBeenLastCalledWith(null, 'towns/4', Controllers.Territory, HttpMethod.Get);
        await client.getStructure(12);
        expect(spy).toHaveBeenLastCalledWith(null, 'structures/12', Controllers.Territory, HttpMethod.Get);
        await client.setLoyalty(12, { loyaltyTownId: 5 });
        expect(spy).toHaveBeenLastCalledWith({ loyaltyTownId: 5 }, 'structures/12/loyalty', Controllers.Territory, HttpMethod.Put);
        await client.clearFlag(12);
        expect(spy).toHaveBeenLastCalledWith(null, 'structures/12/flag', Controllers.Territory, HttpMethod.Delete);
    });

    it('saves a town\'s territory by reading the town and putting it back with only those fields', async () => {
        const client = TerritoryClient.getInstance();
        const spy = spyOn(client, { id: 4, name: 'Phoenix', wgRegionId: 'domain_4', teleportEnabled: true });

        await client.saveTownTerritory(4, { power: 50, kingdomId: 1, provinceId: null });

        expect(spy).toHaveBeenNthCalledWith(1, null, '4', Controllers.Towns, HttpMethod.Get);
        expect(spy).toHaveBeenNthCalledWith(2, expect.objectContaining({
            id: 4, name: 'Phoenix', wgRegionId: 'domain_4', teleportEnabled: null, power: 50, kingdomId: 1, provinceId: null,
        }), '4', Controllers.Towns, HttpMethod.Put);
    });

    it('marks a district as capital the same way', async () => {
        const client = TerritoryClient.getInstance();
        const spy = spyOn(client, { id: 7, name: 'Old Town', townId: 4, wgRegionId: 'domain_7' });

        await client.setDistrictCapital(7, true);

        expect(spy).toHaveBeenNthCalledWith(1, null, '7', Controllers.Districts, HttpMethod.Get);
        expect(spy).toHaveBeenNthCalledWith(2, expect.objectContaining({ id: 7, townId: 4, isCapital: true, streetIds: null }), '7', Controllers.Districts, HttpMethod.Put);
    });
});
