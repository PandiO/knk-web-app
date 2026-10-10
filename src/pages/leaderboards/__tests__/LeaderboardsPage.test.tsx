import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { LEADERBOARD_TOP, LeaderboardsPage } from '../LeaderboardsPage';
import { leaderboardClient } from '../../../apiClients/leaderboardClient';
import { LeaderboardViewDto } from '../../../types/dtos/leaderboards/LeaderboardDtos';

// virtual: CRA's Jest resolver can't resolve react-router-dom's package exports
jest.mock('react-router-dom', () => ({
  Link: ({ to, children, ...rest }: { to: string; children: React.ReactNode }) => <a href={to} {...rest}>{children}</a>,
}), { virtual: true });
jest.mock('../../../apiClients/leaderboardClient', () => ({
  leaderboardClient: { getBoards: jest.fn(), getBoard: jest.fn() },
}));

const mockedBoards = leaderboardClient.getBoards as jest.Mock;
const mockedBoard = leaderboardClient.getBoard as jest.Mock;

const playtime = (period: LeaderboardViewDto['period'], viewer: LeaderboardViewDto['viewer'] = null): LeaderboardViewDto => ({
  boardKey: 'active_playtime',
  label: 'Active playtime',
  unit: 'Seconds',
  period,
  generatedAt: '2026-10-03T10:00:00Z',
  totalRanked: 3,
  entries: [
    { rank: 1, userId: 4, username: 'dave', value: 7200, rawValue: 7200 },
    { rank: 1, userId: 9, username: 'alice', value: 7200, rawValue: 7200 },
    { rank: 3, userId: 2, username: 'bob', value: 60, rawValue: 60 },
  ],
  viewer,
});

describe('LeaderboardsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedBoards.mockResolvedValue([
      { boardKey: 'active_playtime', metric: 'active_playtime', label: 'Active playtime', unit: 'Seconds', periods: ['weekly'], alwaysPublic: true },
      { boardKey: 'pvp_kills@siege', metric: 'pvp_kills', context: 'siege', label: 'Player kills — Siege', unit: 'Count', periods: ['weekly'], alwaysPublic: false },
    ]);
    mockedBoard.mockImplementation((key: string, period: LeaderboardViewDto['period']) =>
      key === 'active_playtime'
        ? Promise.resolve(playtime(period, period === 'lifetime' ? { rank: 1, value: 7200, rawValue: 7200 } : null))
        : Promise.reject(Object.assign(new Error('sign in'), { status: 401 })));
  });

  it('shows the first board this week with shared ranks and links to the players', async () => {
    render(<LeaderboardsPage />);

    expect(await screen.findByRole('link', { name: 'dave' })).toHaveAttribute('href', '/players/dave');
    expect(mockedBoard).toHaveBeenCalledWith('active_playtime', 'weekly', LEADERBOARD_TOP);
    expect(screen.getAllByText('#1')).toHaveLength(2);
    expect(screen.getByText('#3')).toBeInTheDocument();
    expect(screen.getAllByText('2h 0m')).toHaveLength(2);
  });

  it('switches period and shows the viewer\'s own rank', async () => {
    render(<LeaderboardsPage />);
    await screen.findByRole('link', { name: 'dave' });

    await userEvent.click(screen.getByRole('tab', { name: 'All time' }));

    expect(mockedBoard).toHaveBeenLastCalledWith('active_playtime', 'lifetime', LEADERBOARD_TOP);
    expect(await screen.findByText(/Your rank:/)).toHaveTextContent('Your rank: #1 of 3');
  });

  it('asks a signed-out visitor to sign in for a configurable board', async () => {
    render(<LeaderboardsPage />);
    await screen.findByRole('link', { name: 'dave' });

    await userEvent.click(screen.getByRole('button', { name: 'Player kills — Siege' }));

    expect(await screen.findByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/auth/login');
  });

  it('says when a board has not been computed yet', async () => {
    mockedBoard.mockResolvedValue({ ...playtime('weekly'), generatedAt: null, entries: [], totalRanked: 0 });
    render(<LeaderboardsPage />);

    expect(await screen.findByText('Not computed yet - check back in a few minutes.')).toBeInTheDocument();
  });
});
