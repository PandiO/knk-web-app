import { userManagementClient } from '../userManagementClient';
import { Controllers, HttpMethod } from '../../utils';

describe('userManagementClient', () => {
  let invokeSpy: jest.SpyInstance;

  beforeEach(() => {
    invokeSpy = jest.spyOn(userManagementClient as any, 'invokeServiceCall').mockResolvedValue(undefined);
  });

  afterEach(() => {
    invokeSpy.mockRestore();
  });

  // KNG-59: serviceCall drops request data on DELETE, so the node must be in the query string.
  it('revokeNode deletes the direct grant with the node encoded in the query string', async () => {
    await userManagementClient.revokeNode(7, 'knk.gate.*');
    expect(invokeSpy).toHaveBeenCalledWith(null, '7/grants?node=knk.gate.*', Controllers.Users, HttpMethod.Delete);
  });

  it('revokeNode encodes characters that would break the query string', async () => {
    await userManagementClient.revokeNode(7, 'a&b=c');
    expect(invokeSpy).toHaveBeenCalledWith(null, '7/grants?node=a%26b%3Dc', Controllers.Users, HttpMethod.Delete);
  });
  // PandiO/knk-workspace#50: a permission group's History list reads the audit log by subject.
  it('getAuditLog passes the subject filter as query parameters', async () => {
    await userManagementClient.getAuditLog({ subjectType: 'PermissionGroup', subjectId: 8, pageNumber: 2, pageSize: 10 });
    expect(invokeSpy).toHaveBeenCalledWith({ subjectType: 'PermissionGroup', subjectId: 8, pageNumber: 2, pageSize: 10 }, '',
      Controllers.AuditLog, HttpMethod.Get);
  });

  it('getAuditLog leaves the subject out when not asked (the player audit log)', async () => {
    await userManagementClient.getAuditLog({ targetUserId: 7 });
    expect(invokeSpy).toHaveBeenCalledWith({ targetUserId: 7 }, '', Controllers.AuditLog, HttpMethod.Get);
  });

  // #565: the optional unfreeze reason, kick and ban.
  it('unfreeze sends the reason only when there is one', async () => {
    await userManagementClient.unfreeze(7, 'Appeal accepted');
    expect(invokeSpy).toHaveBeenCalledWith({ reason: 'Appeal accepted' }, '7/unfreeze', Controllers.Users, HttpMethod.Put);
    await userManagementClient.unfreeze(7);
    expect(invokeSpy).toHaveBeenLastCalledWith(null, '7/unfreeze', Controllers.Users, HttpMethod.Put);
  });

  it('kick posts the optional reason; ban posts the reason', async () => {
    await userManagementClient.kick(7, 'AFK');
    expect(invokeSpy).toHaveBeenCalledWith({ reason: 'AFK' }, '7/kick', Controllers.Users, HttpMethod.Post);
    await userManagementClient.kick(7);
    expect(invokeSpy).toHaveBeenLastCalledWith(null, '7/kick', Controllers.Users, HttpMethod.Post);
    await userManagementClient.ban(7, 'X-ray');
    expect(invokeSpy).toHaveBeenLastCalledWith({ reason: 'X-ray' }, '7/ban', Controllers.Users, HttpMethod.Post);
  });
});
