import { PermissionGrantClient } from '../permissionGrantClient';
import { Controllers, HttpMethod } from '../../utils';
import {
    getCreateFunctionForEntity,
    getDeleteFunctionForEntity,
    getFetchByIdFunctionForEntity,
    getSearchFunctionForEntity,
    getUpdateFunctionForEntity,
} from '../../utils/entityApiMapping';

// PandiO/knk-workspace#408: the dashboard's PermissionGrant table.
describe('PermissionGrantClient', () => {
    const client = PermissionGrantClient.getInstance();
    let invokeSpy: jest.SpyInstance;

    beforeEach(() => {
        invokeSpy = jest.spyOn(client as any, 'invokeServiceCall').mockResolvedValue({ items: [], totalCount: 0 });
    });

    afterEach(() => invokeSpy.mockRestore());

    it('searches with POST api/PermissionGrants/search', async () => {
        const query = { page: 1, pageSize: 10, searchTerm: 'knk.admin', sortBy: 'expiresAt', sortDescending: true } as any;
        await client.searchPaged(query);
        expect(invokeSpy).toHaveBeenCalledWith(query, 'search', Controllers.PermissionGrants, HttpMethod.Post);
    });

    it('gets one grant with GET api/PermissionGrants/{id}', async () => {
        await client.getById(7);
        expect(invokeSpy).toHaveBeenCalledWith(null, '7', Controllers.PermissionGrants, HttpMethod.Get);
    });

    it('is the dashboard search for PermissionGrant, with the API page number, sort and search term', async () => {
        invokeSpy.mockResolvedValue({ items: [{ id: 3, holderId: 1, node: 'knk.fly', value: true }], totalCount: 12, pageNumber: 2, pageSize: 5 });

        const result = await getSearchFunctionForEntity('PermissionGrant')(
            { page: 2, pageSize: 5, searchTerm: 'fly', sortBy: 'node', sortDescending: false } as any);

        expect(invokeSpy).toHaveBeenCalledWith(
            expect.objectContaining({ pageNumber: 2, pageSize: 5, searchTerm: 'fly', sortBy: 'node', sortDescending: false }),
            'search', Controllers.PermissionGrants, HttpMethod.Post);
        expect(result).toMatchObject({ totalCount: 12, page: 2, pageSize: 5, totalPages: 3 });
        expect(result.items).toHaveLength(1);
    });

    it('is the fetch by id for PermissionGrant (detail page, form hydration)', async () => {
        await getFetchByIdFunctionForEntity('permissiongrant')('8');
        expect(invokeSpy).toHaveBeenCalledWith(null, '8', Controllers.PermissionGrants, HttpMethod.Get);
    });

    it('registers no create, update or delete: grants are written through the by-node routes', () => {
        expect(() => getCreateFunctionForEntity('PermissionGrant')).toThrow(/No create function/i);
        expect(() => getUpdateFunctionForEntity('PermissionGrant')).toThrow(/No update function/i);
        expect(() => getDeleteFunctionForEntity('PermissionGrant')).toThrow(/No delete function/i);
        expect(invokeSpy).not.toHaveBeenCalled();
    });
});
