import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { EmailLogPage } from '../EmailLogPage';
import { emailOutboxClient } from '../../../apiClients/emailOutboxClient';
import { EmailOutboxItemDto, EmailOutboxPageDto } from '../../../types/dtos/email/EmailOutboxDtos';

jest.mock('../../../apiClients/emailOutboxClient', () => ({
  emailOutboxClient: { list: jest.fn(), sendTest: jest.fn(), retry: jest.fn() },
}));

const client = emailOutboxClient as jest.Mocked<typeof emailOutboxClient>;

const item = (overrides: Partial<EmailOutboxItemDto>): EmailOutboxItemDto => ({
  id: 1, kind: 'PasswordReset', toMasked: 'st***@example.com', subject: 'Reset your Knights & Kings password',
  status: 'Sent', attempts: 1, nextAttemptAt: '2026-10-21T12:00:00Z', createdAt: '2026-10-21T12:00:00Z',
  sentAt: '2026-10-21T12:00:05Z', lastError: null, canRetry: false,
  ...overrides,
});

const page = (items: EmailOutboxItemDto[], overrides: Partial<EmailOutboxPageDto> = {}): EmailOutboxPageDto => ({
  items, totalCount: items.length, pageNumber: 1, pageSize: 25, transport: 'Smtp', last24Hours: 12, dailyCap: 300,
  ...overrides,
});

describe('EmailLogPage', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('lists mails with status, kind, masked recipient, attempts and last error', async () => {
    client.list.mockResolvedValue(page([
      item({ id: 1 }),
      item({ id: 2, kind: 'EmailChanged', toMasked: 'al***@example.com', status: 'Failed', attempts: 6, lastError: 'SocketException: relay down', canRetry: true }),
    ]));

    render(<EmailLogPage />);

    expect(await screen.findByText('al***@example.com')).toBeInTheDocument();
    expect(screen.getByText('st***@example.com')).toBeInTheDocument();
    expect(screen.getByText('SocketException: relay down')).toBeInTheDocument();
    expect(screen.getByTestId('email-summary')).toHaveTextContent('Transport: Smtp');
    expect(screen.getByTestId('email-summary')).toHaveTextContent('Last 24 hours: 12 of 300');
    // Only the Failed mail that kept its content offers Retry.
    expect(screen.getAllByRole('button', { name: /retry/i })).toHaveLength(1);
    expect(client.list).toHaveBeenCalledWith({ pageNumber: 1, pageSize: 25, status: '', kind: '' });
  });

  it('says so when the transport only logs', async () => {
    client.list.mockResolvedValue(page([], { transport: 'Log' }));
    render(<EmailLogPage />);
    expect(await screen.findByText('No mails.')).toBeInTheDocument();
    expect(screen.getByTestId('email-summary')).toHaveTextContent('mails are logged, not sent');
  });

  it('filters by status and kind', async () => {
    client.list.mockResolvedValue(page([]));
    render(<EmailLogPage />);
    await screen.findByText('No mails.');

    await userEvent.selectOptions(screen.getByLabelText('Status'), 'Failed');
    await waitFor(() => expect(client.list).toHaveBeenLastCalledWith({ pageNumber: 1, pageSize: 25, status: 'Failed', kind: '' }));
    await userEvent.selectOptions(screen.getByLabelText('Kind'), 'PasswordReset');
    await waitFor(() => expect(client.list).toHaveBeenLastCalledWith({ pageNumber: 1, pageSize: 25, status: 'Failed', kind: 'PasswordReset' }));
  });

  it('retries a failed mail and reloads', async () => {
    client.list.mockResolvedValue(page([item({ id: 7, status: 'Failed', attempts: 6, canRetry: true })]));
    client.retry.mockResolvedValue(item({ id: 7, status: 'Pending', attempts: 0 }));
    render(<EmailLogPage />);

    await userEvent.click(await screen.findByRole('button', { name: /retry/i }));

    await waitFor(() => expect(client.retry).toHaveBeenCalledWith(7));
    await waitFor(() => expect(client.list).toHaveBeenCalledTimes(2));
  });

  it('sends a test mail and shows the result', async () => {
    client.list.mockResolvedValue(page([]));
    client.sendTest.mockResolvedValue(item({ id: 9, kind: 'Test', status: 'Pending', toMasked: 'pa***@example.com' }));
    render(<EmailLogPage />);

    await userEvent.click(await screen.findByRole('button', { name: /send test mail to me/i }));

    const dialog = await screen.findByText('Test mail queued');
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText(/A test mail to pa\*\*\*@example.com is queued/)).toBeInTheDocument();
  });

  it('shows the API reason when the test mail is refused', async () => {
    client.list.mockResolvedValue(page([]));
    client.sendTest.mockRejectedValue({ status: 400, response: { error: 'NoEmail', message: 'Your account has no email address.' } });
    render(<EmailLogPage />);

    await userEvent.click(await screen.findByRole('button', { name: /send test mail to me/i }));

    expect(await screen.findByText('Test mail not sent')).toBeInTheDocument();
    expect(screen.getByText('Your account has no email address.')).toBeInTheDocument();
  });

  it('shows a load error', async () => {
    client.list.mockRejectedValue({ status: 403, response: { message: 'Requires the knk.admin.config permission.' } });
    render(<EmailLogPage />);
    expect(await screen.findByText('Requires the knk.admin.config permission.')).toBeInTheDocument();
  });
});
