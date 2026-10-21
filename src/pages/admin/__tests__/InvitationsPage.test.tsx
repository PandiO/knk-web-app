import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { InvitationsPage } from '../InvitationsPage';
import { invitationClient } from '../../../apiClients/invitationClient';
import { InvitationDto, InvitationPageDto } from '../../../types/dtos/invitations/InvitationDtos';

jest.mock('../../../apiClients/invitationClient', () => ({
  invitationClient: {
    list: jest.fn(), options: jest.fn(), createPersonal: jest.fn(), createShared: jest.fn(),
    resend: jest.fn(), rotate: jest.fn(), pause: jest.fn(), resume: jest.fn(), revoke: jest.fn(), redemptions: jest.fn(),
    accessSync: jest.fn(),
  },
}));

const client = invitationClient as jest.Mocked<typeof invitationClient>;

const invitation = (overrides: Partial<InvitationDto>): InvitationDto => ({
  id: 1, kind: 'Personal', status: 'Active', codeHint: 'ab12', email: 'tester@example.com', label: null, note: null,
  groupId: null, groupName: null, maxUses: 1, useCount: 0, createdAt: '2026-10-21T12:00:00Z', createdByUserId: 1,
  createdByName: 'Pandi', expiresAt: '2026-10-28T12:00:00Z', pausedAt: null, revokedAt: null, sendCount: 1, lastSentAt: null,
  ...overrides,
});

const page = (items: InvitationDto[]): InvitationPageDto => ({ items, totalCount: items.length, pageNumber: 1, pageSize: 25 });

const OPTIONS = {
  groups: [{ id: 4, name: 'Alpha Tester' }], defaultExpiryDays: 7, maxExpiryDays: 30,
  sharedDefaultMaxUses: 5, sharedMaxUsesCap: 50, registrationMode: 'Invite',
};

describe('InvitationsPage', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    client.options.mockResolvedValue(OPTIONS);
    client.list.mockResolvedValue(page([]));
    client.accessSync.mockResolvedValue({ enabled: false, configured: true, pendingAdds: 0, pendingRemoves: 0, reconcileMinutes: 5 });
  });

  describe('Access sync line (KNG-216)', () => {
    const SYNC = { enabled: true, configured: true, pendingAdds: 0, pendingRemoves: 0, reconcileMinutes: 5, listSize: 12 };

    it('says when the sync is off', async () => {
      render(<InvitationsPage />);

      expect(await screen.findByTestId('access-sync')).toHaveTextContent('Access sync: off');
    });

    it('shows the last good run and the pending count', async () => {
      client.accessSync.mockResolvedValue({ ...SYNC, lastSuccessAt: '2026-10-21T12:04:00Z', pendingAdds: 1 });
      render(<InvitationsPage />);

      const line = await screen.findByTestId('access-sync');
      expect(line).toHaveTextContent(/Access sync: last OK .*· 1 pending/);
      expect(line).toHaveTextContent('12 on the list');
      expect(line).not.toHaveAttribute('role', 'alert');
    });

    it('turns red with the last error', async () => {
      client.accessSync.mockResolvedValue({ ...SYNC, lastError: 'Cloudflare refused to read the list: HTTP 403 (10000: Authentication error).' });
      render(<InvitationsPage />);

      const line = await screen.findByTestId('access-sync');
      expect(line).toHaveAttribute('role', 'alert');
      expect(line).toHaveTextContent('Access sync: failing');
      expect(line).toHaveTextContent('no successful run yet');
      expect(line).toHaveTextContent('HTTP 403');
    });

    it('shows nothing when the status call fails', async () => {
      client.accessSync.mockRejectedValue({ status: 403 });
      render(<InvitationsPage />);
      await screen.findByText('No invitations.');

      expect(screen.queryByTestId('access-sync')).not.toBeInTheDocument();
    });
  });

  it('creates personal invites and shows the links once, with skipped addresses', async () => {
    client.createPersonal.mockResolvedValue({
      results: [
        { email: 'tester@example.com', outcome: 'Created', link: 'https://knk.example/invite/tok', mailStatus: 'Pending', invitation: invitation({}) },
        { email: 'admin@example.com', outcome: 'Skipped', reason: 'EmailInUse' },
      ],
    });
    render(<InvitationsPage />);
    await screen.findByText('No invitations.');

    await userEvent.type(screen.getByLabelText(/email addresses/i), 'tester@example.com\nadmin@example.com');
    await userEvent.selectOptions(screen.getByLabelText('Group on sign-up'), '4');
    await userEvent.click(screen.getByRole('button', { name: 'Create invites' }));

    const panel = await screen.findByTestId('created-panel');
    expect(client.createPersonal).toHaveBeenCalledWith({
      emails: ['tester@example.com', 'admin@example.com'], expiryDays: undefined, groupId: 4, note: undefined, sendEmail: true,
    });
    expect(within(panel).getByRole('button', { name: 'Copy link for tester@example.com' })).toBeInTheDocument();
    expect(within(panel).getByText(/mail pending/i)).toBeInTheDocument();
    expect(within(panel).getByText(/an account already uses this address/i)).toBeInTheDocument();
    expect(panel).toHaveTextContent('not shown again');
  });

  it('creates a shared code and shows it with copy buttons', async () => {
    client.createShared.mockResolvedValue({
      invitation: invitation({ id: 2, kind: 'Shared', email: null, label: 'Discord', maxUses: 10 }),
      code: 'KNK-7QH4M-2XA9P', link: 'https://knk.example/join?code=KNK-7QH4M-2XA9P',
    });
    render(<InvitationsPage />);
    await userEvent.click(screen.getByRole('tab', { name: 'Shared codes' }));

    await userEvent.type(screen.getByLabelText('Label'), 'Discord');
    await userEvent.type(screen.getByLabelText('Max uses'), '10');
    await userEvent.click(screen.getByRole('button', { name: 'Create code' }));

    expect(await screen.findByTestId('shared-code')).toHaveTextContent('KNK-7QH4M-2XA9P');
    expect(client.createShared).toHaveBeenCalledWith({ label: 'Discord', maxUses: 10, expiryDays: undefined, groupId: null });
    expect(screen.getByRole('button', { name: 'Copy code' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy link' })).toBeInTheDocument();
    expect(client.list).toHaveBeenLastCalledWith({ pageNumber: 1, pageSize: 25, status: '', kind: 'Shared' });
  });

  it('asks before revoking, then revokes', async () => {
    client.list.mockResolvedValue(page([invitation({ id: 5 })]));
    client.revoke.mockResolvedValue(invitation({ id: 5, status: 'Revoked' }));
    render(<InvitationsPage />);

    const row = await screen.findByTestId('invitation-row-5');
    await userEvent.click(within(row).getByRole('button', { name: /revoke/i }));
    expect(await screen.findByText('Revoke this invitation?')).toBeInTheDocument();
    expect(client.revoke).not.toHaveBeenCalled();

    // The row's button and the modal's confirm share the name; the confirm renders last.
    const buttons = screen.getAllByRole('button', { name: 'Revoke' });
    await userEvent.click(buttons[buttons.length - 1]);

    await waitFor(() => expect(client.revoke).toHaveBeenCalledWith(5));
  });

  it('shows status pills, uses and the right actions per kind', async () => {
    client.list.mockResolvedValue(page([
      invitation({ id: 1 }),
      invitation({ id: 2, kind: 'Shared', email: null, label: 'Discord', status: 'Paused', maxUses: 5, useCount: 2 }),
    ]));
    render(<InvitationsPage />);

    const personal = await screen.findByTestId('invitation-row-1');
    const shared = screen.getByTestId('invitation-row-2');
    expect(within(personal).getByRole('button', { name: /resend/i })).toBeInTheDocument();
    expect(within(personal).queryByRole('button', { name: /rotate/i })).not.toBeInTheDocument();
    expect(within(shared).getByText('Paused')).toBeInTheDocument();
    expect(within(shared).getByText('2 / 5')).toBeInTheDocument();
    expect(within(shared).getByRole('button', { name: /resume/i })).toBeInTheDocument();
    expect(within(shared).getByRole('button', { name: /redemptions/i })).toBeInTheDocument();
  });

  it('opens the redemptions drawer', async () => {
    client.list.mockResolvedValue(page([invitation({ id: 3, kind: 'Shared', email: null, label: 'Discord', maxUses: 5, useCount: 1 })]));
    client.redemptions.mockResolvedValue([
      { userId: 12, username: 'web-abc', emailMasked: 'pl***@example.com', redeemedAt: '2026-10-21T13:00:00Z', minecraftLinked: false },
    ]);
    render(<InvitationsPage />);

    await userEvent.click(await screen.findByRole('button', { name: /redemptions/i }));

    const drawer = await screen.findByRole('dialog', { name: 'Redemptions' });
    expect(await within(drawer).findByText('Not linked yet')).toBeInTheDocument();
    expect(within(drawer).getAllByText(/pl\*\*\*@example.com/).length).toBeGreaterThan(0);
    expect(client.redemptions).toHaveBeenCalledWith(3);
  });

  it('warns while the server does not accept invitations yet', async () => {
    client.options.mockResolvedValue({ ...OPTIONS, registrationMode: 'LinkCode' });
    render(<InvitationsPage />);

    expect(await screen.findByTestId('mode-warning')).toHaveTextContent('LinkCode');
  });
});
