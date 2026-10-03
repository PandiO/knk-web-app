import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { OwnerAnalyticsPage } from '../OwnerAnalyticsPage';
import { worldAnalyticsClient } from '../../../apiClients/worldAnalyticsClient';
import { heatColor, heatmapLayout } from '../../../components/owner/HeatmapCanvas';
import { HeatmapDto } from '../../../types/dtos/analytics/WorldAnalyticsDtos';

jest.mock('react-router-dom', () => ({
  Link: ({ to, children, ...rest }: { to: string; children: React.ReactNode }) => <a href={to} {...rest}>{children}</a>,
}), { virtual: true });
jest.mock('../../../apiClients/worldAnalyticsClient', () => ({
  worldAnalyticsClient: { getWorlds: jest.fn(), getHeatmap: jest.fn(), getMenuFunnels: jest.fn(), getDomains: jest.fn() },
}));

const api = worldAnalyticsClient as jest.Mocked<typeof worldAnalyticsClient>;

const heatmap: HeatmapDto = {
  world: 'world',
  cellSize: 16,
  from: '2026-09-27',
  to: '2026-10-03',
  cells: [{ x: 0, z: 0, samples: 40 }, { x: -2, z: 3, samples: 4 }],
  maxSamples: 40,
  totalSamples: 44,
  truncated: false,
};

describe('OwnerAnalyticsPage (KNG-34 link 7)', () => {
  let getContext: jest.SpyInstance;
  const fillRect = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    // jsdom has no canvas: hand the component a recording 2d context.
    getContext = jest.spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockImplementation(() => ({ clearRect: jest.fn(), fillRect, fillStyle: '' }) as unknown as CanvasRenderingContext2D);
    api.getWorlds.mockResolvedValue([
      { world: 'world', cellSizes: [16], samples: 44 },
      { world: 'world_nether', cellSizes: [16], samples: 3 },
    ]);
    api.getHeatmap.mockResolvedValue(heatmap);
    api.getMenuFunnels.mockResolvedValue({
      from: '2026-09-27',
      to: '2026-10-03',
      menus: [{
        menuKey: 'profile.main', opened: 20, back: 2, closed: 15,
        steps: [
          { step: 'opened', outcome: 'info', count: 20 },
          { step: 'action:menu.open', outcome: 'succeeded', count: 10 },
          { step: 'action:menu.open', outcome: 'denied', count: 3 },
          { step: 'action:kits.claim', outcome: 'failed', count: 1 },
        ],
      }],
    });
    api.getDomains.mockResolvedValue({
      from: '2026-09-27',
      to: '2026-10-03',
      domains: [
        { domainId: 7, name: 'Aldmoor', regionId: 'aldmoor', enter: 30, leave: 28, discover: 4, visitorDays: 12, peakDailyVisitors: 5 },
        { domainId: 99, name: null, enter: 1, leave: 0, discover: 0, visitorDays: 1, peakDailyVisitors: 1 },
      ],
    });
  });

  afterEach(() => getContext.mockRestore());

  it('loads the worlds, draws the busiest world and shows funnels and domains', async () => {
    render(<OwnerAnalyticsPage />);

    expect(await screen.findByRole('img', { name: /Movement heatmap of world: 2 cells of 16 blocks, busiest 40/ })).toBeInTheDocument();
    expect(api.getHeatmap).toHaveBeenCalledWith('world', expect.objectContaining({ from: expect.any(String), to: expect.any(String) }), undefined);
    expect(fillRect).toHaveBeenCalledTimes(3); // background + 2 cells
    expect(screen.getByText(/44 samples in 2 cells of 16 blocks/)).toBeInTheDocument();

    const funnels = screen.getByRole('region', { name: 'Menu funnels' });
    const row = within(funnels).getByText('profile.main').closest('tr')!;
    expect(row).toHaveTextContent(/profile\.main\s*20\s*10\s*3\s*1\s*2\s*15/);
    await userEvent.click(within(funnels).getByRole('button', { name: 'profile.main' }));
    const steps = within(funnels).getByRole('list', { name: 'Steps of profile.main' });
    expect(steps).toHaveTextContent('action:menu.open');
    expect(steps).toHaveTextContent('50%');

    const domains = screen.getByRole('region', { name: 'Domain interactions' });
    expect(within(domains).getByText('Aldmoor')).toBeInTheDocument();
    expect(within(domains).getByText('deleted domain')).toBeInTheDocument();
    expect(within(domains).getByText('Aldmoor').closest('tr')).toHaveTextContent(/30\s*28\s*4\s*12\s*5/);
  });

  it('switches world and cell size, and applies a new range', async () => {
    render(<OwnerAnalyticsPage />);
    await screen.findByRole('img');

    await userEvent.selectOptions(screen.getByLabelText('World'), 'world_nether');
    expect(api.getHeatmap).toHaveBeenLastCalledWith('world_nether', expect.anything(), undefined);
    await userEvent.selectOptions(screen.getByLabelText('Cell size'), '64');
    expect(api.getHeatmap).toHaveBeenLastCalledWith('world_nether', expect.anything(), 64);

    const from = screen.getByLabelText('From');
    await userEvent.clear(from);
    await userEvent.type(from, '2026-09-01');
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(api.getWorlds).toHaveBeenLastCalledWith(expect.objectContaining({ from: '2026-09-01' }));
    expect(api.getMenuFunnels).toHaveBeenLastCalledWith(expect.objectContaining({ from: '2026-09-01' }));
    expect(api.getDomains).toHaveBeenLastCalledWith(expect.objectContaining({ from: '2026-09-01' }));
  });

  it('shows empty states', async () => {
    api.getWorlds.mockResolvedValue([]);
    api.getMenuFunnels.mockResolvedValue({ from: 'a', to: 'b', menus: [] });
    api.getDomains.mockResolvedValue({ from: 'a', to: 'b', domains: [] });
    render(<OwnerAnalyticsPage />);

    expect(await screen.findByText('No movement samples in this range.')).toBeInTheDocument();
    expect(await screen.findByText('No menu activity in this range.')).toBeInTheDocument();
    expect(await screen.findByText('No domain activity in this range.')).toBeInTheDocument();
    expect(api.getHeatmap).not.toHaveBeenCalled();
  });

  it('shows "Owner only" when the API refuses a wildcard holder', async () => {
    api.getWorlds.mockRejectedValue(Object.assign(new Error('Forbidden'), { status: 403 }));
    render(<OwnerAnalyticsPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('knk.owner.analytics.view');
  });

  it('lays out cells north-up with at least one pixel each, and log-scales the colour', () => {
    const layout = heatmapLayout(heatmap.cells, 720, 480)!;
    expect(layout).toMatchObject({ minX: -2, minZ: 0, cols: 3, rows: 4, scale: 32 });
    expect(heatmapLayout([], 10, 10)).toBeNull();
    const huge = heatmapLayout([{ x: 0, z: 0, samples: 1 }, { x: 5000, z: 5000, samples: 1 }], 720, 480)!;
    expect(huge.scale).toBe(1);

    expect(heatColor(0, 10)).toBe('rgba(0,0,0,0)');
    expect(heatColor(10, 10)).toBe('hsla(0, 90%, 50%, 1.00)');
    expect(heatColor(1, 1000)).toMatch(/^hsla\(2\d\d,/);
  });
});
