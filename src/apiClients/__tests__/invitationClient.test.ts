import { InvitationClient } from '../invitationClient';
import { Controllers, HttpMethod } from '../../utils';

describe('InvitationClient', () => {
  const client = InvitationClient.getInstance();
  let invokeSpy: jest.SpyInstance;

  beforeEach(() => {
    invokeSpy = jest.spyOn(client as any, 'invokeServiceCall').mockResolvedValue({});
  });

  afterEach(() => {
    invokeSpy.mockRestore();
  });

  it('list sends only the filters that are set', async () => {
    await client.list({ pageNumber: 1, pageSize: 25, status: '', kind: 'Shared' });
    expect(invokeSpy).toHaveBeenCalledWith({ pageNumber: 1, pageSize: 25, kind: 'Shared' }, '', Controllers.Invitations, HttpMethod.Get);
  });

  it('creates personal invites and shared codes', async () => {
    await client.createPersonal({ emails: ['a@example.com'], sendEmail: false });
    expect(invokeSpy).toHaveBeenCalledWith({ emails: ['a@example.com'], sendEmail: false }, 'personal', Controllers.Invitations, HttpMethod.Post);
    await client.createShared({ label: 'Discord', maxUses: 5 });
    expect(invokeSpy).toHaveBeenCalledWith({ label: 'Discord', maxUses: 5 }, 'shared', Controllers.Invitations, HttpMethod.Post);
  });

  it('posts the row actions to {id}/<action>', async () => {
    await client.resend(3);
    expect(invokeSpy).toHaveBeenCalledWith({ sendEmail: true }, '3/resend', Controllers.Invitations, HttpMethod.Post);
    for (const action of ['rotate', 'pause', 'resume', 'revoke'] as const) {
      await client[action](7);
      expect(invokeSpy).toHaveBeenCalledWith(null, `7/${action}`, Controllers.Invitations, HttpMethod.Post);
    }
    await client.redemptions(7);
    expect(invokeSpy).toHaveBeenCalledWith(null, '7/redemptions', Controllers.Invitations, HttpMethod.Get);
  });

  it('checks a token or a code', async () => {
    await client.check({ code: 'KNK-7QH4M-2XA9P' });
    expect(invokeSpy).toHaveBeenCalledWith({ code: 'KNK-7QH4M-2XA9P' }, 'check', Controllers.Invitations, HttpMethod.Post);
  });
});
