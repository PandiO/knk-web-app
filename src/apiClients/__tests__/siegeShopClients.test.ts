import { SiegeShopCategoryClient } from '../siegeShopCategoryClient';
import { SiegeShopEntryClient } from '../siegeShopEntryClient';
import { SiegeScenarioShopOverrideClient } from '../siegeScenarioShopOverrideClient';
import { SiegeShopClient } from '../siegeShopClient';
import { Controllers, HttpMethod } from '../../utils';
import {
    getCreateFunctionForEntity,
    getDeleteFunctionForEntity,
    getFetchByIdFunctionForEntity,
    getSearchFunctionForEntity,
    getUpdateFunctionForEntity,
} from '../../utils/entityApiMapping';
import { SiegeScenarioShopOverrideDto } from '../../types/dtos/siege/SiegeShopDtos';

/**
 * Siege shop catalogue (PandiO/knk-workspace#867, acceptance A13): the clients call the API's routes and are
 * registered for the dashboard and the form wizard, so categories, entries and a scenario's overrides can be listed,
 * created, edited and deleted. An override is created under its scenario, like a weapon spot.
 */
describe('siege shop clients', () => {
    const spies: jest.SpyInstance[] = [];
    const spyOn = (client: object) => {
        const spy = jest.spyOn(client as any, 'invokeServiceCall').mockResolvedValue({ items: [], totalCount: 0 });
        spies.push(spy);
        return spy;
    };

    afterEach(() => {
        spies.splice(0).forEach(s => s.mockRestore());
    });

    it.each([
        ['SiegeShopCategory', SiegeShopCategoryClient.getInstance(), Controllers.SiegeShopCategories],
        ['SiegeShopEntry', SiegeShopEntryClient.getInstance(), Controllers.SiegeShopEntries],
    ])('%s: search, fetch, create, update and delete go to its own controller', async (type, client, controller) => {
        const spy = spyOn(client);

        await getSearchFunctionForEntity(type)({ page: 1, pageSize: 10 } as any);
        expect(spy).toHaveBeenLastCalledWith(expect.objectContaining({ pageNumber: 1, pageSize: 10 }), 'search', controller, HttpMethod.Post);

        await getFetchByIdFunctionForEntity(type)('7');
        expect(spy).toHaveBeenLastCalledWith(null, '7', controller, HttpMethod.Get);

        await getCreateFunctionForEntity(type)({ name: 'Consumables' });
        expect(spy).toHaveBeenLastCalledWith({ name: 'Consumables' }, '', controller, HttpMethod.Post);

        await getUpdateFunctionForEntity(type)({ id: 7, name: 'Consumables' });
        expect(spy).toHaveBeenLastCalledWith({ id: 7, name: 'Consumables' }, '7', controller, HttpMethod.Put);

        await getDeleteFunctionForEntity(type)(7);
        expect(spy).toHaveBeenLastCalledWith(null, '7', controller, HttpMethod.Delete);
    });

    it("an override is created under its scenario, from the wizard's PascalCase field names too", async () => {
        const spy = spyOn(SiegeScenarioShopOverrideClient.getInstance());

        const shopOverride: SiegeScenarioShopOverrideDto = { siegeScenarioId: 100, siegeShopEntryId: 5, hidden: true };
        await getCreateFunctionForEntity('SiegeScenarioShopOverride')(shopOverride);
        expect(spy).toHaveBeenLastCalledWith(shopOverride, '100/shop-overrides', Controllers.SiegeScenarios, HttpMethod.Post);

        const fromWizard = { SiegeScenarioId: 100, SiegeShopEntryId: 5, Price: 500 };
        await getCreateFunctionForEntity('SiegeScenarioShopOverride')(fromWizard);
        expect(spy).toHaveBeenLastCalledWith(fromWizard, '100/shop-overrides', Controllers.SiegeScenarios, HttpMethod.Post);
    });

    it('an override is otherwise addressed by its own id and has no search', async () => {
        const spy = spyOn(SiegeScenarioShopOverrideClient.getInstance());

        await getFetchByIdFunctionForEntity('SiegeScenarioShopOverride')('31');
        expect(spy).toHaveBeenLastCalledWith(null, '31', Controllers.SiegeScenarioShopOverrides, HttpMethod.Get);
        await getUpdateFunctionForEntity('SiegeScenarioShopOverride')({ id: 31, hidden: false });
        expect(spy).toHaveBeenLastCalledWith({ id: 31, hidden: false }, '31', Controllers.SiegeScenarioShopOverrides, HttpMethod.Put);
        await getDeleteFunctionForEntity('SiegeScenarioShopOverride')(31);
        expect(spy).toHaveBeenLastCalledWith(null, '31', Controllers.SiegeScenarioShopOverrides, HttpMethod.Delete);
        await SiegeScenarioShopOverrideClient.getInstance().getByScenario(100);
        expect(spy).toHaveBeenLastCalledWith(null, '100/shop-overrides', Controllers.SiegeScenarios, HttpMethod.Get);
    });

    it('asks for the effective catalogue of a mode, with or without a scenario', async () => {
        const spy = spyOn(SiegeShopClient.getInstance());
        await SiegeShopClient.getInstance().getCatalogue('Siege', 100);
        expect(spy).toHaveBeenLastCalledWith(null, 'catalogue?mode=Siege&scenarioId=100', Controllers.SiegeShop, HttpMethod.Get);
        await SiegeShopClient.getInstance().getCatalogue('SiegeSurvival');
        expect(spy).toHaveBeenLastCalledWith(null, 'catalogue?mode=SiegeSurvival', Controllers.SiegeShop, HttpMethod.Get);
    });
});
