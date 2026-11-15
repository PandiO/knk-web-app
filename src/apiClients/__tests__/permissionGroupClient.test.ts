import { PermissionGroupClient } from '../permissionGroupClient';
import { Controllers, HttpMethod } from '../../utils';

// PandiO/knk-workspace#50: the group Permissions panel's blast radius.
describe('PermissionGroupClient', () => {
    const client = PermissionGroupClient.getInstance();
    let invokeSpy: jest.SpyInstance;

    beforeEach(() => {
        invokeSpy = jest.spyOn(client as any, 'invokeServiceCall')
            .mockResolvedValue({ groupId: 8, directMembers: 2, totalMembers: 5, inheritingGroups: 1 });
    });

    afterEach(() => invokeSpy.mockRestore());

    it('counts the members a change reaches with GET api/PermissionGroups/{id}/member-count', async () => {
        const result = await client.getMemberCount(8);
        expect(invokeSpy).toHaveBeenCalledWith(null, '8/member-count', Controllers.PermissionGroups, HttpMethod.Get);
        expect(result.totalMembers).toBe(5);
    });
});
