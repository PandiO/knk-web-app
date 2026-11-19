import { ProductionKindClient } from '../productionKindClient';
import { ProductionKindLevelClient } from '../productionKindLevelClient';
import { ProductionLineClient } from '../productionLineClient';
import { ProductionModifierClient } from '../productionModifierClient';
import { ClimateZoneClient } from '../climateZoneClient';
import { WeatherTypeClient } from '../weatherTypeClient';
import { ProductionCycleRecordClient } from '../productionCycleRecordClient';
import { ProductionStructureClient } from '../productionStructureClient';
import { ProductionClient } from '../productionClient';
import { Controllers, HttpMethod } from '../../utils';
import {
    getCreateFunctionForEntity,
    getDeleteFunctionForEntity,
    getFetchByIdFunctionForEntity,
    getSearchFunctionForEntity,
    getUpdateFunctionForEntity,
    hasCreateFunctionForEntity,
} from '../../utils/entityApiMapping';

/**
 * Production engine P3 (PandiO/knk-workspace#678): the catalogue, lines, modifiers and weather are registered for the
 * dashboard, the detail page and the form wizard; levels have no create or delete, the cycle trace is read only; the
 * production view, workers, upgrade, settle, rolls and run-now reach their endpoints.
 */
describe('production engine clients', () => {
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
        ['ProductionKind', ProductionKindClient.getInstance(), Controllers.ProductionKinds],
        ['ProductionLine', ProductionLineClient.getInstance(), Controllers.ProductionLines],
        ['ProductionModifier', ProductionModifierClient.getInstance(), Controllers.ProductionModifiers],
        ['ClimateZone', ClimateZoneClient.getInstance(), Controllers.ClimateZones],
        ['WeatherType', WeatherTypeClient.getInstance(), Controllers.WeatherTypes],
    ])('%s: search, fetch, create, update and delete go to its endpoint', async (type, client, controller) => {
        const spy = spyOn(client);

        await getSearchFunctionForEntity(type)({ page: 2, pageSize: 10 } as any);
        expect(spy).toHaveBeenLastCalledWith(expect.objectContaining({ pageNumber: 2, pageSize: 10 }), 'search', controller, HttpMethod.Post);

        await getFetchByIdFunctionForEntity(type)('7');
        expect(spy).toHaveBeenLastCalledWith(null, '7', controller, HttpMethod.Get);

        await getCreateFunctionForEntity(type)({ Name: 'X' });
        expect(spy).toHaveBeenLastCalledWith({ Name: 'X' }, '', controller, HttpMethod.Post);

        await getUpdateFunctionForEntity(type)({ id: 7, Name: 'X' });
        expect(spy).toHaveBeenLastCalledWith({ id: 7, Name: 'X' }, '7', controller, HttpMethod.Put);

        await getDeleteFunctionForEntity(type)('7');
        expect(spy).toHaveBeenLastCalledWith(null, '7', controller, HttpMethod.Delete);
    });

    it('levels are searched, read and updated, never created or deleted', async () => {
        const spy = spyOn(ProductionKindLevelClient.getInstance());
        await getUpdateFunctionForEntity('ProductionKindLevel')({ id: 3, yieldMultiplier: 1.2 });
        expect(spy).toHaveBeenLastCalledWith({ id: 3, yieldMultiplier: 1.2 }, '3', Controllers.ProductionKindLevels, HttpMethod.Put);
        expect(hasCreateFunctionForEntity('ProductionKindLevel')).toBe(false);
        expect(() => getDeleteFunctionForEntity('ProductionKindLevel')).toThrow();
    });

    it('the cycle trace is searched and read only', async () => {
        const spy = spyOn(ProductionCycleRecordClient.getInstance());
        await ProductionCycleRecordClient.getInstance().search({ pageNumber: 1, pageSize: 20, filters: { productionLineId: '5' } });
        expect(spy).toHaveBeenLastCalledWith({ pageNumber: 1, pageSize: 20, filters: { productionLineId: '5' } },
            'search', Controllers.ProductionCycleRecords, HttpMethod.Post);
        await getFetchByIdFunctionForEntity('ProductionCycleRecord')('9');
        expect(spy).toHaveBeenLastCalledWith(null, '9', Controllers.ProductionCycleRecords, HttpMethod.Get);
        expect(hasCreateFunctionForEntity('ProductionCycleRecord')).toBe(false);
    });

    it('the production view, workers and upgrade go to the structure', async () => {
        const client = ProductionStructureClient.getInstance();
        const spy = spyOn(client);
        await client.getProduction(21);
        expect(spy).toHaveBeenLastCalledWith(null, '21/production', Controllers.ProductionStructures, HttpMethod.Get);
        await client.setWorkers(21, { workersPresent: 1 });
        expect(spy).toHaveBeenLastCalledWith({ workersPresent: 1 }, '21/workers', Controllers.ProductionStructures, HttpMethod.Put);
        await client.upgrade(21, { payerUserId: 9, payFromStorageId: null });
        expect(spy).toHaveBeenLastCalledWith({ payerUserId: 9, payFromStorageId: null }, '21/upgrade', Controllers.ProductionStructures, HttpMethod.Post);
    });

    it('settle, the roll history and run-now reach their endpoints', async () => {
        const lines = spyOn(ProductionLineClient.getInstance());
        await ProductionLineClient.getInstance().settle(5);
        expect(lines).toHaveBeenLastCalledWith(null, '5/settle', Controllers.ProductionLines, HttpMethod.Post);

        const zones = spyOn(ClimateZoneClient.getInstance());
        await ClimateZoneClient.getInstance().searchRolls({ pageNumber: 1, pageSize: 30, filters: { climateZoneId: '1' } });
        expect(zones).toHaveBeenLastCalledWith({ pageNumber: 1, pageSize: 30, filters: { climateZoneId: '1' } },
            'rolls/search', Controllers.ClimateZones, HttpMethod.Post);

        const production = spyOn(ProductionClient.getInstance());
        await ProductionClient.getInstance().runNow();
        expect(production).toHaveBeenLastCalledWith(null, 'run-now', Controllers.Production, HttpMethod.Post);
    });
});
