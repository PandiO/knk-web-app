import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CurrencyPolicyPage, POLICY_CHANGED_MESSAGE, killSwitchQuestion } from '../CurrencyPolicyPage';
import { currencyClient } from '../../../../apiClients/currencyClient';
import { titleBracketClient } from '../../../../apiClients/titleBracketClient';
import { CurrencyPolicyDto } from '../../../../types/dtos/currency/CurrencyDtos';
import { toast } from '../../../../utils/toast';

// virtual: CRA's Jest resolver can't resolve react-router-dom's package exports. No data router here, so the
// SettingsPage shell leaves its navigation blocker out (the leave flow: CurrencyPolicyPage.leave.test.tsx).
jest.mock('react-router-dom', () => ({
    Link: ({ to, children, ...rest }: { to: string; children: React.ReactNode }) => <a href={to} {...rest}>{children}</a>
}), { virtual: true });

jest.mock('../../../../apiClients/currencyClient', () => ({
    currencyClient: { getPolicies: jest.fn(), updatePolicy: jest.fn() }
}));
jest.mock('../../../../apiClients/titleBracketClient', () => ({
    titleBracketClient: { getAll: jest.fn() }
}));

const COINS: CurrencyPolicyDto = {
    currency: 'Coins', transfersEnabled: true, transferable: true, minTransfer: 10, maxTransfer: 1_000_000,
    dailySendCap: 2_000_000, dailyReceiveCap: 4_000_000, confirmThreshold: 100_000, confirmTtlSeconds: 60, cooldownSeconds: 0,
    maxTransfersPerHour: 0, minSenderAccountAgeHours: 0, minSenderTitleBracketId: null, transferFeeBasisPoints: 0,
    maxBalance: 999_999_999, adminDailyGrantCapPerActor: 1_000, signupGrant: 250,
    updatedAt: '2026-09-27T08:00:00.123456', updatedByUserId: 900, hardMaxBalance: 999_999_999
};
const GEMS: CurrencyPolicyDto = { ...COINS, currency: 'Gems', transferable: false, maxTransfer: 500, updatedAt: '2026-09-28T08:00:00' };

const conflict = (current: CurrencyPolicyDto) =>
    Object.assign(new Error('PolicyChanged: The Coins policy was changed since you loaded it.'), {
        status: 409,
        response: { error: 'PolicyChanged', code: 'PolicyChanged', details: current }
    });

const coins = () => screen.getByRole('region', { name: 'Coins' });
const header = () => screen.getByRole('banner', { name: 'Currency policy' });

describe('CurrencyPolicyPage', () => {
    let success: jest.SpyInstance;
    beforeEach(() => {
        (currencyClient.getPolicies as jest.Mock).mockReset().mockResolvedValue([COINS]);
        (currencyClient.updatePolicy as jest.Mock).mockReset();
        (titleBracketClient.getAll as jest.Mock).mockReset().mockResolvedValue([
            { id: 3, name: 'Knight', maleName: 'Knight', femaleName: 'Dame', minExperience: 5000 },
            { id: 1, name: 'Peasant', maleName: 'Peasant', femaleName: 'Peasant', minExperience: 0 },
        ]);
        success = jest.spyOn(toast, 'success').mockImplementation(() => undefined);
    });
    afterEach(() => success.mockRestore());

    it('sends back the version it loaded, with a toast and a clean header', async () => {
        (currencyClient.updatePolicy as jest.Mock).mockImplementation((_c: string, body: CurrencyPolicyDto) =>
            Promise.resolve({ ...body, updatedAt: '2026-09-27T09:00:00.000001Z' }));
        render(<CurrencyPolicyPage />);

        const max = await screen.findByLabelText('Maximum payment');
        fireEvent.change(max, { target: { value: '500000' } });
        expect(header()).toHaveTextContent('1 unsaved change.');
        expect(coins()).toHaveTextContent('Changed');
        fireEvent.click(within(header()).getByRole('button', { name: 'Save (1)' }));

        await waitFor(() => expect(success).toHaveBeenCalledWith('Saved the coins policy.'));
        expect(currencyClient.updatePolicy).toHaveBeenCalledWith('coins',
            expect.objectContaining({ maxTransfer: 500_000, transfersEnabled: true, updatedAt: '2026-09-27T08:00:00.123456' }));
        expect(header()).toHaveTextContent('No unsaved changes.');
    });

    it('on 409 PolicyChanged tells staff to reload and review, and reloads the current policy', async () => {
        const shutOff: CurrencyPolicyDto = { ...COINS, transfersEnabled: false, updatedAt: '2026-09-27T08:30:00.000001', updatedByUserId: null };
        (currencyClient.updatePolicy as jest.Mock).mockRejectedValue(conflict(shutOff));
        render(<CurrencyPolicyPage />);

        const max = await screen.findByLabelText('Maximum payment');
        fireEvent.change(max, { target: { value: '500000' } });
        fireEvent.click(within(header()).getByRole('button', { name: 'Save (1)' }));

        expect(await within(header()).findByRole('alert')).toHaveTextContent(`Coins: ${POLICY_CHANGED_MESSAGE}`);
        expect(coins()).toHaveTextContent(/automatic safety shut-off/);
        expect(within(header()).getByRole('button', { name: 'Save (1)' })).toBeDisabled(); // the stale form can't be re-sent as is
        expect(max).toHaveValue('500000'); // the edit isn't thrown away before the reload

        (currencyClient.getPolicies as jest.Mock).mockResolvedValue([shutOff]);
        fireEvent.click(within(coins()).getByRole('button', { name: 'Reload current policy' }));

        await waitFor(() => expect(screen.getByLabelText('Maximum payment')).toHaveValue('1000000'));
        expect(screen.getByLabelText(/kill switch/)).not.toBeChecked();
        expect(screen.queryByRole('button', { name: 'Reload current policy' })).not.toBeInTheDocument();
        expect(currencyClient.getPolicies).toHaveBeenCalledTimes(2);
    });

    it('shows other refusals in the header as the API explains them', async () => {
        (currencyClient.updatePolicy as jest.Mock).mockRejectedValue(
            Object.assign(new Error('The confirmation window must be 10–600 seconds.'), { status: 400 }));
        render(<CurrencyPolicyPage />);

        fireEvent.change(await screen.findByLabelText('Confirm window'), { target: { value: '5' } });
        fireEvent.click(within(header()).getByRole('button', { name: 'Save (1)' }));

        expect(await within(header()).findByRole('alert')).toHaveTextContent('Coins: The confirmation window must be 10–600 seconds.');
        expect(screen.queryByRole('button', { name: 'Reload current policy' })).not.toBeInTheDocument();
    });

    it('shows units and what a value means (#26 SET-5)', async () => {
        render(<CurrencyPolicyPage />);
        const fee = await screen.findByLabelText('Transfer fee');
        expect(fee).toHaveAccessibleDescription(expect.stringContaining('bp'));
        expect(fee).toHaveAccessibleDescription(expect.stringContaining('= no fee'));
        fireEvent.change(fee, { target: { value: '250' } });
        expect(fee).toHaveAccessibleDescription(expect.stringContaining('= 2.5%'));
        fireEvent.change(screen.getByLabelText('Cooldown'), { target: { value: '600' } });
        expect(screen.getByLabelText('Cooldown')).toHaveAccessibleDescription(expect.stringContaining('= 10 min'));
        expect(screen.getByLabelText('Maximum payment')).toHaveAccessibleDescription(expect.stringContaining('coins'));
        fireEvent.change(screen.getByLabelText('Maximum payment'), { target: { value: '1.5' } });
        expect(within(coins()).getByText('Whole number required.')).toBeInTheDocument();
        expect(within(header()).getByRole('button', { name: /Save/ })).toBeDisabled();
    });

    it('picks the lowest sender title from the brackets, lowest first', async () => {
        (currencyClient.updatePolicy as jest.Mock).mockImplementation((_c: string, body: CurrencyPolicyDto) => Promise.resolve(body));
        render(<CurrencyPolicyPage />);
        const title = await screen.findByLabelText('Lowest sender title');
        await waitFor(() => expect(title.tagName).toBe('SELECT'));
        expect(Array.from((title as HTMLSelectElement).options).map(o => o.text))
            .toEqual(['None', 'Peasant (from 0 XP)', 'Knight (from 5,000 XP)']);
        fireEvent.change(title, { target: { value: '3' } });
        fireEvent.click(within(header()).getByRole('button', { name: 'Save (1)' }));
        await waitFor(() => expect(currencyClient.updatePolicy).toHaveBeenCalledWith('coins', expect.objectContaining({ minSenderTitleBracketId: 3 })));
    });

    it('falls back to the bracket id when the brackets cannot be loaded', async () => {
        jest.spyOn(console, 'error').mockImplementation(() => undefined);
        (titleBracketClient.getAll as jest.Mock).mockRejectedValue(new Error('down'));
        render(<CurrencyPolicyPage />);
        const title = await screen.findByLabelText('Lowest sender title');
        expect(title.tagName).toBe('INPUT');
        (console.error as jest.Mock).mockRestore();
    });

    it('asks before switching payments off and saves nothing on Cancel (#26 SET-6)', async () => {
        (currencyClient.updatePolicy as jest.Mock).mockImplementation((_c: string, body: CurrencyPolicyDto) => Promise.resolve(body));
        render(<CurrencyPolicyPage />);
        fireEvent.click(await screen.findByLabelText(/kill switch/));
        fireEvent.click(within(header()).getByRole('button', { name: 'Save (1)' }));

        let dialog = await screen.findByRole('alertdialog', { name: 'Switch coins payments off?' });
        expect(dialog).toHaveTextContent('no player can send coins with /pay');
        fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
        await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
        expect(currencyClient.updatePolicy).not.toHaveBeenCalled();
        expect(header()).toHaveTextContent('1 unsaved change.');

        fireEvent.click(within(header()).getByRole('button', { name: 'Save (1)' }));
        dialog = await screen.findByRole('alertdialog', { name: 'Switch coins payments off?' });
        await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Switch off and save' })); });
        await waitFor(() => expect(currencyClient.updatePolicy).toHaveBeenCalledWith('coins', expect.objectContaining({ transfersEnabled: false })));
    });

    it('saves both currencies with one Save and counts their changes together', async () => {
        (currencyClient.getPolicies as jest.Mock).mockResolvedValue([COINS, GEMS]);
        (currencyClient.updatePolicy as jest.Mock).mockImplementation((_c: string, body: CurrencyPolicyDto) => Promise.resolve(body));
        render(<CurrencyPolicyPage />);
        const gems = await screen.findByRole('region', { name: 'Gems' });
        fireEvent.change(within(gems).getByLabelText('Signup grant'), { target: { value: '5' } });
        fireEvent.change(within(coins()).getByLabelText('Signup grant'), { target: { value: '300' } });
        expect(header()).toHaveTextContent('2 unsaved changes.');
        fireEvent.click(within(header()).getByRole('button', { name: 'Save (2)' }));
        await waitFor(() => expect(success).toHaveBeenCalledWith('Saved the coins and gems policies.'));
        expect(currencyClient.updatePolicy).toHaveBeenCalledWith('gems', expect.objectContaining({ signupGrant: 5 }));
    });

    it('words the kill switch question by direction and count', () => {
        expect(killSwitchQuestion([])).toBeNull();
        expect(killSwitchQuestion([{ currency: 'Gems', on: true }])).toEqual(expect.objectContaining({
            title: 'Switch gems payments on?', confirmLabel: 'Switch on and save', danger: false,
        }));
        expect(killSwitchQuestion([{ currency: 'Coins', on: false }, { currency: 'Gems', on: true }])).toEqual(expect.objectContaining({
            title: 'Change both payment switches?', danger: true,
        }));
    });
});
