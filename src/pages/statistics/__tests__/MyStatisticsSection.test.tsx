import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { MyStatisticsSection } from '../MyStatisticsSection';
import { statisticsClient } from '../../../apiClients/statisticsClient';
import { PlayerStatisticsDto, StatisticsCatalogDto } from '../../../types/dtos/statistics/StatisticsDtos';

// virtual: CRA's Jest resolver can't resolve react-router-dom's package exports
jest.mock('react-router-dom', () => ({
  Link: ({ to, children, ...rest }: { to: string; children: React.ReactNode }) => <a href={to} {...rest}>{children}</a>,
}), { virtual: true });
jest.mock('../../../apiClients/statisticsClient', () => ({
  statisticsClient: { getCatalog: jest.fn(), getUserStatistics: jest.fn(), getTitleHistory: jest.fn(), getVisibility: jest.fn() },
}));

const mockedCatalog = statisticsClient.getCatalog as jest.Mock;
const mockedStatistics = statisticsClient.getUserStatistics as jest.Mock;
const mockedHistory = statisticsClient.getTitleHistory as jest.Mock;
const mockedVisibility = statisticsClient.getVisibility as jest.Mock;

const catalog: StatisticsCatalogDto = {
  timeZone: 'Europe/Amsterdam',
  metrics: [
    { key: 'active_playtime', aggregation: 'Sum', unit: 'Seconds', contextual: false, visibility: 'AlwaysPublic', group: 'activity', label: 'Active playtime' },
    { key: 'pvp_kills', settingKey: 'pvp_kills', aggregation: 'Sum', unit: 'Count', contextual: true, visibility: 'Configurable', group: 'combat', label: 'Player kills' },
    { key: 'distance.foot', settingKey: 'distance.foot', aggregation: 'Sum', unit: 'Blocks', contextual: false, visibility: 'Configurable', group: 'exploration', label: 'Distance on foot' },
    { key: 'xp_gained', aggregation: 'Sum', unit: 'Count', contextual: false, visibility: 'AlwaysPublic', group: 'progression', label: 'XP gained' },
  ],
  settings: [],
  groups: [
    { key: 'activity', label: 'Activity', settingKeys: [] },
    { key: 'combat', label: 'Combat', settingKeys: [] },
    { key: 'exploration', label: 'Exploration', settingKeys: [] },
    { key: 'progression', label: 'Progression', settingKeys: [] },
  ],
};

const statistics = (period: PlayerStatisticsDto['period']): PlayerStatisticsDto => ({
  userId: 7,
  username: 'Alice',
  period,
  timeZone: 'Europe/Amsterdam',
  viewer: 'self',
  profile: { titleName: 'Squire', experience: 1200, coins: 5, gems: 1, firstJoinedAt: '2026-09-01T10:00:00Z', activePlaytimeSeconds: 7500, afkSeconds: 60 },
  metrics: [
    { key: 'active_playtime', value: period === 'week' ? 600 : 7500, rawValue: 7500, unit: 'Seconds', aggregation: 'Sum' },
    {
      key: 'pvp_kills', settingKey: 'pvp_kills', value: 12, rawValue: 12, unit: 'Count', aggregation: 'Sum',
      contexts: [{ context: 'open_world', value: 5, rawValue: 5 }, { context: 'siege', value: 7, rawValue: 7 }],
    },
    { key: 'distance.foot', settingKey: 'distance.foot', value: 1234.9, rawValue: 1234.9, unit: 'Blocks', aggregation: 'Sum' },
  ],
  economy: { coinsEarned: 100, coinsSpent: 20, gemsEarned: 0, gemsSpent: 0 },
  discoveries: null,
});

describe('MyStatisticsSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedCatalog.mockResolvedValue(catalog);
    mockedStatistics.mockImplementation((_id: number, period: PlayerStatisticsDto['period']) => Promise.resolve(statistics(period)));
    mockedHistory.mockResolvedValue({
      items: [{ changedAt: '2026-10-02T10:00:00Z', fromTitleName: 'Serf', toTitleName: 'Squire', direction: 'Promotion' }],
      totalCount: 1, pageNumber: 1, pageSize: 10,
    });
    mockedVisibility.mockResolvedValue({ userId: 7, friendsAvailable: false, settings: [] });
  });

  it('shows the profile, groups with per-context bars, economy and the title history', async () => {
    render(<MyStatisticsSection userId={7} username="Alice" />);

    expect(await screen.findByText('Squire', { selector: 'dd' })).toBeInTheDocument();
    expect(screen.getByText('2h 5m', { selector: 'dd' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Combat' })).toHaveTextContent('Player kills12');
    expect(screen.getByRole('progressbar', { name: 'Open world' })).toHaveAttribute('aria-valuenow', '5');
    expect(screen.getByRole('progressbar', { name: 'Siege' })).toHaveAttribute('aria-valuenow', '7');
    expect(screen.getByText('1,234 blocks')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Coins earned' })).toHaveAttribute('aria-valuenow', '100');
    expect(await screen.findByText('Squire', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Public profile' })).toHaveAttribute('href', '/players/Alice');
    expect(mockedStatistics).toHaveBeenCalledWith(7, 'lifetime');
  });

  it('switches period with the tabs', async () => {
    render(<MyStatisticsSection userId={7} />);
    await screen.findByText('Player kills');

    await userEvent.click(screen.getByRole('tab', { name: 'This week' }));

    expect(mockedStatistics).toHaveBeenLastCalledWith(7, 'week');
    expect(await screen.findByText('10m')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'This week' })).toHaveAttribute('aria-selected', 'true');
  });

  it('opens the visibility settings on demand', async () => {
    render(<MyStatisticsSection userId={7} />);
    expect(mockedVisibility).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: /Who may see my statistics/ }));

    expect(mockedVisibility).toHaveBeenCalledWith(7);
  });

  it('says so when the statistics cannot be loaded', async () => {
    mockedStatistics.mockRejectedValue(new Error('down'));
    render(<MyStatisticsSection userId={7} />);

    expect(await screen.findByText('Could not load the statistics.')).toBeInTheDocument();
  });
});
