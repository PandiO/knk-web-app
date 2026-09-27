import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { DISCOVERIES_PAGE_SIZE, PlayerDiscoveriesPanel } from '../PlayerDiscoveriesPanel';
import { discoveryClient } from '../../../apiClients/discoveryClient';
import { usePermission } from '../../../hooks/useStaffAccess';
import {
  DISCOVERY_ADMIN_NODE,
  DiscoveryProgressRowDto,
  DiscoverySummaryDto,
} from '../../../types/dtos/discovery/DiscoveryDtos';

jest.mock('../../../apiClients/discoveryClient', () => ({
  discoveryClient: { getSummary: jest.fn(), getProgress: jest.fn(), reset: jest.fn() },
}));
jest.mock('../../../hooks/useStaffAccess', () => ({
  usePermission: jest.fn(),
}));

const mockedSummary = discoveryClient.getSummary as jest.Mock;
const mockedProgress = discoveryClient.getProgress as jest.Mock;
const mockedReset = discoveryClient.reset as jest.Mock;
const mockedUsePermission = usePermission as jest.Mock;

const PLAYER = 7;

const row = (overrides: Partial<DiscoveryProgressRowDto>): DiscoveryProgressRowDto => ({
  domainId: 1,
  name: 'Rivia',
  domainType: 'Town',
  parentName: null,
  discovered: true,
  discoveredAt: '2026-09-26T12:00:00Z',
  coins: 2600,
  gems: 7,
  exp: 40,
  ...overrides,
});

const summary: DiscoverySummaryDto = {
  byType: [
    { domainType: 'Town', discovered: 1, total: 4 },
    { domainType: 'District', discovered: 1, total: 10 },
    { domainType: 'Structure', discovered: 0, total: 50 },
    { domainType: 'GateStructure', discovered: 0, total: 6 },
  ],
  latest: null,
  totalDiscovered: 2,
  totalCoins: 3000,
  totalGems: 9,
  totalExp: 55,
};

const page = (items: DiscoveryProgressRowDto[], totalCount = items.length, pageNumber = 1) => ({
  items, totalCount, pageNumber, pageSize: DISCOVERIES_PAGE_SIZE,
});

const firstQuery = {
  pageNumber: 1,
  pageSize: DISCOVERIES_PAGE_SIZE,
  filters: { status: 'discovered' },
  sortBy: 'discoveredAt',
  sortDescending: true,
};

describe('PlayerDiscoveriesPanel', () => {
  let confirmSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedUsePermission.mockReturnValue({ allowed: true, isChecking: false });
    mockedSummary.mockResolvedValue(summary);
    mockedProgress.mockResolvedValue(page([
      row({ domainId: 2, name: 'Old Quarter', domainType: 'District', parentName: 'Rivia', coins: 400, gems: 2, exp: 15 }),
      row({ domainId: 1 }),
    ]));
    confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
  });

  afterEach(() => {
    confirmSpy.mockRestore();
  });

  it('is not shown (and reads nothing) without knk.admin.discovery', () => {
    mockedUsePermission.mockReturnValue({ allowed: false, isChecking: false });
    const { container } = render(<PlayerDiscoveriesPanel userId={PLAYER} />);

    expect(mockedUsePermission).toHaveBeenCalledWith(DISCOVERY_ADMIN_NODE);
    expect(container).toBeEmptyDOMElement();
    expect(mockedProgress).not.toHaveBeenCalled();
  });

  it('hides itself when the API refuses with 403', async () => {
    mockedSummary.mockRejectedValue(Object.assign(new Error('Forbidden'), { status: 403 }));
    const { container } = render(<PlayerDiscoveriesPanel userId={PLAYER} />);
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('shows per-type progress and the discovered places, newest first, with their rewards', async () => {
    render(<PlayerDiscoveriesPanel userId={PLAYER} />);

    expect(await screen.findByText('Old Quarter')).toBeInTheDocument();
    expect(mockedProgress).toHaveBeenCalledWith(PLAYER, firstQuery);
    expect(mockedSummary).toHaveBeenCalledWith(PLAYER);

    expect(screen.getByRole('progressbar', { name: 'Town discovered' })).toHaveAttribute('aria-valuenow', '1');
    expect(screen.getByRole('progressbar', { name: 'Gate discovered' })).toHaveAttribute('aria-valuemax', '6');
    expect(screen.getByText('+400 coins, +2 gems, +15 XP')).toBeInTheDocument();

    const rows = screen.getAllByRole('row').slice(1);
    expect(within(rows[0]).getByText('Old Quarter')).toBeInTheDocument();
    expect(within(rows[0]).getByText('Rivia')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Rivia')).toBeInTheDocument();
  });

  it('filters by type', async () => {
    render(<PlayerDiscoveriesPanel userId={PLAYER} />);
    await screen.findByText('Old Quarter');

    await userEvent.selectOptions(screen.getByLabelText('Filter by type'), 'District');

    await waitFor(() => expect(mockedProgress).toHaveBeenLastCalledWith(PLAYER, {
      ...firstQuery,
      filters: { status: 'discovered', domainType: 'District' },
    }));
  });

  it('pages through the discoveries', async () => {
    mockedProgress.mockResolvedValue(page([row({})], 30));
    render(<PlayerDiscoveriesPanel userId={PLAYER} />);

    expect(await screen.findByText('Page 1 of 2')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }));

    await waitFor(() => expect(mockedProgress).toHaveBeenLastCalledWith(PLAYER, { ...firstQuery, pageNumber: 2 }));
  });

  it('resets a discovery after confirmation, then reloads and reports it', async () => {
    mockedReset.mockResolvedValue(null);
    const onReset = jest.fn();
    render(<PlayerDiscoveriesPanel userId={PLAYER} onReset={onReset} />);
    await screen.findByText('Old Quarter');

    const row = screen.getAllByRole('row')[1];
    await userEvent.click(within(row).getByRole('button', { name: /Reset/ }));

    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('Old Quarter'));
    await waitFor(() => expect(mockedReset).toHaveBeenCalledWith(PLAYER, 2));
    await waitFor(() => expect(onReset).toHaveBeenCalled());
    expect(mockedProgress).toHaveBeenCalledTimes(2);
  });

  it('does nothing when the reset is not confirmed', async () => {
    confirmSpy.mockReturnValue(false);
    render(<PlayerDiscoveriesPanel userId={PLAYER} />);
    await screen.findByText('Old Quarter');

    await userEvent.click(within(screen.getAllByRole('row')[1]).getByRole('button', { name: /Reset/ }));

    expect(mockedReset).not.toHaveBeenCalled();
  });

  it("shows the API's reason when a reset is refused", async () => {
    mockedReset.mockRejectedValue(Object.assign(new Error('User 7 has not discovered domain 2'), { status: 404 }));
    render(<PlayerDiscoveriesPanel userId={PLAYER} />);
    await screen.findByText('Old Quarter');

    await userEvent.click(within(screen.getAllByRole('row')[1]).getByRole('button', { name: /Reset/ }));

    expect(await screen.findByText('User 7 has not discovered domain 2')).toBeInTheDocument();
  });

  it('says so when the player has no discoveries', async () => {
    mockedProgress.mockResolvedValue(page([]));
    render(<PlayerDiscoveriesPanel userId={PLAYER} />);
    expect(await screen.findByText('No discoveries yet.')).toBeInTheDocument();
  });
});
