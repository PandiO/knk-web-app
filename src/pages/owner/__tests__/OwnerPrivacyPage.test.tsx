import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { OwnerPrivacyPage } from '../OwnerPrivacyPage';
import { privacyClient } from '../../../apiClients/privacyClient';
import { PrivacyDeletionRequestDto } from '../../../types/dtos/privacy/PrivacyDtos';

jest.mock('react-router-dom', () => ({
  Link: ({ to, children, ...rest }: { to: string; children: React.ReactNode }) => <a href={to} {...rest}>{children}</a>,
}), { virtual: true });
jest.mock('../../../apiClients/privacyClient', () => ({
  privacyClient: { getRequests: jest.fn(), createRequest: jest.fn(), execute: jest.fn(), cancel: jest.fn() },
}));

const api = privacyClient as jest.Mocked<typeof privacyClient>;

const pending: PrivacyDeletionRequestDto = {
  id: 5,
  userId: 7,
  username: 'alice',
  source: 'Staff',
  requestedAt: '2026-10-03T10:00:00Z',
  dueAt: '2026-11-02T10:00:00Z',
  confirmedAt: '2026-10-03T10:00:00Z',
  scheduledAt: new Date(Date.now() - 86_400_000).toISOString(), // yesterday: the grace period is over
  autoExecute: true,
  status: 'Pending',
  requestedByUserId: 1,
  note: 'email 12',
};

describe('OwnerPrivacyPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    api.getRequests.mockResolvedValue([pending]);
  });

  it('lists requests with their scheduled and deadline dates, and files a new one', async () => {
    api.createRequest.mockResolvedValue({ ...pending, id: 6, userId: 8 });
    render(<OwnerPrivacyPage />);

    expect(await screen.findByText('alice (#7)')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Requests' })).getByText(/runs automatically/)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Player id'), '8');
    await userEvent.type(screen.getByLabelText('Note'), 'support ticket');
    await userEvent.click(screen.getByRole('button', { name: 'File request' }));

    expect(api.createRequest).toHaveBeenCalledWith(8, 'support ticket');
    expect(api.getRequests).toHaveBeenCalledTimes(2);

    await userEvent.selectOptions(screen.getByLabelText('Status'), 'Completed');
    expect(api.getRequests).toHaveBeenLastCalledWith('Completed');
  });

  it('previews the counts and deletes only after the player id is typed', async () => {
    api.execute.mockImplementation((id: number, dryRun: boolean) => Promise.resolve(dryRun
      ? { ...pending, result: { dryRun: true, userIds: [7, 9], deleted: { player_stat_daily: 40, telemetry_events: 12 }, pseudonymizedUsers: 2 } }
      : { ...pending, status: 'Completed', username: 'deleted-7' }));
    render(<OwnerPrivacyPage />);

    await userEvent.click(await screen.findByRole('button', { name: /review & delete/i }));
    const dialog = await screen.findByRole('dialog', { name: 'Deletion preview' });
    expect(api.execute).toHaveBeenCalledWith(5, true);
    expect(dialog).toHaveTextContent('Accounts covered: 7, 9');
    expect(within(dialog).getByText('player_stat_daily')).toBeInTheDocument();
    expect(within(dialog).getByText('40')).toBeInTheDocument();

    const deleteNow = within(dialog).getByRole('button', { name: 'Delete now' });
    expect(deleteNow).toBeDisabled();
    await userEvent.type(within(dialog).getByLabelText('Confirm player id'), '8');
    expect(deleteNow).toBeDisabled();
    await userEvent.clear(within(dialog).getByLabelText('Confirm player id'));
    await userEvent.type(within(dialog).getByLabelText('Confirm player id'), '7');
    await userEvent.click(deleteNow);

    expect(api.execute).toHaveBeenLastCalledWith(5, false);
    expect(screen.queryByRole('dialog', { name: 'Deletion preview' })).not.toBeInTheDocument();
  });

  it('cancels a request and shows results of completed ones', async () => {
    api.getRequests.mockResolvedValue([
      pending,
      { ...pending, id: 4, userId: 3, username: 'deleted-3', status: 'Completed', executedAt: '2026-10-01T10:00:00Z', executedByUserId: null,
        result: { dryRun: false, userIds: [3], deleted: { a: 2, b: 3 }, pseudonymizedUsers: 1 } },
    ]);
    api.cancel.mockResolvedValue({ ...pending, status: 'Cancelled' });
    render(<OwnerPrivacyPage />);

    expect(await screen.findByText(/5 rows deleted, 1 account\(s\) pseudonymized/)).toBeInTheDocument();
    expect(screen.getByText(/\(automatically\)/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel request' }));
    expect(api.cancel).toHaveBeenCalledWith(5);
  });

  it('refuses to delete during the grace period and shows unconfirmed player requests', async () => {
    const future = new Date(Date.now() + 3 * 86_400_000).toISOString();
    const inGrace = { ...pending, scheduledAt: future, source: 'Player' as const };
    api.getRequests.mockResolvedValue([
      inGrace,
      { ...pending, id: 6, userId: 8, username: 'bob', status: 'AwaitingConfirmation', source: 'Player', scheduledAt: null,
        confirmationExpiresAt: future, autoExecute: false },
    ]);
    api.execute.mockResolvedValue({ ...inGrace, result: { dryRun: true, userIds: [7], deleted: { a: 1 }, pseudonymizedUsers: 1 } });
    render(<OwnerPrivacyPage />);

    expect(await screen.findByText('Awaiting email confirmation')).toBeInTheDocument();
    expect(screen.getByText(/link valid until/)).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('button', { name: /review & delete/i })[0]);
    const dialog = await screen.findByRole('dialog', { name: 'Deletion preview' });
    expect(dialog).toHaveTextContent('Grace period: the player can cancel until');
    await userEvent.type(within(dialog).getByLabelText('Confirm player id'), '7');
    expect(within(dialog).getByRole('button', { name: 'Delete now' })).toBeDisabled();
  });

  it('shows the owner-only notice on 403', async () => {
    api.getRequests.mockRejectedValue(Object.assign(new Error('Forbidden'), { status: 403 }));
    render(<OwnerPrivacyPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('knk.owner.privacy.manage');
  });
});
