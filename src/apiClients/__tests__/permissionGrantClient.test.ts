import { HOLDER_GRANTS_PAGE_SIZE, PermissionGrantClient } from '../permissionGrantClient';
import { Controllers, HttpMethod } from '../../utils';
import {
    getCreateFunctionForEntity,
    getDeleteFunctionForEntity,
    getFetchByIdFunctionForEntity,
    getSearchFunctionForEntity,
    getUpdateFunctionForEntity,
} from '../../utils/entityApiMapping';

// PandiO/knk-workspace#408: the dashboard's PermissionGrant table; #50: the group Permissions panel's reads and writes.
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
    it("reads one holder's own grants through the search, filtered on holderId and sorted by node (#50)", async () => {
        await client.getForHolder(8);
        expect(invokeSpy).toHaveBeenCalledWith(
            expect.objectContaining({ pageNumber: 1, pageSize: HOLDER_GRANTS_PAGE_SIZE, sortBy: 'node', sortDescending: false, filters: { holderId: '8' } }),
            'search', Controllers.PermissionGrants, HttpMethod.Post);
    });

    it('grants, denies or changes the expiry with PUT api/PermissionGrants/by-node (#50)', async () => {
        const request = { holderId: 8, node: 'knk.gate.open', value: false, expiresAt: '2027-01-01T00:00:00.000Z' };
        await client.upsertByNode(request);
        expect(invokeSpy).toHaveBeenCalledWith(request, 'by-node', Controllers.PermissionGrants, HttpMethod.Put);
    });

    it('removes a node with DELETE api/PermissionGrants/by-node, holder and node in the query string (#50)', async () => {
        await client.revokeByNode(8, 'knk.gate.*');
        expect(invokeSpy).toHaveBeenCalledWith(null, 'by-node?holderId=8&node=knk.gate.*', Controllers.PermissionGrants, HttpMethod.Delete);

        await client.revokeByNode(8, 'a&b=c');
        expect(invokeSpy).toHaveBeenLastCalledWith(null, 'by-node?holderId=8&node=a%26b%3Dc', Controllers.PermissionGrants, HttpMethod.Delete);
    });
});
