import { ObjectManager } from '../../apiClients/objectManager';
import {
    getCreateFunctionForEntity,
    getDeleteFunctionForEntity,
    getFetchByIdFunctionForEntity,
    getSearchFunctionForEntity,
    getUpdateFunctionForEntity
} from '../entityApiMapping';

/**
 * Arena duels (KNG-210; rev. 6): the FormWizard reaches arenas, their areas and the areas' regions through the generic
 * entity mapping; all three live under api/Arenas. The ArenaKit join has no client: it travels in the arena payload.
 */
describe('entity API mapping for the arena types', () => {
    let calls: Array<[unknown, string, string, string]>;

    beforeEach(() => {
        calls = [];
        jest.spyOn(ObjectManager.prototype, 'invokeServiceCall').mockImplementation(
            async (data: unknown, operation: string, controller: string, method: string) => {
                calls.push([data, operation, controller, method]);
                return { items: [], totalCount: 0 };
            });
    });

    afterEach(() => jest.restoreAllMocks());

    it.each([
        ['Arena', ''],
        // Rev. 6: battlegrounds, spectator areas and the lobby are arena areas with their regions.
        ['ArenaArea', 'areas/'],
        ['ArenaAreaRegion', 'areas/regions/']
    ])('%s: search, fetch, create, update and delete hit api/Arenas/%s', async (type, prefix) => {
        await getSearchFunctionForEntity(type)({ page: 1, pageSize: 10 } as any);
        await getFetchByIdFunctionForEntity(type)('5');
        await getCreateFunctionForEntity(type)({ name: 'x' });
        await getUpdateFunctionForEntity(type)({ id: 5, name: 'x' });
        await getDeleteFunctionForEntity(type)(5);

        expect(calls.map(([, operation, controller, method]) => [operation, controller, method])).toEqual([
            [`${prefix}search`, 'Arenas', 'post'],
            [`${prefix}5`, 'Arenas', 'get'],
            [prefix.replace(/\/$/, ''), 'Arenas', 'post'],
            [`${prefix}5`, 'Arenas', 'put'],
            [`${prefix}5`, 'Arenas', 'delete']
        ]);
    });

    it('has no search for the ArenaKit join', () => {
        expect(() => getSearchFunctionForEntity('ArenaKit')).toThrow();
    });

    it('no longer knows the child-domain types of rev. 5', () => {
        expect(() => getSearchFunctionForEntity('ArenaBattleground')).toThrow();
        expect(() => getSearchFunctionForEntity('ArenaSpectatorArea')).toThrow();
    });
});
