import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TransactionDetailPage } from '../TransactionDetailPage';
import { currencyClient } from '../../../../apiClients/currencyClient';
import { CurrencyTransactionDetailDto } from '../../../../types/dtos/currency/CurrencyDtos';

// virtual: CRA's Jest resolver can't resolve react-router-dom's package exports
jest.mock('react-router-dom', () => ({
    Link: ({ to, children, ...rest }: { to: string; children: React.ReactNode }) => <a href={to} {...rest}>{children}</a>,
    useParams: () => ({ publicId: '01M3FHW0E9NNVK4SWMK3BR002T' })
}), { virtual: true });

jest.mock('../../../../apiClients/currencyClient', () => ({
    currencyClient: { getTransaction: jest.fn(), reverse: jest.fn() }
}));
jest.mock('../../../../hooks/useStaffAccess', () => ({
    usePermission: () => ({ allowed: true, isChecking: false })
}));

const TX: CurrencyTransactionDetailDto = {
    transactionId: 3, publicId: '01M3FHW0E9NNVK4SWMK3BR002T', createdAt: '2026-09-26T19:08:00Z', kind: 'Grant',
    reasonCode: 'SALARY', reason: 'Salary', initiator: 'System', initiatorComponent: 'SalaryService', idempotencyScope: 'system',
    reversible: true,
    entries: [
        { entryId: 1, currency: 'Coins', accountKind: 'User', userId: 5, username: 'alice', operation: 'Add', amount: 650, balanceBefore: 100, balanceAfter: 750 },
        { entryId: 2, currency: 'Coins', accountKind: 'System', systemAccount: 'SYS_SALARY', operation: 'Remove', amount: -650 },
    ]
};

const renderPage = () => render(<TransactionDetailPage />);

describe('TransactionDetailPage', () => {
    beforeEach(() => {
        (currencyClient.getTransaction as jest.Mock).mockReset().mockResolvedValue(TX);
        (currencyClient.reverse as jest.Mock).mockReset();
    });

    it('shows every leg, and reverses with a note of at least 10 characters', async () => {
        (currencyClient.reverse as jest.Mock).mockResolvedValue({
            reversedPublicId: TX.publicId, partial: true,
            posting: { transactionId: 4, publicId: '01M3FJ00000000000000000000', replayed: false, reasonCode: 'REVERSAL', createdAt: '', entries: [] }
        });
        renderPage();

        await waitFor(() => expect(screen.getByText('SYS_SALARY')).toBeInTheDocument());
        expect(screen.getByText('100 → 750')).toBeInTheDocument();

        const reverse = screen.getByRole('button', { name: 'Reverse' });
        fireEvent.change(screen.getByLabelText(/reason/i), { target: { value: 'too short' } });
        expect(reverse).toBeDisabled();
        fireEvent.change(screen.getByLabelText(/reason/i), { target: { value: 'Paid twice by a bug' } });
        fireEvent.click(screen.getByLabelText(/partial/i));
        fireEvent.click(reverse);

        await waitFor(() => expect(currencyClient.reverse).toHaveBeenCalledWith(TX.publicId, 'Paid twice by a bug', true));
        await waitFor(() => expect(screen.getByText('01M3FJ00000000000000000000')).toBeInTheDocument());
        expect(screen.getByText(/partially/)).toBeInTheDocument();
    });

    it('shows the API reason when the reversal is refused, and no form once reversed', async () => {
        (currencyClient.reverse as jest.Mock).mockRejectedValue(new Error('Reversing 01M3 would take user 5\'s coins below zero.'));
        renderPage();
        await waitFor(() => expect(screen.getByText('SYS_SALARY')).toBeInTheDocument());

        fireEvent.change(screen.getByLabelText(/reason/i), { target: { value: 'Paid twice by a bug' } });
        fireEvent.click(screen.getByRole('button', { name: 'Reverse' }));
        await waitFor(() => expect(screen.getByText(/below zero/)).toBeInTheDocument());

        (currencyClient.getTransaction as jest.Mock).mockResolvedValue({ ...TX, reversible: false, reversedByPublicId: '01M3FJ00000000000000000000' });
        renderPage();
        await waitFor(() => expect(screen.getByText('Reversed by')).toBeInTheDocument());
    });

    it('shows who reversed it and when, without a Reverse form, for a reversed transaction', async () => {
        (currencyClient.getTransaction as jest.Mock).mockResolvedValue({
            ...TX, reversible: false, reversedByPublicId: '01M3FJ00000000000000000000',
            reversedAt: '2026-09-27T10:30:00Z', reversedByUserId: 9, reversedByUsername: 'moderator'
        });
        renderPage();

        const notice = await screen.findByRole('status');
        expect(notice).toHaveTextContent(/Already reversed on .+ by moderator \(reversal 01M3FJ00000000000000000000\)/);
        expect(screen.queryByRole('button', { name: 'Reverse' })).not.toBeInTheDocument();
    });

    it('on 409 AlreadyReversed shows the existing reversal instead of success, and hides the form', async () => {
        (currencyClient.reverse as jest.Mock).mockRejectedValue(Object.assign(
            new Error('AlreadyReversed: Transaction 01M3 was already reversed.'), {
                status: 409,
                response: {
                    error: 'AlreadyReversed', code: 'AlreadyReversed', message: 'already reversed',
                    details: { reversalTransactionPublicId: '01M3FK00000000000000000000', reversedAt: '2026-09-27T10:30:00Z', reversedByUserId: null, reversedByUsername: null }
                }
            }));
        renderPage();
        await waitFor(() => expect(screen.getByText('SYS_SALARY')).toBeInTheDocument());

        // Someone else reversed it meanwhile; the reload still shows it as reversible here.
        fireEvent.change(screen.getByLabelText(/reason/i), { target: { value: 'Paid twice by a bug' } });
        fireEvent.click(screen.getByRole('button', { name: 'Reverse' }));

        const notice = await screen.findByRole('status');
        expect(notice).toHaveTextContent(/Already reversed on .+ by the game server \(reversal 01M3FK00000000000000000000\)/);
        expect(screen.queryByText(/^Reversed as/)).not.toBeInTheDocument();
        expect(screen.queryByText(/AlreadyReversed:/)).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Reverse' })).not.toBeInTheDocument();
    });
});
