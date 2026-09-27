import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BalanceLedgerTable } from '../BalanceLedgerTable';
import { currencyClient, ledgerQueryString } from '../../../apiClients/currencyClient';
import { LedgerLineDto } from '../../../types/dtos/currency/CurrencyDtos';

// virtual: CRA's Jest resolver can't resolve react-router-dom's package exports
jest.mock('react-router-dom', () => ({
    Link: ({ to, children, ...rest }: { to: string; children: React.ReactNode }) => <a href={to} {...rest}>{children}</a>,
    useParams: () => ({ publicId: '01M3FHW0E9NNVK4SWMK3BR002T' })
}), { virtual: true });

jest.mock('../../../apiClients/currencyClient', () => ({
    ...jest.requireActual('../../../apiClients/currencyClient'),
    currencyClient: { getLedger: jest.fn() }
}));

const LINE: LedgerLineDto = {
    entryId: 7, transactionId: 3, publicId: '01M3FHW0E9NNVK4SWMK3BR002T', createdAt: '2026-09-26T19:08:00.841058',
    userId: 5, username: 'alice', currency: 'Coins', operation: 'Set', amount: -250, balanceBefore: 300, balanceAfter: 50,
    kind: 'AdminAdjust', reasonCode: 'ADMIN_SET', reason: 'Correction: duplicated prize', initiator: 'Admin',
    initiatorUserId: 9, initiatorUsername: 'moderator', initiatorComponent: 'WebAppAdminAdjustment'
};

const getLedger = currencyClient.getLedger as jest.Mock;
const lastQuery = () => getLedger.mock.calls[getLedger.mock.calls.length - 1][0];

describe('BalanceLedgerTable', () => {
    beforeEach(() => {
        getLedger.mockReset();
        getLedger.mockResolvedValue({ items: [LINE], totalCount: 1, pageNumber: 1, pageSize: 25 });
    });

    it('shows each row with before -> after, initiator and reason, newest first by default', async () => {
        render(<BalanceLedgerTable />);

        await waitFor(() => expect(screen.getByText('moderator')).toBeInTheDocument());
        expect(lastQuery()).toMatchObject({ sort: 'createdAt', dir: 'desc', page: 1, pageSize: 25 });
        expect(screen.getByText('300 → 50')).toBeInTheDocument();
        expect(screen.getByText('-250')).toBeInTheDocument();
        expect(screen.getByText('Correction: duplicated prize')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'alice' })).toHaveAttribute('href', '/admin/users/5');
        expect(screen.getByRole('link', { name: LINE.publicId })).toHaveAttribute('href', `/admin/economy/transactions/${LINE.publicId}`);
    });

    it('sorts on the server when a column header is clicked, toggling the direction', async () => {
        render(<BalanceLedgerTable />);
        await waitFor(() => expect(getLedger).toHaveBeenCalled());

        fireEvent.click(screen.getByRole('button', { name: /amount/i }));
        await waitFor(() => expect(lastQuery()).toMatchObject({ sort: 'amount', dir: 'desc' }));
        fireEvent.click(screen.getByRole('button', { name: /amount/i }));
        await waitFor(() => expect(lastQuery()).toMatchObject({ sort: 'amount', dir: 'asc' }));
        fireEvent.click(screen.getByRole('button', { name: /^player/i }));
        await waitFor(() => expect(lastQuery()).toMatchObject({ sort: 'recipient', dir: 'asc' }));
    });

    it('filters on the server: selects at once, text on Search', async () => {
        render(<BalanceLedgerTable />);
        await waitFor(() => expect(getLedger).toHaveBeenCalled());

        fireEvent.change(screen.getByLabelText('Currency'), { target: { value: 'gems' } });
        await waitFor(() => expect(lastQuery()).toMatchObject({ currency: 'gems', page: 1 }));

        fireEvent.change(screen.getByLabelText('Player'), { target: { value: 'ali' } });
        fireEvent.change(screen.getByLabelText('Initiator'), { target: { value: 'Salary' } });
        expect(lastQuery().recipient).toBe('');
        fireEvent.click(screen.getByRole('button', { name: /search/i }));
        await waitFor(() => expect(lastQuery()).toMatchObject({ currency: 'gems', recipient: 'ali', initiator: 'Salary' }));
    });

    it('for one player, filters by their id and leaves out the player column', async () => {
        render(<BalanceLedgerTable userId={5} />);
        await waitFor(() => expect(lastQuery()).toMatchObject({ userId: 5 }));
        expect(screen.queryByLabelText('Player')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /^player/i })).not.toBeInTheDocument();
    });

    it('builds the query string without empty values', () => {
        expect(ledgerQueryString({ currency: 'xp', recipient: ' ', initiator: 'mod ', sort: 'amount', page: 2, userId: undefined }))
            .toBe('currency=xp&initiator=mod&sort=amount&page=2');
    });
});
