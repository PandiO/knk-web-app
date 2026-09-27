import { AuditLogRetentionClient } from '../auditLogRetentionClient';
import { Controllers, HttpMethod } from '../../utils';

describe('AuditLogRetentionClient', () => {
  const client = AuditLogRetentionClient.getInstance();
  let invokeSpy: jest.SpyInstance;

  beforeEach(() => {
    invokeSpy = jest.spyOn(client as any, 'invokeServiceCall').mockResolvedValue({});
  });

  afterEach(() => {
    invokeSpy.mockRestore();
  });

  it('get reads the retention singleton', async () => {
    await client.get();
    expect(invokeSpy).toHaveBeenCalledWith(null, '', Controllers.AuditLogRetentionConfiguration, HttpMethod.Get);
  });

  it('update puts both retention periods', async () => {
    await client.update({ retentionDays: 180, privateMessageRetentionDays: 30 });
    expect(invokeSpy).toHaveBeenCalledWith(
      { retentionDays: 180, privateMessageRetentionDays: 30 }, '', Controllers.AuditLogRetentionConfiguration, HttpMethod.Put);
  });
});
