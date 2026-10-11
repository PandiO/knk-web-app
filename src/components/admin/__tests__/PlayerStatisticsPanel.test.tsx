import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PlayerStatisticsPanel } from '../PlayerStatisticsPanel';
import { statisticsClient } from '../../../apiClients/statisticsClient';
import { usePermission } from '../../../hooks/useStaffAccess';
import { STATISTICS_STAFF_NODE } from '../../../types/dtos/statistics/StatisticsDtos';

jest.mock('../../../apiClients/statisticsClient', () => ({
  statisticsClient: { getCatalog: jest.fn(), getUserStatistics: jest.fn(), getTitleHistory: jest.fn(), getVisibility: jest.fn() },
}));
jest.mock('../../../hooks/useStaffAccess', () => ({ usePermission: jest.fn() }));

const mockedUsePermission = usePermission as jest.Mock;
const mockedVisibility = statisticsClient.getVisibility as jest.Mock;

describe('PlayerStatisticsPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (statisticsClient.getCatalog as jest.Mock).mockResolvedValue({ timeZone: 'UTC', metrics: [], settings: [], groups: [] });
    (statisticsClient.getUserStatistics as jest.Mock).mockResolvedValue({
      userId: 7, username: 'Bob', period: 'lifetime', timeZone: 'UTC', viewer: 'staff',
      profile: { titleName: 'Knight', experience: 1, coins: 0, gems: 0, activePlaytimeSeconds: 0, afkSeconds: 0 }, metrics: [],
    });
    (statisticsClient.getTitleHistory as jest.Mock).mockResolvedValue({ items: [], totalCount: 0, pageNumber: 1, pageSize: 10 });
    mockedVisibility.mockResolvedValue({
      userId: 7, friendsAvailable: false,
      settings: [{ settingKey: 'logins', group: 'activity', label: 'Logins', contextual: false, visibility: 'Everyone', contexts: [] }],
    });
  });

  it('renders nothing without knk.admin.statistics.view', () => {
    mockedUsePermission.mockReturnValue({ allowed: false, isChecking: false });

    const { container } = render(<PlayerStatisticsPanel userId={7} />);

    expect(container).toBeEmptyDOMElement();
    expect(mockedUsePermission).toHaveBeenCalledWith(STATISTICS_STAFF_NODE);
    expect(mockedVisibility).not.toHaveBeenCalled();
  });

  it('shows the statistics and read-only visibility settings to staff', async () => {
    mockedUsePermission.mockReturnValue({ allowed: true, isChecking: false });

    render(<PlayerStatisticsPanel userId={7} />);

    expect(await screen.findByText('Knight')).toBeInTheDocument();
    expect(await screen.findByText('Visibility settings (read-only)')).toBeInTheDocument();
    expect(await screen.findByText('Logins')).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('hides itself when the API answers 403', async () => {
    mockedUsePermission.mockReturnValue({ allowed: true, isChecking: false });
    mockedVisibility.mockRejectedValue(Object.assign(new Error('forbidden'), { status: 403 }));

    const { container } = render(<PlayerStatisticsPanel userId={7} />);

    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });
});
