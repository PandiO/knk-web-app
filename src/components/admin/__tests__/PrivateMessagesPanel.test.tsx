import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { PM_LOG_READ_NODE, PM_PAGE_SIZE, PrivateMessagesPanel, toSentAtRange } from '../PrivateMessagesPanel';
import { privateMessageLogClient } from '../../../apiClients/privateMessageLogClient';
import { usePermission } from '../../../hooks/useStaffAccess';
import { PrivateMessageLogEntryDto, PrivateMessageLogPagedResultDto } from '../../../types/dtos/privateMessageLog';

jest.mock('../../../apiClients/privateMessageLogClient', () => ({
  privateMessageLogClient: { search: jest.fn() },
}));
jest.mock('../../../hooks/useStaffAccess', () => ({
  usePermission: jest.fn(),
}));

const mockedSearch = privateMessageLogClient.search as jest.Mock;
const mockedUsePermission = usePermission as jest.Mock;

const PLAYER = 7;

const entry = (overrides: Partial<PrivateMessageLogEntryDto>): PrivateMessageLogEntryDto => ({
  id: 1,
  sentAt: '2026-09-26T12:00:00Z',
  senderUserId: PLAYER,
  senderName: 'Alice',
  recipientUserId: 12,
  recipientName: 'Bob',
  content: 'hello bob',
  outcome: 'Delivered',
  viaReply: false,
  ...overrides,
});

const page = (items: PrivateMessageLogEntryDto[], totalCount = items.length, pageNumber = 1): PrivateMessageLogPagedResultDto => ({
  items,
  totalCount,
  pageNumber,
  pageSize: PM_PAGE_SIZE,
});

const firstQuery = { participantUserId: PLAYER, otherUserId: undefined, from: undefined, to: undefined, pageNumber: 1, pageSize: PM_PAGE_SIZE };

describe('PrivateMessagesPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUsePermission.mockReturnValue({ allowed: true, isChecking: false });
  });

  it('is not shown to someone without knk.pmlog.read', () => {
    mockedUsePermission.mockReturnValue({ allowed: false, isChecking: false });
    const { container } = render(<PrivateMessagesPanel userId={PLAYER} />);

    expect(mockedUsePermission).toHaveBeenCalledWith(PM_LOG_READ_NODE);
    expect(container).toBeEmptyDOMElement();
    expect(mockedSearch).not.toHaveBeenCalled();
  });

  it('is not shown while the permission is still being checked', () => {
    mockedUsePermission.mockReturnValue({ allowed: false, isChecking: true });
    const { container } = render(<PrivateMessagesPanel userId={PLAYER} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('reads nothing (so audits nothing) until staff open the log', () => {
    render(<PrivateMessagesPanel userId={PLAYER} />);

    expect(screen.getByText('Private Messages')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show messages' })).toBeInTheDocument();
    expect(mockedSearch).not.toHaveBeenCalled();
  });

  it('shows sent and received messages with their counterpart and outcome badge', async () => {
    mockedSearch.mockResolvedValue(page([
      entry({ id: 2, content: 'stop spamming me', senderUserId: 12, senderName: 'Bob', recipientUserId: PLAYER, recipientName: 'Alice', viaReply: true }),
      entry({ id: 1, content: 'buy my stuff', outcome: 'BlockedIgnored' }),
      entry({ id: 3, content: 'server restart soon', senderUserId: null, senderName: 'Console', recipientUserId: PLAYER, recipientName: 'Alice' }),
    ]));
    const onViewed = jest.fn();
    render(<PrivateMessagesPanel userId={PLAYER} onViewed={onViewed} />);

    await userEvent.click(screen.getByRole('button', { name: 'Show messages' }));

    expect(await screen.findByText('stop spamming me')).toBeInTheDocument();
    expect(mockedSearch).toHaveBeenCalledTimes(1);
    expect(mockedSearch).toHaveBeenCalledWith(firstQuery);
    expect(onViewed).toHaveBeenCalledTimes(1);

    expect(screen.getByText('buy my stuff')).toBeInTheDocument();
    expect(screen.getByText('(reply)')).toBeInTheDocument();
    expect(screen.getByText('Blocked: ignored')).toBeInTheDocument();
    expect(screen.getAllByText('Delivered')).toHaveLength(2);
    expect(screen.getAllByLabelText('Sent to')).toHaveLength(1);
    expect(screen.getAllByLabelText('Received from')).toHaveLength(2);
    // Both Bob rows name Bob as the counterpart; the console can't be filtered on.
    expect(screen.getAllByRole('button', { name: 'Bob' })).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Console' })).not.toBeInTheDocument();
    expect(screen.getByText('Console')).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 1 (3 messages)')).toBeInTheDocument();
  });

  it('hides itself when the API refuses with 403', async () => {
    mockedSearch.mockRejectedValue(Object.assign(new Error('Requires the knk.pmlog.read permission.'), { status: 403 }));
    const onViewed = jest.fn();
    render(<PrivateMessagesPanel userId={PLAYER} onViewed={onViewed} />);

    await userEvent.click(screen.getByRole('button', { name: 'Show messages' }));

    await waitFor(() => expect(screen.queryByTestId('private-messages-panel')).not.toBeInTheDocument());
    expect(onViewed).not.toHaveBeenCalled();
  });

  it('shows an error for other failures', async () => {
    mockedSearch.mockRejectedValue(Object.assign(new Error('boom'), { status: 500 }));
    render(<PrivateMessagesPanel userId={PLAYER} />);

    await userEvent.click(screen.getByRole('button', { name: 'Show messages' }));

    expect(await screen.findByText('Could not load private messages.')).toBeInTheDocument();
  });

  it('filters on the conversation with a counterpart and clears it again', async () => {
    mockedSearch.mockResolvedValue(page([entry({})]));
    render(<PrivateMessagesPanel userId={PLAYER} />);
    await userEvent.click(screen.getByRole('button', { name: 'Show messages' }));

    await userEvent.click(await screen.findByRole('button', { name: 'Bob' }));

    await waitFor(() => expect(mockedSearch).toHaveBeenLastCalledWith({ ...firstQuery, otherUserId: 12 }));
    expect(await screen.findByText('With Bob')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Show every conversation' }));

    await waitFor(() => expect(mockedSearch).toHaveBeenLastCalledWith(firstQuery));
    expect(screen.queryByText('With Bob')).not.toBeInTheDocument();
  });

  it('applies the date range as [start of the first day, start of the day after the last)', async () => {
    mockedSearch.mockResolvedValue(page([entry({})]));
    render(<PrivateMessagesPanel userId={PLAYER} />);
    await userEvent.click(screen.getByRole('button', { name: 'Show messages' }));
    await screen.findByText('hello bob');

    await userEvent.type(screen.getByLabelText('From'), '2026-09-20');
    await userEvent.type(screen.getByLabelText('To'), '2026-09-26');
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));

    const range = toSentAtRange('2026-09-20', '2026-09-26');
    await waitFor(() => expect(mockedSearch).toHaveBeenLastCalledWith({ ...firstQuery, from: range.from, to: range.to }));
  });

  it('refuses a start date after the end date without calling the API', async () => {
    mockedSearch.mockResolvedValue(page([entry({})]));
    render(<PrivateMessagesPanel userId={PLAYER} />);
    await userEvent.click(screen.getByRole('button', { name: 'Show messages' }));
    await screen.findByText('hello bob');

    await userEvent.type(screen.getByLabelText('From'), '2026-09-26');
    await userEvent.type(screen.getByLabelText('To'), '2026-09-20');
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));

    expect(await screen.findByText('The start date must be on or before the end date.')).toBeInTheDocument();
    expect(mockedSearch).toHaveBeenCalledTimes(1);
  });

  it('pages to older messages with the same filters', async () => {
    mockedSearch.mockResolvedValueOnce(page([entry({})], 60, 1));
    mockedSearch.mockResolvedValueOnce(page([entry({ id: 30, content: 'older one' })], 60, 2));
    render(<PrivateMessagesPanel userId={PLAYER} />);
    await userEvent.click(screen.getByRole('button', { name: 'Show messages' }));
    expect(await screen.findByText('Page 1 of 3 (60 messages)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Newer messages' })).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: 'Older messages' }));

    expect(await screen.findByText('older one')).toBeInTheDocument();
    expect(mockedSearch).toHaveBeenLastCalledWith({ ...firstQuery, pageNumber: 2 });
    expect(screen.getByText('Page 2 of 3 (60 messages)')).toBeInTheDocument();
  });
});

describe('toSentAtRange', () => {
  it('gives no bounds for empty inputs', () => {
    expect(toSentAtRange('', '')).toEqual({ from: undefined, to: undefined });
  });

  it('starts at local midnight of the first day and ends before the day after the last', () => {
    expect(toSentAtRange('2026-09-20', '2026-09-26')).toEqual({
      from: new Date(2026, 8, 20).toISOString(),
      to: new Date(2026, 8, 27).toISOString(),
    });
  });

  it('rolls the end over month boundaries', () => {
    expect(toSentAtRange('', '2026-09-30').to).toBe(new Date(2026, 9, 1).toISOString());
  });
});
