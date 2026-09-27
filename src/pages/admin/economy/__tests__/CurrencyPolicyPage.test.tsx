import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CurrencyPolicyPage, POLICY_CHANGED_MESSAGE } from '../CurrencyPolicyPage';
import { currencyClient } from '../../../../apiClients/currencyClient';
import { CurrencyPolicyDto } from '../../../../types/dtos/currency/CurrencyDtos';

// virtual: CRA's Jest resolver can't resolve react-router-dom's package exports
jest.mock('react-router-dom', () => ({
    Link: ({ to, children, ...rest }: { to: string; children: React.ReactNode }) => <a href={to} {...rest}>{children}</a>
}), { virtual: true });

jest.mock('../../../../apiClients/currencyClient', () => ({
    currencyClient: { getPolicies: jest.fn(), updatePolicy: jest.fn() }
}));

const COINS: CurrencyPolicyDto = {
    currency: 'Coins', transfersEnabled: true, transferable: true, minTransfer: 10, maxTransfer: 1_000_000,
    dailySendCap: 2_000_000, dailyReceiveCap: 4_000_000, confirmThreshold: 100_000, confirmTtlSeconds: 60, cooldownSeconds: 0,
    maxTransfersPerHour: 0, minSenderAccountAgeHours: 0, minSenderTitleBracketId: null, transferFeeBasisPoints: 0,
    maxBalance: 999_999_999, adminDailyGrantCapPerActor: 1_000, signupGrant: 250,
    updatedAt: '2026-09-27T08:00:00.123456', updatedByUserId: 900, hardMaxBalance: 999_999_999
};

const conflict = (current: CurrencyPolicyDto) =>
    Object.assign(new Error('PolicyChanged: The Coins policy was changed since you loaded it.'), {
        status: 409,
        response: { error: 'PolicyChanged', code: 'PolicyChanged', details: current }
    });

describe('CurrencyPolicyPage', () => {
    beforeEach(() => {
        (currencyClient.getPolicies as jest.Mock).mockReset().mockResolvedValue([COINS]);
        (currencyClient.updatePolicy as jest.Mock).mockReset();
    });

    it('sends back the version it loaded', async () => {
        (currencyClient.updatePolicy as jest.Mock).mockImplementation((_c: string, body: CurrencyPolicyDto) =>
            Promise.resolve({ ...body, updatedAt: '2026-09-27T09:00:00.000001Z' }));
        render(<CurrencyPolicyPage />);

        const max = await screen.findByLabelText('Maximum payment');
        fireEvent.change(max, { target: { value: '500000' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save coins' }));

        await waitFor(() => expect(screen.getByText('Saved.')).toBeInTheDocument());
        expect(currencyClient.updatePolicy).toHaveBeenCalledWith('coins',
            expect.objectContaining({ maxTransfer: 500_000, transfersEnabled: true, updatedAt: '2026-09-27T08:00:00.123456' }));
    });

    it('on 409 PolicyChanged tells staff to reload and review, and reloads the current policy', async () => {
        const shutOff: CurrencyPolicyDto = { ...COINS, transfersEnabled: false, updatedAt: '2026-09-27T08:30:00.000001', updatedByUserId: null };
        (currencyClient.updatePolicy as jest.Mock).mockRejectedValue(conflict(shutOff));
        render(<CurrencyPolicyPage />);

        const max = await screen.findByLabelText('Maximum payment');
        fireEvent.change(max, { target: { value: '500000' } });
        const save = screen.getByRole('button', { name: 'Save coins' });
        fireEvent.click(save);

        expect(await screen.findByRole('alert')).toHaveTextContent(POLICY_CHANGED_MESSAGE);
        expect(screen.getByRole('alert')).toHaveTextContent(/automatic safety shut-off/);
        expect(save).toBeDisabled(); // the stale form can't be re-sent as is
        expect(max).toHaveValue('500000'); // the edit isn't thrown away before the reload

        (currencyClient.getPolicies as jest.Mock).mockResolvedValue([shutOff]);
        fireEvent.click(screen.getByRole('button', { name: 'Reload current policy' }));

        await waitFor(() => expect(screen.getByLabelText('Maximum payment')).toHaveValue('1000000'));
        expect(screen.getByLabelText(/kill switch/)).not.toBeChecked();
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Reload current policy' })).not.toBeInTheDocument();
        expect(currencyClient.getPolicies).toHaveBeenCalledTimes(2);
    });

    it('shows other refusals as the API explains them', async () => {
        (currencyClient.updatePolicy as jest.Mock).mockRejectedValue(
            Object.assign(new Error('The confirmation window must be 10–600 seconds.'), { status: 400 }));
        render(<CurrencyPolicyPage />);

        fireEvent.change(await screen.findByLabelText('Confirm window (s)'), { target: { value: '5' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save coins' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('The confirmation window must be 10–600 seconds.');
        expect(screen.queryByRole('button', { name: 'Reload current policy' })).not.toBeInTheDocument();
    });
});
