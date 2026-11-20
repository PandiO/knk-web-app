import { ProductionAreaClient } from '../productionAreaClient';
import { AreaSurveyClient } from '../areaSurveyClient';
import { ProductionYieldOverrideClient } from '../productionYieldOverrideClient';
import { ProductionStructureClient } from '../productionStructureClient';
import { ProductionKindClient } from '../productionKindClient';
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
 * Yield areas P4 (PandiO/knk-workspace#680): areas and Hybrid overrides are registered for the dashboard, detail page
 * and form wizard; surveys are search and fetch only; the structure's yield, Survey now and Make lines again, the
 * overlaps and the trend reach their endpoints; the kind's yield table is sent as a child list.
 */
describe('yield area clients', () => {
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
        ['ProductionArea', ProductionAreaClient.getInstance(), Controllers.ProductionAreas],
        ['ProductionYieldOverride', ProductionYieldOverrideClient.getInstance(), Controllers.ProductionYieldOverrides],
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

    it('surveys are searched and read only, with the trend per area', async () => {
        const client = AreaSurveyClient.getInstance();
        const spy = spyOn(client);
        await getSearchFunctionForEntity('AreaSurvey')({ page: 1, pageSize: 20 } as any);
        expect(spy).toHaveBeenLastCalledWith(expect.objectContaining({ pageNumber: 1 }), 'search', Controllers.AreaSurveys, HttpMethod.Post);
        await getFetchByIdFunctionForEntity('AreaSurvey')('9');
        expect(spy).toHaveBeenLastCalledWith(null, '9', Controllers.AreaSurveys, HttpMethod.Get);
        await client.getTrend(4);
        expect(spy).toHaveBeenLastCalledWith(null, 'trend?productionAreaId=4&take=30', Controllers.AreaSurveys, HttpMethod.Get);
        expect(hasCreateFunctionForEntity('AreaSurvey')).toBe(false);
        expect(() => getUpdateFunctionForEntity('AreaSurvey')).toThrow();
        expect(() => getDeleteFunctionForEntity('AreaSurvey')).toThrow();
    });

    it('the overlaps of an area', async () => {
        const client = ProductionAreaClient.getInstance();
        const spy = spyOn(client, []);
        await client.getOverlaps(4);
        expect(spy).toHaveBeenLastCalledWith(null, '4/overlaps', Controllers.ProductionAreas, HttpMethod.Get);
    });

    it('the yield, Survey now and Make lines again go to the structure', async () => {
        const client = ProductionStructureClient.getInstance();
        const spy = spyOn(client, []);
        await client.getYield(21);
        expect(spy).toHaveBeenLastCalledWith(null, '21/yield', Controllers.ProductionStructures, HttpMethod.Get);
        await client.requestSurvey(21);
        expect(spy).toHaveBeenLastCalledWith({}, '21/survey', Controllers.ProductionStructures, HttpMethod.Post);
        await client.requestSurvey(21, { productionAreaId: 4 });
        expect(spy).toHaveBeenLastCalledWith({ productionAreaId: 4 }, '21/survey', Controllers.ProductionStructures, HttpMethod.Post);
        await client.materialize(21);
        expect(spy).toHaveBeenLastCalledWith(null, '21/materialize', Controllers.ProductionStructures, HttpMethod.Post);
    });

    it('the kind update carries the yield table and primary outputs', async () => {
        const client = ProductionKindClient.getInstance();
        const spy = spyOn(client);
        const body = { id: 3, yieldTable: [{ unitKey: 'BLOCK:COAL_ORE', itemBlueprintId: 6, ratePerUnitPerHour: 0.01 }], primaryOutputs: [{ itemBlueprintId: 6 }] };
        await client.update(body);
        expect(spy).toHaveBeenLastCalledWith(body, '3', Controllers.ProductionKinds, HttpMethod.Put);
    });
});
