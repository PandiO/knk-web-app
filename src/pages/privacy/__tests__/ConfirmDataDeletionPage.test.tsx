import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { ConfirmDataDeletionPage } from '../ConfirmDataDeletionPage';
import { dataDeletionClient } from '../../../apiClients/dataDeletionClient';

let mockSearch = '?token=abc123';
jest.mock('react-router-dom', () => ({
  Link: ({ to, children, ...rest }: { to: string; children: React.ReactNode }) => <a href={to} {...rest}>{children}</a>,
  useSearchParams: () => [new URLSearchParams(mockSearch)],
}), { virtual: true });
jest.mock('../../../apiClients/dataDeletionClient', () => ({
  dataDeletionClient: { confirm: jest.fn() },
}));

const api = dataDeletionClient as jest.Mocked<typeof dataDeletionClient>;

describe('ConfirmDataDeletionPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearch = '?token=abc123';
  });

  it('confirms only on an explicit click and shows when the deletion runs', async () => {
    api.confirm.mockResolvedValue({
      id: 1, userId: 7, source: 'Player', requestedAt: '2026-10-03T10:00:00Z', dueAt: '2026-11-02T10:00:00Z',
      status: 'Pending', requestedByUserId: 7, scheduledAt: '2026-10-08T10:00:00Z', autoExecute: true,
    });
    render(<ConfirmDataDeletionPage />);

    expect(api.confirm).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Yes, delete my data' }));

    expect(api.confirm).toHaveBeenCalledWith('abc123');
    expect(await screen.findByRole('status')).toHaveTextContent('Confirmed. Your data will be deleted on');
    expect(screen.getByRole('link', { name: 'account page' })).toHaveAttribute('href', '/account');
  });

  it('shows the API message for an invalid or expired link', async () => {
    api.confirm.mockRejectedValue(Object.assign(new Error('x'), { status: 400, response: { message: 'This confirmation link is invalid, already used or expired.' } }));
    render(<ConfirmDataDeletionPage />);

    await userEvent.click(screen.getByRole('button', { name: 'Yes, delete my data' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('already used or expired');
  });

  it('explains a link without a token', () => {
    mockSearch = '';
    render(<ConfirmDataDeletionPage />);

    expect(screen.getByRole('alert')).toHaveTextContent('incomplete');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
