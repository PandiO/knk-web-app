import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { groupChanges, groupPreview, StatisticsVisibilitySettings } from '../StatisticsVisibilitySettings';
import { statisticsClient } from '../../../apiClients/statisticsClient';
import { StatisticsVisibilityDto, StatisticVisibility } from '../../../types/dtos/statistics/StatisticsDtos';

jest.mock('../../../apiClients/statisticsClient', () => ({
  statisticsClient: { getVisibility: jest.fn(), updateVisibility: jest.fn() },
}));

const mockedGet = statisticsClient.getVisibility as jest.Mock;
const mockedUpdate = statisticsClient.updateVisibility as jest.Mock;

const settings = (pvp: StatisticVisibility = 'Everyone', deaths: StatisticVisibility = 'Nobody'): StatisticsVisibilityDto => ({
  userId: 7,
  friendsAvailable: false,
  settings: [
    { settingKey: 'logins', group: 'activity', label: 'Logins', contextual: false, visibility: 'Nobody', contexts: [] },
    {
      settingKey: 'pvp_kills', group: 'combat', label: 'Player kills', contextual: true, visibility: pvp,
      contexts: [
        { context: 'siege', visibility: 'Nobody', isOverride: true },
        { context: 'open_world', visibility: pvp, isOverride: false },
      ],
    },
    { settingKey: 'deaths', group: 'combat', label: 'Deaths', contextual: false, visibility: deaths, contexts: [] },
  ],
});

describe('StatisticsVisibilitySettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGet.mockResolvedValue(settings());
  });

  it('lists the selected group with its context rows', async () => {
    render(<StatisticsVisibilitySettings userId={7} />);

    expect(await screen.findByLabelText('Logins')).toHaveValue('Nobody');
    await userEvent.click(screen.getByRole('tab', { name: 'Combat' }));

    expect(screen.getByLabelText('Player kills')).toHaveValue('Everyone');
    expect(screen.getByLabelText('Player kills — Siege')).toHaveValue('Nobody');
    expect(screen.getByText('Set for Siege only')).toBeInTheDocument();
    expect(screen.getByText('Same as Player kills (inherited)')).toBeInTheDocument();
    expect(screen.queryByLabelText('Logins')).not.toBeInTheDocument();
  });

  it('changes one setting with the shown value as expected', async () => {
    mockedUpdate.mockResolvedValue(settings('Everyone', 'Everyone'));
    render(<StatisticsVisibilitySettings userId={7} />);
    await userEvent.click(await screen.findByRole('tab', { name: 'Combat' }));

    await userEvent.selectOptions(screen.getByLabelText('Player kills — Siege'), 'Everyone');

    expect(mockedUpdate).toHaveBeenCalledWith(7, [{ settingKey: 'pvp_kills', context: 'siege', expected: 'Nobody', visibility: 'Everyone' }]);
    expect(await screen.findByRole('status')).toHaveTextContent('Player kills (Siege): now visible to Everyone.');
  });

  it('previews a group action and applies it atomically on Confirm', async () => {
    mockedUpdate.mockResolvedValue(settings('Everyone', 'Everyone'));
    render(<StatisticsVisibilitySettings userId={7} />);
    await userEvent.click(await screen.findByRole('tab', { name: 'Combat' }));

    await userEvent.click(screen.getByRole('button', { name: 'Set all listed to Everyone' }));
    const dialog = screen.getByRole('dialog', { name: 'Confirm group change' });
    expect(within(dialog).getByText('Set 1 Combat setting(s) to Everyone?')).toBeInTheDocument();
    expect(within(dialog).getByText('Deaths: Nobody → Everyone')).toBeInTheDocument();
    expect(within(dialog).getByText('Player kills — Siege stays Nobody')).toBeInTheDocument();
    expect(mockedUpdate).not.toHaveBeenCalled();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }));
    expect(mockedUpdate).toHaveBeenCalledWith(7, [{ settingKey: 'deaths', context: '', expected: 'Nobody', visibility: 'Everyone' }]);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('handles a conflict by showing the current settings and saying nothing was changed', async () => {
    mockedUpdate.mockRejectedValue(Object.assign(new Error('conflict'), {
      status: 409,
      response: { error: 'VisibilityConflict', message: 'changed', current: settings('Nobody', 'Everyone') },
    }));
    render(<StatisticsVisibilitySettings userId={7} />);
    await userEvent.click(await screen.findByRole('tab', { name: 'Combat' }));

    await userEvent.selectOptions(screen.getByLabelText('Player kills'), 'Friends');

    expect(await screen.findByRole('alert')).toHaveTextContent('changed elsewhere meanwhile, so nothing was changed');
    expect(screen.getByLabelText('Player kills')).toHaveValue('Nobody');
    expect(screen.getByLabelText('Deaths')).toHaveValue('Everyone');
  });

  it('is read-only for staff', async () => {
    render(<StatisticsVisibilitySettings userId={7} readOnly />);
    await userEvent.click(await screen.findByRole('tab', { name: 'Combat' }));

    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Set all listed/ })).not.toBeInTheDocument();
    expect(screen.getAllByText('Everyone').length).toBeGreaterThan(0);
  });

  it('computes group changes on the metric level only', () => {
    expect(groupChanges(settings(), 'combat', 'Nobody')).toEqual([
      { settingKey: 'pvp_kills', context: '', expected: 'Everyone', visibility: 'Nobody' },
    ]);
    expect(groupPreview(settings(), 'combat', 'Friends')).toEqual([
      'Player kills: Everyone → Friends', 'Deaths: Nobody → Friends', 'Player kills — Siege stays Nobody',
    ]);
  });
});
