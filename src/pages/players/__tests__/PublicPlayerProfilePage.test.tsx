import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PublicPlayerProfilePage } from '../PublicPlayerProfilePage';
import { playerClient } from '../../../apiClients/playerClient';
import { statisticsClient } from '../../../apiClients/statisticsClient';
import { PlayerStatisticsDto } from '../../../types/dtos/statistics/StatisticsDtos';

let mockUsername = 'bob';
// virtual: CRA's Jest resolver can't resolve react-router-dom's package exports
jest.mock('react-router-dom', () => ({
  Link: ({ to, children, ...rest }: { to: string; children: React.ReactNode }) => <a href={to} {...rest}>{children}</a>,
  useParams: () => ({ username: mockUsername }),
}), { virtual: true });
jest.mock('../../../apiClients/playerClient', () => ({ playerClient: { getByName: jest.fn() } }));
jest.mock('../../../apiClients/statisticsClient', () => ({
  statisticsClient: { getCatalog: jest.fn(), getUserStatistics: jest.fn(), getTitleHistory: jest.fn() },
}));

const mockedProfile = playerClient.getByName as jest.Mock;
const mockedCatalog = statisticsClient.getCatalog as jest.Mock;
const mockedStatistics = statisticsClient.getUserStatistics as jest.Mock;
const mockedHistory = statisticsClient.getTitleHistory as jest.Mock;

const anonymousView: PlayerStatisticsDto = {
  userId: 2,
  username: 'Bob',
  period: 'lifetime',
  timeZone: 'Europe/Amsterdam',
  viewer: 'anonymous',
  profile: { titleName: 'Knight', experience: 4000, coins: 10, gems: 3, activePlaytimeSeconds: 90061, afkSeconds: 120 },
  metrics: [
    { key: 'active_playtime', value: 90061, rawValue: 90061, unit: 'Seconds', aggregation: 'Sum' },
    { key: 'xp_gained', value: 300, rawValue: 300, unit: 'Count', aggregation: 'Sum' },
  ],
};

describe('PublicPlayerProfilePage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUsername = 'bob';
    mockedProfile.mockResolvedValue({
      userId: 2, username: 'Bob', titleName: 'Knight', experience: 4000, coins: 10, gems: 3,
      firstJoinedAt: '2026-09-01T10:00:00Z', activePlaytimeSeconds: 90061, afkSeconds: 120,
    });
    mockedCatalog.mockResolvedValue({
      timeZone: 'Europe/Amsterdam', settings: [],
      metrics: [
        { key: 'active_playtime', aggregation: 'Sum', unit: 'Seconds', contextual: false, visibility: 'AlwaysPublic', group: 'activity', label: 'Active playtime' },
        { key: 'xp_gained', aggregation: 'Sum', unit: 'Count', contextual: false, visibility: 'AlwaysPublic', group: 'progression', label: 'XP gained' },
      ],
      groups: [{ key: 'activity', label: 'Activity', settingKeys: [] }, { key: 'progression', label: 'Progression', settingKeys: [] }],
    });
    mockedStatistics.mockResolvedValue(anonymousView);
    mockedHistory.mockRejectedValue(Object.assign(new Error('hidden'), { status: 401 }));
  });

  it('shows the always-public profile and what the API returns for a signed-out visitor', async () => {
    render(<PublicPlayerProfilePage />);

    expect(await screen.findByRole('heading', { name: 'Bob' })).toBeInTheDocument();
    expect(mockedProfile).toHaveBeenCalledWith('bob');
    expect(screen.getByText('4,000')).toBeInTheDocument();
    expect(screen.getAllByText('1d 1h').length).toBeGreaterThan(0);
    expect(await screen.findByText('Sign in to see the statistics this player shares with everyone.')).toBeInTheDocument();
    expect(mockedStatistics).toHaveBeenCalledWith(2, 'lifetime');
    expect(await screen.findByText('Bob keeps the title history private.')).toBeInTheDocument();
    expect(screen.queryByText(/online/i)).not.toBeInTheDocument();
  });

  it('shows what another signed-in player shares', async () => {
    mockedStatistics.mockResolvedValue({
      ...anonymousView,
      viewer: 'signedIn',
      metrics: [...anonymousView.metrics, { key: 'pvp_kills', value: null, rawValue: null, unit: 'Count', aggregation: 'Sum', contexts: [{ context: 'open_world', value: 4, rawValue: 4 }] }],
    });
    mockedCatalog.mockResolvedValue({
      timeZone: 'Europe/Amsterdam', settings: [],
      metrics: [{ key: 'pvp_kills', settingKey: 'pvp_kills', aggregation: 'Sum', unit: 'Count', contextual: true, visibility: 'Configurable', group: 'combat', label: 'Player kills' }],
      groups: [{ key: 'combat', label: 'Combat', settingKeys: [] }],
    });

    render(<PublicPlayerProfilePage />);

    expect(await screen.findByText('Total hidden')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Open world' })).toHaveAttribute('aria-valuenow', '4');
    expect(screen.queryByText(/keeps their other statistics private/)).not.toBeInTheDocument();
  });

  it('says when there is no such player', async () => {
    mockUsername = 'nobody';
    mockedProfile.mockRejectedValue(Object.assign(new Error('not found'), { status: 404 }));

    render(<PublicPlayerProfilePage />);

    expect(await screen.findByText('No player named "nobody".')).toBeInTheDocument();
    expect(mockedStatistics).not.toHaveBeenCalled();
  });
});
