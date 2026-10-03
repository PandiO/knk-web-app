import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { OwnerTelemetryPage } from '../OwnerTelemetryPage';
import { telemetryClient } from '../../../apiClients/telemetryClient';
import { TelemetryEventViewDto } from '../../../types/dtos/telemetry/TelemetryDtos';

// virtual: CRA's Jest resolver can't resolve react-router-dom's package exports
jest.mock('react-router-dom', () => ({
  Link: ({ to, children, ...rest }: { to: string; children: React.ReactNode }) => <a href={to} {...rest}>{children}</a>,
}), { virtual: true });
jest.mock('../../../apiClients/telemetryClient', () => ({
  telemetryClient: {
    search: jest.fn(),
    getEvent: jest.fn(),
    getTimeline: jest.fn(),
    getHealth: jest.fn(),
    getTestRuns: jest.fn(),
    getEnhancedTargets: jest.fn(),
    startTestRun: jest.fn(),
    endTestRun: jest.fn(),
    addEnhancedTarget: jest.fn(),
    removeEnhancedTarget: jest.fn(),
  },
}));

const api = telemetryClient as jest.Mocked<typeof telemetryClient>;
const forbidden = () => Promise.reject(Object.assign(new Error('Forbidden'), { status: 403 }));

const event = (over: Partial<TelemetryEventViewDto> = {}): TelemetryEventViewDto => ({
  id: 1,
  eventId: 'e-1',
  name: 'siege.lobby_join_attempt',
  schemaVersion: 1,
  level: 'Baseline',
  source: 'Plugin',
  occurredAt: '2026-10-03T10:00:00Z',
  receivedAt: '2026-10-03T10:00:01Z',
  serverName: 'paper 25565',
  serverSeq: 4,
  appVersion: '1.0',
  userId: 7,
  username: 'alice',
  correlationId: 'corr-1',
  feature: 'siege',
  action: 'lobby_join_attempt',
  outcome: 'Denied',
  reasonCode: 'lobby_full',
  payload: { lobbyId: 3 },
  ...over,
});

describe('OwnerTelemetryPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    api.getHealth.mockResolvedValue({ enabled: true, queueDepth: 2, queueCapacity: 10000, droppedSinceStart: 5, eventsLast24h: 120 });
    api.getTestRuns.mockResolvedValue([{ id: 3, name: 'Siege alpha', startedAt: '2026-10-03T09:00:00Z', createdByUserId: 1 }]);
    api.getEnhancedTargets.mockResolvedValue([]);
  });

  it('searches with the filters, shows outcomes and pages older events', async () => {
    api.search
      .mockResolvedValueOnce({ items: [event()], nextBefore: 'cursor-1' })
      .mockResolvedValueOnce({ items: [event({ id: 2, eventId: 'e-2', name: 'session.join', outcome: 'Succeeded', reasonCode: null })], nextBefore: null });
    render(<OwnerTelemetryPage />);

    expect(await screen.findByTestId('telemetry-health')).toHaveTextContent('120 events in 24 h');
    expect(screen.getByTestId('telemetry-health')).toHaveTextContent('5 dropped');
    await userEvent.type(screen.getByLabelText('Player id'), '7');
    await userEvent.selectOptions(screen.getByLabelText('Outcome'), 'Denied');
    await userEvent.click(screen.getByRole('button', { name: /search events/i }));

    expect(await screen.findByText('siege.lobby_join_attempt')).toBeInTheDocument();
    expect(api.search).toHaveBeenCalledWith(expect.objectContaining({ userId: 7, outcome: 'Denied', before: undefined }));
    expect(screen.getByText('lobby_full')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /load older/i }));
    expect(await screen.findByText('session.join')).toBeInTheDocument();
    expect(api.search).toHaveBeenLastCalledWith(expect.objectContaining({ before: 'cursor-1' }));
    expect(screen.queryByRole('button', { name: /load older/i })).not.toBeInTheDocument();
  });

  it('opens an event with its correlated events and ledger links', async () => {
    api.search.mockResolvedValue({ items: [event()], nextBefore: null });
    api.getEvent.mockResolvedValue({
      event: event(),
      related: [event({ id: 9, eventId: 'e-9', name: 'api.call_failed', outcome: 'Failed', reasonCode: 'http_500' })],
      links: { ledgerTransactionPublicIds: ['tx-1'], siegeMatchId: 12 },
    });
    render(<OwnerTelemetryPage />);
    await userEvent.click(screen.getByRole('button', { name: /search events/i }));
    await userEvent.click(await screen.findByText('siege.lobby_join_attempt'));

    const drawer = await screen.findByRole('dialog', { name: 'Event detail' });
    expect(drawer).toHaveTextContent('alice (#7)');
    expect(drawer).toHaveTextContent('Siege match #12');
    expect(screen.getByRole('link', { name: 'Ledger tx-1' })).toHaveAttribute('href', '/admin/economy/transactions/tx-1');
    expect(drawer).toHaveTextContent('api.call_failed');

    await userEvent.click(screen.getByRole('button', { name: /everything with correlation corr-1/i }));
    expect(api.search).toHaveBeenLastCalledWith({ correlationId: 'corr-1' });
  });

  it('shows a player timeline with ledger and Siege rows', async () => {
    api.getTimeline.mockResolvedValue({
      userId: 7, username: 'alice', from: 'a', to: 'b', truncated: true,
      items: [
        { kind: 'siege', at: '2026-10-03T10:00:00Z', siege: { matchId: 12, status: 'Completed', kind: 'joined', teamId: 2, kills: 3, deaths: 1, captures: 0 } },
        { kind: 'event', at: '2026-10-03T10:01:00Z', event: event({ name: 'siege.match_join', outcome: 'Succeeded' }) },
        { kind: 'ledger', at: '2026-10-03T10:30:00Z', ledger: { publicId: 'tx-9', reasonCode: 'SIEGE_REWARD', currency: 'Coins', delta: 50 } },
      ],
    });
    render(<OwnerTelemetryPage />);

    await userEvent.click(screen.getByRole('button', { name: /player timeline/i }));
    expect(await screen.findByText('Enter a player id for the timeline.')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Player id'), '7');
    await userEvent.click(screen.getByRole('button', { name: /player timeline/i }));

    const timeline = await screen.findByRole('region', { name: 'Timeline' });
    expect(timeline).toHaveTextContent('Match #12 joined');
    expect(timeline).toHaveTextContent('siege.match_join');
    expect(timeline).toHaveTextContent('+50 Coins');
    expect(timeline).toHaveTextContent('narrow the time range');
    expect(api.getTimeline).toHaveBeenCalledWith(7, undefined, undefined);
  });

  it('shows the owner-only notice when the API refuses (wildcard grant)', async () => {
    api.getHealth.mockImplementation(forbidden);
    render(<OwnerTelemetryPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Owner only');
    expect(screen.getByRole('alert')).toHaveTextContent('knk.owner.telemetry.view');
  });

  it('manages test runs; hides the panel without the manage node', async () => {
    api.startTestRun.mockResolvedValue({ id: 4, name: 'Run 2', startedAt: 'x', createdByUserId: 1 });
    api.endTestRun.mockResolvedValue({ id: 3, name: 'Siege alpha', startedAt: 'x', endedAt: 'y', createdByUserId: 1 });
    render(<OwnerTelemetryPage />);

    expect(await screen.findByText('#3 Siege alpha')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Test run name'), 'Run 2');
    await userEvent.click(screen.getByRole('button', { name: 'Start' }));
    expect(api.startTestRun).toHaveBeenCalledWith('Run 2');
    await userEvent.click(screen.getByRole('button', { name: 'End' }));
    expect(api.endTestRun).toHaveBeenCalledWith(3);

    api.getTestRuns.mockImplementation(forbidden);
    const { unmount } = render(<OwnerTelemetryPage />);
    expect(await screen.findByText(/need/)).toHaveTextContent('knk.owner.telemetry.manage');
    unmount();
  });
});
