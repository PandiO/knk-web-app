import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CurrencyAlertsPage } from '../CurrencyAlertsPage';
import { currencyClient } from '../../../../apiClients/currencyClient';
import { CurrencyAlertDto, CurrencyAlertPageDto } from '../../../../types/dtos/currency/CurrencyDtos';

// virtual: CRA's Jest resolver can't resolve react-router-dom's package exports
jest.mock('react-router-dom', () => ({
    Link: ({ to, children, ...rest }: { to: string; children: React.ReactNode }) => <a href={to} {...rest}>{children}</a>
}), { virtual: true });

jest.mock('../../../../apiClients/currencyClient', () => ({
    currencyClient: { getAlerts: jest.fn(), acknowledgeAlert: jest.fn(), getReconciliation: jest.fn(), runReconciliation: jest.fn() }
}));
jest.mock('../../../../hooks/useStaffAccess', () => ({
    usePermission: () => ({ allowed: true, isChecking: false })
}));

const FUNNEL: CurrencyAlertDto = {
    id: 7, rule: 'R3', ruleName: 'Funnel', severity: 'High', summary: 'Received transfers from 5 accounts younger than 7 days',
    userId: 6, username: 'bob', details: { transfers: 5 }, createdAt: '2026-09-26T20:00:00'
};
const MISMATCH: CurrencyAlertDto = {
    id: 8, rule: 'R1', ruleName: 'Reconciliation mismatch', severity: 'Critical', summary: 'Reconciliation found 1 balance mismatch',
    userId: 5, username: 'alice', createdAt: '2026-09-26T21:00:00'
};

const page = (items: CurrencyAlertDto[]): CurrencyAlertPageDto => ({
    items, totalCount: items.length, pageNumber: 1, pageSize: 25, openCount: items.filter(a => !a.ackedAt).length,
    openBySeverity: { Critical: 1, High: 1 }
});

describe('CurrencyAlertsPage', () => {
    beforeEach(() => {
        (currencyClient.getAlerts as jest.Mock).mockReset().mockResolvedValue(page([MISMATCH, FUNNEL]));
        (currencyClient.acknowledgeAlert as jest.Mock).mockReset();
        (currencyClient.getReconciliation as jest.Mock).mockReset().mockResolvedValue({
            running: false, monitorEnabled: true, intervalMinutes: 60,
            lastRun: {
                startedAt: '2026-09-26T21:00:00', durationMs: 42, trigger: 'scheduled', mismatchCount: 1, truncated: false,
                mismatches: [{ kind: 'BalanceColumn', userId: 5, currency: 'Coins', expected: 5000, actual: 5777 }],
                alertIds: [8], transfersDisabled: ['Coins']
            }
        });
        (currencyClient.runReconciliation as jest.Mock).mockReset();
    });

    it('lists the open alerts with the kill-switch warning and the last reconciliation', async () => {
        render(<CurrencyAlertsPage />);

        await waitFor(() => expect(screen.getByText('Received transfers from 5 accounts younger than 7 days')).toBeInTheDocument());
        expect(currencyClient.getAlerts).toHaveBeenCalledWith({ status: 'open', severity: '', rule: '', page: 1, pageSize: 25 });
        expect(screen.getByText('R1 Reconciliation mismatch', { selector: 'span' })).toBeInTheDocument();
        expect(screen.getByText('Player: bob')).toHaveAttribute('href', '/admin/users/6');
        expect(screen.getByRole('alert')).toHaveTextContent(/switched off automatically/);
        await waitFor(() => expect(screen.getByText(/Coins payments switched off/)).toBeInTheDocument());
        expect(screen.getByText('5,777')).toBeInTheDocument();
    });

    it('filters by severity and rule, and acknowledges an alert', async () => {
        (currencyClient.acknowledgeAlert as jest.Mock).mockResolvedValue({ ...FUNNEL, ackedAt: '2026-09-26T22:00:00', ackedByUsername: 'mod' });
        render(<CurrencyAlertsPage />);
        await waitFor(() => expect(screen.getByText('R3 Funnel', { selector: 'span' })).toBeInTheDocument());

        fireEvent.change(screen.getByLabelText('Severity'), { target: { value: 'High' } });
        fireEvent.change(screen.getByLabelText('Rule'), { target: { value: 'R3' } });
        await waitFor(() => expect(currencyClient.getAlerts).toHaveBeenLastCalledWith(
            { status: 'open', severity: 'High', rule: 'R3', page: 1, pageSize: 25 }));

        (currencyClient.getAlerts as jest.Mock).mockResolvedValue(page([MISMATCH]));
        fireEvent.click(screen.getByRole('button', { name: 'Acknowledge alert 7' }));

        await waitFor(() => expect(currencyClient.acknowledgeAlert).toHaveBeenCalledWith(7));
        await waitFor(() => expect(screen.queryByText('R3 Funnel', { selector: 'span' })).not.toBeInTheDocument());
    });

    it('shows the details of an alert and runs the reconciliation on demand', async () => {
        (currencyClient.runReconciliation as jest.Mock).mockResolvedValue({
            startedAt: '2026-09-26T22:00:00', durationMs: 7, trigger: 'manual', mismatchCount: 0, truncated: false,
            mismatches: [], alertIds: [], transfersDisabled: []
        });
        render(<CurrencyAlertsPage />);
        await waitFor(() => expect(screen.getByText('R3 Funnel', { selector: 'span' })).toBeInTheDocument());

        fireEvent.click(screen.getByRole('button', { name: 'Details' }));
        expect(screen.getByText(/"transfers": 5/)).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /Run now/ }));
        await waitFor(() => expect(screen.getByText(/Balances reconcile/)).toBeInTheDocument());
    });

    it('says so when nothing is open', async () => {
        (currencyClient.getAlerts as jest.Mock).mockResolvedValue({ ...page([]), openBySeverity: {} });
        render(<CurrencyAlertsPage />);

        await waitFor(() => expect(screen.getByText(/No open alerts/)).toBeInTheDocument());
    });
});
