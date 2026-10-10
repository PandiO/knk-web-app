import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { MyDataDeletionSection } from '../MyDataDeletionSection';
import { dataDeletionClient } from '../../../apiClients/dataDeletionClient';
import { PrivacyDeletionRequestDto } from '../../../types/dtos/privacy/PrivacyDtos';

jest.mock('../../../apiClients/dataDeletionClient', () => ({
  dataDeletionClient: { getMine: jest.fn(), requestMine: jest.fn(), cancelMine: jest.fn() },
}));

const api = dataDeletionClient as jest.Mocked<typeof dataDeletionClient>;

const base: PrivacyDeletionRequestDto = {
  id: 3,
  userId: 7,
  source: 'Player',
  requestedAt: '2026-10-03T10:00:00Z',
  dueAt: '2026-11-02T10:00:00Z',
  status: 'AwaitingConfirmation',
  requestedByUserId: 7,
  confirmationExpiresAt: '2026-10-04T10:00:00Z',
  autoExecute: false,
};

describe('MyDataDeletionSection', () => {
  beforeEach(() => jest.clearAllMocks());

  it('asks for confirmation first, then emails the link', async () => {
    api.getMine.mockResolvedValue(null);
    api.requestMine.mockResolvedValue(base);
    render(<MyDataDeletionSection hasEmail />);

    await userEvent.click(await screen.findByRole('button', { name: 'Delete my data…' }));
    expect(api.requestMine).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Email me the confirmation link' }));

    expect(api.requestMine).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('status')).toHaveTextContent('We sent you an email');
    expect(screen.getByText(/open the confirmation link before/)).toBeInTheDocument();
  });

  it('needs an email address on the account', async () => {
    api.getMine.mockResolvedValue(null);
    render(<MyDataDeletionSection hasEmail={false} />);

    expect(await screen.findByRole('button', { name: 'Delete my data…' })).toBeDisabled();
    expect(screen.getByText(/Add an email address above first/)).toBeInTheDocument();
  });

  it('shows a scheduled deletion and cancels it', async () => {
    api.getMine.mockResolvedValue({ ...base, status: 'Pending', source: 'Staff', scheduledAt: '2026-10-08T10:00:00Z', autoExecute: true });
    api.cancelMine.mockResolvedValue({ ...base, status: 'Cancelled' });
    render(<MyDataDeletionSection hasEmail />);

    expect(await screen.findByText(/requested by staff on your behalf/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel deletion' }));

    expect(api.cancelMine).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('status')).toHaveTextContent('cancelled');
    expect(screen.getByRole('button', { name: 'Delete my data…' })).toBeInTheDocument();
  });

  it('resends the link or cancels while unconfirmed, and shows API errors', async () => {
    api.getMine.mockResolvedValue(base);
    api.requestMine.mockRejectedValue(Object.assign(new Error('x'), { status: 502, response: { message: 'The confirmation email could not be sent.' } }));
    render(<MyDataDeletionSection hasEmail />);

    await userEvent.click(await screen.findByRole('button', { name: 'Send the link again' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('could not be sent');
    expect(screen.getByRole('button', { name: 'Cancel request' })).toBeInTheDocument();
  });
});
