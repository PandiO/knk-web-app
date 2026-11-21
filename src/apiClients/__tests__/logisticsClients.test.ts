import { LogisticsPolicyClient } from '../logisticsPolicyClient';
import { LogisticsRuleClient } from '../logisticsRuleClient';
import { ConsumerReplenishmentClient } from '../consumerReplenishmentClient';
import { LogisticsReservationClient } from '../logisticsReservationClient';
import { LogisticsPlannerRunClient } from '../logisticsPlannerRunClient';
import { LogisticsClient } from '../logisticsClient';
import { Controllers, HttpMethod } from '../../utils';
import {
    getCreateFunctionForEntity,
    getDeleteFunctionForEntity,
    getFetchByIdFunctionForEntity,
    getSearchFunctionForEntity,
    getUpdateFunctionForEntity,
} from '../../utils/entityApiMapping';

/**
 * Town logistics P9b (PandiO/knk-workspace#686): the dashboard registry reaches every logistics endpoint; a policy's
 * form edit keeps its rules; the planner, views and actions reach their endpoints.
 */
describe('logistics clients', () => {
    const spies: jest.SpyInstance[] = [];
    const spyOn = (client: object, value: unknown = { items: [], totalCount: 0 }) => {
        const spy = jest.spyOn(client as any, 'invokeServiceCall').mockResolvedValue(value);
        spies.push(spy);
        return spy;
    };

    afterEach(() => {
        spies.splice(0).forEach(s => s.mockRestore());
    });

    it('ConsumerReplenishment: search, fetch, create, update and delete go to its endpoint', async () => {
        const spy = spyOn(ConsumerReplenishmentClient.getInstance());
        const controller = Controllers.ConsumerReplenishments;
        await getSearchFunctionForEntity('ConsumerReplenishment')({ page: 1, pageSize: 10 } as any);
        expect(spy).toHaveBeenLastCalledWith(expect.objectContaining({ pageNumber: 1, pageSize: 10 }), 'search', controller, HttpMethod.Post);
        await getFetchByIdFunctionForEntity('ConsumerReplenishment')('3');
        expect(spy).toHaveBeenLastCalledWith(null, '3', controller, HttpMethod.Get);
        await getCreateFunctionForEntity('ConsumerReplenishment')({ storageId: 91, itemBlueprintId: 6 });
        expect(spy).toHaveBeenLastCalledWith({ storageId: 91, itemBlueprintId: 6 }, '', controller, HttpMethod.Post);
        await getUpdateFunctionForEntity('ConsumerReplenishment')({ id: 3, targetLevel: 60 });
        expect(spy).toHaveBeenLastCalledWith({ id: 3, targetLevel: 60 }, '3', controller, HttpMethod.Put);
        await getDeleteFunctionForEntity('ConsumerReplenishment')(3);
        expect(spy).toHaveBeenLastCalledWith(null, '3', controller, HttpMethod.Delete);
    });

    it('LogisticsPolicy: a form edit is a new version that keeps the current rules', async () => {
        const client = LogisticsPolicyClient.getInstance();
        const current = {
            id: 40, name: 'Phoenix logistics', scope: 'Town', townId: 4, version: 1, lineageId: 40, isCurrent: true, createdAt: '2026-11-21T10:00:00Z',
            reason: 'First', rules: [{ id: 1, sequence: 1, type: 'Reserve', scope: 'Town', targetKind: 'Blueprint', itemBlueprintId: 6, units: 70, summary: 'Keep 70' }],
        };
        const spy = spyOn(client);
        spy.mockResolvedValueOnce(current).mockResolvedValueOnce({ ...current, id: 41, version: 2 });
        await getUpdateFunctionForEntity('LogisticsPolicy')({ id: 40, name: 'Phoenix supply', reason: 'First' });
        expect(spy).toHaveBeenNthCalledWith(1, null, '40', Controllers.LogisticsPolicies, HttpMethod.Get);
        expect(spy).toHaveBeenNthCalledWith(2, {
            name: 'Phoenix supply', reason: 'Edited in the form.',
            rules: [{ sequence: 1, type: 'Reserve', scope: 'Town', targetKind: 'Blueprint', itemBlueprintId: 6, units: 70, activeFrom: null, activeUntil: null, reason: null }],
        }, '40', Controllers.LogisticsPolicies, HttpMethod.Put);

        await getCreateFunctionForEntity('LogisticsPolicy')({ name: 'New', scope: 'Template' });
        expect(spy).toHaveBeenLastCalledWith({ name: 'New', scope: 'Template' }, '', Controllers.LogisticsPolicies, HttpMethod.Post);
        await getDeleteFunctionForEntity('LogisticsPolicy')(40);
        expect(spy).toHaveBeenLastCalledWith(null, '40', Controllers.LogisticsPolicies, HttpMethod.Delete);
        await client.versions(40);
        expect(spy).toHaveBeenLastCalledWith(null, '40/versions', Controllers.LogisticsPolicies, HttpMethod.Get);
        await client.applyTemplate(50, { townId: 4, reason: null });
        expect(spy).toHaveBeenLastCalledWith({ townId: 4, reason: null }, '50/apply', Controllers.LogisticsPolicies, HttpMethod.Post);
    });

    it('rules, reservations and runs are read only on the dashboard; a reservation can be released', async () => {
        for (const [type, client, controller] of [
            ['LogisticsRule', LogisticsRuleClient.getInstance(), Controllers.LogisticsRules],
            ['LogisticsReservation', LogisticsReservationClient.getInstance(), Controllers.LogisticsReservations],
            ['LogisticsPlannerRun', LogisticsPlannerRunClient.getInstance(), Controllers.LogisticsPlannerRuns],
        ] as const) {
            const spy = spyOn(client);
            await getSearchFunctionForEntity(type)({ page: 1, pageSize: 5 } as any);
            expect(spy).toHaveBeenLastCalledWith(expect.objectContaining({ pageNumber: 1 }), 'search', controller, HttpMethod.Post);
            await getFetchByIdFunctionForEntity(type)('2');
            expect(spy).toHaveBeenLastCalledWith(null, '2', controller, HttpMethod.Get);
            expect(() => getUpdateFunctionForEntity(type)).toThrow();
            expect(() => getDeleteFunctionForEntity(type)).toThrow();
        }
        const spy = spyOn(LogisticsReservationClient.getInstance());
        await LogisticsReservationClient.getInstance().release(5, { reason: 'test' });
        expect(spy).toHaveBeenLastCalledWith({ reason: 'test' }, '5/release', Controllers.LogisticsReservations, HttpMethod.Post);
    });

    it('the town views and the planner reach api/Logistics', async () => {
        const client = LogisticsClient.getInstance();
        const spy = spyOn(client, {});
        await client.townSupply(4);
        expect(spy).toHaveBeenLastCalledWith(null, 'towns/4/supply', Controllers.Logistics, HttpMethod.Get);
        await client.serviceAreas(4);
        expect(spy).toHaveBeenLastCalledWith(null, 'towns/4/service-areas', Controllers.Logistics, HttpMethod.Get);
        await client.dryRun(4);
        expect(spy).toHaveBeenLastCalledWith(null, 'towns/4/dry-run', Controllers.Logistics, HttpMethod.Post);
        await client.runNow(4);
        expect(spy).toHaveBeenLastCalledWith(null, 'towns/4/run-now', Controllers.Logistics, HttpMethod.Post);
        await client.consumer(21);
        expect(spy).toHaveBeenLastCalledWith(null, 'consumers/21', Controllers.Logistics, HttpMethod.Get);
    });
});
