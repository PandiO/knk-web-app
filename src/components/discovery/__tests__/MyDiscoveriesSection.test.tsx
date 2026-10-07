import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MyDiscoveriesSection, RECENT_DISCOVERIES } from '../MyDiscoveriesSection';
import { discoveryClient } from '../../../apiClients/discoveryClient';
import { DiscoverySummaryDto } from '../../../types/dtos/discovery/DiscoveryDtos';

jest.mock('../../../apiClients/discoveryClient', () => ({
  discoveryClient: { getSummary: jest.fn(), getProgress: jest.fn() },
}));

const mockedSummary = discoveryClient.getSummary as jest.Mock;
const mockedProgress = discoveryClient.getProgress as jest.Mock;

const summary: DiscoverySummaryDto = {
  byType: [
    { domainType: 'Town', discovered: 2, total: 4 },
    { domainType: 'District', discovered: 0, total: 0 },
  ],
  latest: null,
  totalDiscovered: 2,
  totalCoins: 5200,
  totalGems: 20,
  totalExp: 125,
};

describe('MyDiscoveriesSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedSummary.mockResolvedValue(summary);
  });

  it('shows the per-type counts and the most recent discoveries', async () => {
    mockedProgress.mockResolvedValue({
      items: [{
        domainId: 3, name: 'Kaer Morhen', domainType: 'Town', parentName: null, discovered: true,
        discoveredAt: '2026-09-26T12:00:00Z', coins: 2600, gems: 10, exp: 0,
      }],
      totalCount: 1, pageNumber: 1, pageSize: RECENT_DISCOVERIES,
    });
    render(<MyDiscoveriesSection userId={7} />);

    expect(await screen.findByText('Kaer Morhen')).toBeInTheDocument();
    expect(mockedSummary).toHaveBeenCalledWith(7);
    expect(mockedProgress).toHaveBeenCalledWith(7, {
      pageNumber: 1,
      pageSize: RECENT_DISCOVERIES,
      filters: { status: 'discovered' },
      sortBy: 'discoveredAt',
      sortDescending: true,
    });
    expect(screen.getByText('2 / 4')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'District discovered' })).toHaveAttribute('aria-valuenow', '0');
    expect(screen.getByText(/2 places discovered/)).toHaveTextContent('earned 5,200 coins, 20 gems, 125 XP');
    expect(screen.getByText(/\+2,600 coins, \+10 gems$/)).toBeInTheDocument();
  });

  it('leaves out a type switched off in the Discovery settings, without a Disabled tag', async () => {
    mockedSummary.mockResolvedValue({
      ...summary,
      byType: [...summary.byType, { domainType: 'Structure', discovered: 0, total: 0, enabled: false }],
    });
    mockedProgress.mockResolvedValue({ items: [], totalCount: 0, pageNumber: 1, pageSize: RECENT_DISCOVERIES });
    render(<MyDiscoveriesSection userId={7} />);

    expect(await screen.findByRole('progressbar', { name: 'Town discovered' })).toBeInTheDocument();
    expect(screen.queryByRole('progressbar', { name: 'Structure discovered' })).not.toBeInTheDocument();
    expect(screen.queryByText('Disabled')).not.toBeInTheDocument();
  });

  it('invites the player to explore when nothing is discovered yet', async () => {
    mockedSummary.mockResolvedValue({ ...summary, totalDiscovered: 0, totalCoins: 0, totalGems: 0, totalExp: 0 });
    mockedProgress.mockResolvedValue({ items: [], totalCount: 0, pageNumber: 1, pageSize: RECENT_DISCOVERIES });
    render(<MyDiscoveriesSection userId={7} />);

    expect(await screen.findByText(/haven't discovered any places yet/)).toBeInTheDocument();
    expect(screen.getByText('0 places discovered')).toBeInTheDocument();
  });

  it('shows an error when loading fails', async () => {
    mockedProgress.mockRejectedValue(new Error('down'));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    render(<MyDiscoveriesSection userId={7} />);

    expect(await screen.findByText('Could not load your discoveries.')).toBeInTheDocument();
    (console.error as jest.Mock).mockRestore();
  });
});
