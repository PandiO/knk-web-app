import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { createMemoryRouter, Link, RouterProvider } from 'react-router-dom';
import { CurrencyPolicyPage } from '../CurrencyPolicyPage';
import { currencyClient } from '../../../../apiClients/currencyClient';
import { titleBracketClient } from '../../../../apiClients/titleBracketClient';
import { CurrencyPolicyDto } from '../../../../types/dtos/currency/CurrencyDtos';
import { LEAVE_SETTINGS_TITLE } from '../../../../components/SettingsPage';

// Jest 27 can't read react-router-dom v7's exports map; react-router has the same router and hooks.
jest.mock('react-router-dom', () => jest.requireActual('react-router'), { virtual: true });
jest.mock('../../../../apiClients/currencyClient', () => ({ currencyClient: { getPolicies: jest.fn(), updatePolicy: jest.fn() } }));
jest.mock('../../../../apiClients/titleBracketClient', () => ({ titleBracketClient: { getAll: jest.fn() } }));

// PandiO/knk-workspace#26: Currency policy on the SettingsPage shell asks before an in-app navigation drops edits.

const COINS: CurrencyPolicyDto = {
    currency: 'Coins', transfersEnabled: true, transferable: true, minTransfer: 10, maxTransfer: 1_000_000,
    dailySendCap: 0, dailyReceiveCap: 0, confirmThreshold: 100_000, confirmTtlSeconds: 60, cooldownSeconds: 0,
    maxTransfersPerHour: 0, minSenderAccountAgeHours: 0, minSenderTitleBracketId: null, transferFeeBasisPoints: 0,
    maxBalance: 999_999_999, adminDailyGrantCapPerActor: 1_000, signupGrant: 250,
    updatedAt: '2026-09-27T08:00:00', updatedByUserId: 900, hardMaxBalance: 999_999_999
};

it('asks "Leave without saving?" with changes; Stay keeps them, Leave goes', async () => {
    (currencyClient.getPolicies as jest.Mock).mockResolvedValue([COINS]);
    (titleBracketClient.getAll as jest.Mock).mockResolvedValue([]);
    const router = createMemoryRouter([
        { path: '/admin/economy/policy', element: <><CurrencyPolicyPage /><Link to="/admin/economy/alerts">Alerts</Link></> },
        { path: '/admin/economy/alerts', element: <p>alerts page</p> },
    ], { initialEntries: ['/admin/economy/policy'] });
    render(<RouterProvider router={router} />);

    fireEvent.change(await screen.findByLabelText('Signup grant'), { target: { value: '500' } });
    fireEvent.click(screen.getByRole('link', { name: 'Alerts' }));
    let dialog = await screen.findByRole('alertdialog', { name: LEAVE_SETTINGS_TITLE });
    expect(dialog).toHaveTextContent('1 unsaved change on this page will be lost.');
    expect(within(dialog).getByRole('button', { name: 'Stay' })).toHaveFocus();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Stay' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(screen.getByLabelText('Signup grant')).toHaveValue('500');

    fireEvent.click(screen.getByRole('link', { name: 'Alerts' }));
    dialog = await screen.findByRole('alertdialog', { name: LEAVE_SETTINGS_TITLE });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Leave' }));
    expect(await screen.findByText('alerts page')).toBeInTheDocument();
    expect(currencyClient.updatePolicy).not.toHaveBeenCalled();
    expect(router.state.location.pathname).toBe('/admin/economy/alerts');
});
