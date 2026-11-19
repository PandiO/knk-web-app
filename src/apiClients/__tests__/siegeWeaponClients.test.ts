import { SiegeWeaponTemplateClient } from '../siegeWeaponTemplateClient';
import { SiegeAmmoTypeClient } from '../siegeAmmoTypeClient';
import { SiegeWeaponSpotClient } from '../siegeWeaponSpotClient';
import { UserSiegeWeaponUnlockClient } from '../userSiegeWeaponUnlockClient';
import { Controllers, HttpMethod } from '../../utils';
import {
    getCreateFunctionForEntity,
    getDeleteFunctionForEntity,
    getFetchByIdFunctionForEntity,
    getSearchFunctionForEntity,
    getUpdateFunctionForEntity,
} from '../../utils/entityApiMapping';
import { SiegeWeaponSpotDto } from '../../types/dtos/siege/SiegeWeaponDtos';

/**
 * Siege weapons phase 1 (PandiO/knk-workspace#782, acceptance A01): the four clients call the API's routes and are
 * registered for the dashboard and the form wizard, so templates, ammo types, spots and unlocks can be listed, created,
 * edited and deleted. A weapon spot is created under its scenario, like an objective.
 */
describe('siege weapon clients', () => {
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
        ['SiegeWeaponTemplate', SiegeWeaponTemplateClient.getInstance(), Controllers.SiegeWeaponTemplates],
        ['SiegeAmmoType', SiegeAmmoTypeClient.getInstance(), Controllers.SiegeAmmoTypes],
        ['UserSiegeWeaponUnlock', UserSiegeWeaponUnlockClient.getInstance(), Controllers.UserSiegeWeaponUnlocks],
    ])('%s: search, fetch, create, update and delete go to its own controller', async (type, client, controller) => {
        const spy = spyOn(client);

        await getSearchFunctionForEntity(type)({ page: 1, pageSize: 10 } as any);
        expect(spy).toHaveBeenLastCalledWith(expect.objectContaining({ pageNumber: 1, pageSize: 10 }), 'search', controller, HttpMethod.Post);

        await getFetchByIdFunctionForEntity(type)('7');
        expect(spy).toHaveBeenLastCalledWith(null, '7', controller, HttpMethod.Get);

        await getCreateFunctionForEntity(type)({ name: 'Trebuchet' });
        expect(spy).toHaveBeenLastCalledWith({ name: 'Trebuchet' }, '', controller, HttpMethod.Post);

        await getUpdateFunctionForEntity(type)({ id: 7, name: 'Trebuchet' });
        expect(spy).toHaveBeenLastCalledWith({ id: 7, name: 'Trebuchet' }, '7', controller, HttpMethod.Put);

        await getDeleteFunctionForEntity(type)(7);
        expect(spy).toHaveBeenLastCalledWith(null, '7', controller, HttpMethod.Delete);
    });

    it('a weapon spot is created under its scenario, from the wizard\'s PascalCase field names too', async () => {
        const spy = spyOn(SiegeWeaponSpotClient.getInstance());

        const spot: SiegeWeaponSpotDto = { siegeScenarioId: 100, siegeTeamId: 202, name: 'North wall', facing: 'East', sizeClass: 'Large' };
        await getCreateFunctionForEntity('SiegeWeaponSpot')(spot);
        expect(spy).toHaveBeenLastCalledWith(spot, '100/weapon-spots', Controllers.SiegeScenarios, HttpMethod.Post);

        const fromWizard = { SiegeScenarioId: 100, SiegeTeamId: 202, Name: 'North wall' };
        await getCreateFunctionForEntity('SiegeWeaponSpot')(fromWizard);
        expect(spy).toHaveBeenLastCalledWith(fromWizard, '100/weapon-spots', Controllers.SiegeScenarios, HttpMethod.Post);
    });

    it('a weapon spot is otherwise addressed by its own id', async () => {
        const spy = spyOn(SiegeWeaponSpotClient.getInstance());

        await getFetchByIdFunctionForEntity('SiegeWeaponSpot')('31');
        expect(spy).toHaveBeenLastCalledWith(null, '31', Controllers.SiegeWeaponSpots, HttpMethod.Get);
        await getUpdateFunctionForEntity('SiegeWeaponSpot')({ id: 31, name: 'Tower' });
        expect(spy).toHaveBeenLastCalledWith({ id: 31, name: 'Tower' }, '31', Controllers.SiegeWeaponSpots, HttpMethod.Put);
        await getDeleteFunctionForEntity('SiegeWeaponSpot')(31);
        expect(spy).toHaveBeenLastCalledWith(null, '31', Controllers.SiegeWeaponSpots, HttpMethod.Delete);
        await SiegeWeaponSpotClient.getInstance().getByScenario(100);
        expect(spy).toHaveBeenLastCalledWith(null, '100/weapon-spots', Controllers.SiegeScenarios, HttpMethod.Get);
    });

    it("lists one player's unlocks", async () => {
        const spy = spyOn(UserSiegeWeaponUnlockClient.getInstance());
        await UserSiegeWeaponUnlockClient.getInstance().getByUser(900);
        expect(spy).toHaveBeenLastCalledWith(null, 'by-user/900', Controllers.UserSiegeWeaponUnlocks, HttpMethod.Get);
    });
});
