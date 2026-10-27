import React from 'react';
import { render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SiegeMatchPage } from '../SiegeMatchPage';
import { siegeMatchClient } from '../../../apiClients/siegeMatchClient';
import { SiegeMatchPublicDto } from '../../../types/dtos/siege/SiegeMatchDtos';

let mockId = '41';
// virtual: CRA's Jest resolver can't resolve react-router-dom's package exports
jest.mock('react-router-dom', () => ({
  Link: ({ to, children, ...rest }: { to: string; children: React.ReactNode }) => <a href={to} {...rest}>{children}</a>,
  useParams: () => ({ id: mockId }),
}), { virtual: true });
jest.mock('../../../apiClients/siegeMatchClient', () => ({ siegeMatchClient: { getMatch: jest.fn() } }));

const mockedMatch = siegeMatchClient.getMatch as jest.Mock;

const MATCH: SiegeMatchPublicDto = {
  id: 41, siegeLobbyName: 'Siege - Cinix', siegeScenarioName: 'Siege of Cinix', status: 'Completed',
  startedAt: '2026-10-25T19:00:00Z', endedAt: '2026-10-25T19:10:00Z', endReason: 'InstantVictory', winningAllianceGroup: 2,
  teams: [
    { id: 201, name: 'Cinix Garrison', chatColor: 'GOLD', role: 'Defender', allianceGroup: 1, outcome: 'Loss' },
    { id: 202, name: 'Raiders', chatColor: 'RED', role: 'Attacker', allianceGroup: 2, outcome: 'Win' },
  ],
  participants: [
    { userId: 1, username: 'Alice', siegeTeamId: 201, outcome: 'Loss', presentAtEnd: true, kills: null, deaths: null,
      activeSeconds: 600, matchSeconds: 600, expAwarded: 3 },
    { userId: 3, username: 'Carol', siegeTeamId: 202, outcome: 'Win', presentAtEnd: true, kills: 4, deaths: 0, highestKillStreak: 4,
      captures: 2, gateDamage: 250, activeSeconds: 590, matchSeconds: 600, coinsAwarded: 300, gemsAwarded: 1, expAwarded: 31 },
    { userId: 4, username: 'Dave', siegeTeamId: 202, outcome: 'Left', presentAtEnd: false, leftAt: '2026-10-25T19:05:00Z',
      kills: null, deaths: null, activeSeconds: 300, matchSeconds: 300, expAwarded: 0 },
  ],
  objectives: [
    { siegeObjectiveId: 501, name: 'Keep', instantVictory: true, finalHolderTeamId: 202,
      captures: [{ siegeTeamId: 202, capturedByUserId: 3, capturedByUsername: 'Carol', capturedAt: '2026-10-25T19:09:00Z' }] },
  ],
};

describe('SiegeMatchPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockId = '41';
    mockedMatch.mockResolvedValue(MATCH);
  });

  it('shows the result, both teams with their players and the objectives', async () => {
    render(<SiegeMatchPage />);

    expect(await screen.findByRole('heading', { name: 'Siege of Cinix' })).toBeInTheDocument();
    expect(mockedMatch).toHaveBeenCalledWith(41);
    expect(screen.getByText('Raiders won')).toBeInTheDocument();
    expect(screen.getByText('Main objective captured')).toBeInTheDocument();

    const raiders = screen.getByRole('table', { name: 'Raiders players' });
    expect(within(raiders).getByRole('link', { name: 'Carol' })).toHaveAttribute('href', '/players/Carol');
    expect(raiders).toHaveTextContent('250');
    expect(raiders).toHaveTextContent('left early');

    const garrison = screen.getByRole('table', { name: 'Cinix Garrison players' });
    expect(within(garrison).getAllByText('Hidden').length).toBeGreaterThan(0);

    expect(screen.getByRole('list', { name: 'Objectives' })).toHaveTextContent('Keep');
    expect(screen.getByRole('list', { name: 'Objectives' })).toHaveTextContent('by Carol');
  });

  it('says when there is no such finished match', async () => {
    mockedMatch.mockRejectedValue(Object.assign(new Error('nf'), { status: 404 }));

    render(<SiegeMatchPage />);

    expect(await screen.findByText('No finished siege match with this number.')).toBeInTheDocument();
  });

  it('does not ask the API for an id that is not a number', async () => {
    mockId = 'abc';

    render(<SiegeMatchPage />);

    expect(await screen.findByText('This isn\'t a siege match.')).toBeInTheDocument();
    expect(mockedMatch).not.toHaveBeenCalled();
  });
});
