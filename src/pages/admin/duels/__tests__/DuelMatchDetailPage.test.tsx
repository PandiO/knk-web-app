import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DuelMatchDetailPage } from '../DuelMatchDetailPage';
import { duelMatchClient } from '../../../../apiClients/duelMatchClient';
import { DuelRevertResultDto } from '../../../../types/dtos/duels/DuelDtos';
import { FRIENDLY_DRAW, HELD, PAID } from '../__fixtures__/duelFixtures';

let mockId = '7';
jest.mock('react-router-dom', () => ({
    Link: ({ to, children, ...rest }: { to: string; children: React.ReactNode }) => <a href={to} {...rest}>{children}</a>,
    useParams: () => ({ id: mockId }),
}), { virtual: true });
jest.mock('../../../../apiClients/duelMatchClient', () => ({
    duelMatchClient: {
        getById: jest.fn(), release: jest.fn(), voidHeld: jest.fn(), revert: jest.fn(), confiscate: jest.fn(), clearEscalation: jest.fn(),
    }
}));

const SPENT: DuelRevertResultDto = {
    confiscated: false, payoutCoins: 1710, recoveredCoins: 1200, feeReversedCoins: 90, returnedToLoserCoins: 800,
    returnedToWinnerCoins: 490, confiscatedCoins: 0, missingCoins: 510, undeliveredItems: 'ReturnToOwners', transactionIds: [103, 104, 105],
};

describe('DuelMatchDetailPage', () => {
    beforeEach(() => {
        Object.values(duelMatchClient).forEach(fn => (fn as jest.Mock).mockReset());
    });

    it('shows stakes, telemetry, signals and tier', async () => {
        mockId = '7';
        (duelMatchClient.getById as jest.Mock).mockResolvedValue(PAID);
        render(<DuelMatchDetailPage />);

        const stakes = await screen.findByRole('region', { name: 'Stakes and spoils' });
        expect(within(stakes).getByText('1,000 coins')).toBeInTheDocument();
        expect(within(stakes).getByText('90 coins')).toBeInTheDocument();
        expect(within(stakes).getByText('Edge (DIAMOND_SWORD)')).toBeInTheDocument();

        const fight = screen.getByRole('region', { name: 'Fight' });
        expect(within(fight).getByText('Duration: 8 s')).toBeInTheDocument();
        expect(within(fight).getByText('no weapon')).toBeInTheDocument();

        const review = screen.getByRole('region', { name: 'Review' });
        expect(within(review).getByText('Tier 1')).toBeInTheDocument();
        expect(within(review).getByText('One-sided damage')).toBeInTheDocument();
        expect(within(review).getByText('Passive loser')).toBeInTheDocument();
        expect(within(review).getByText('loserDamagePercent')).toBeInTheDocument();
        expect(within(review).getByRole('link', { name: /Alert #501/ })).toHaveAttribute('href', '/admin/economy/alerts');
        expect(screen.queryByRole('button', { name: 'Release…' })).not.toBeInTheDocument();
    });

    it('releases a held result, the reason optional', async () => {
        mockId = '8';
        (duelMatchClient.getById as jest.Mock).mockResolvedValue(HELD);
        (duelMatchClient.release as jest.Mock).mockResolvedValue({ match: { ...HELD, review: 'Released' }, settlement: 'Paid', alreadyDone: false });
        render(<DuelMatchDetailPage />);

        expect(await screen.findByText(/Held: nothing has been paid/)).toBeInTheDocument();
        expect(screen.getByText(/Escalated by the pair's earlier flags/)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Release…' }));
        fireEvent.click(screen.getByRole('button', { name: 'Confirm release' }));

        expect(await screen.findByRole('status')).toHaveTextContent('Released.');
        expect(duelMatchClient.release).toHaveBeenCalledWith(8, '');
    });

    it('voids a held result only with a reason', async () => {
        mockId = '8';
        (duelMatchClient.getById as jest.Mock).mockResolvedValue(HELD);
        (duelMatchClient.voidHeld as jest.Mock).mockResolvedValue({ match: { ...HELD, review: 'Voided' }, settlement: 'Refunded', alreadyDone: false });
        render(<DuelMatchDetailPage />);

        fireEvent.click(await screen.findByRole('button', { name: 'Void…' }));
        const confirm = screen.getByRole('button', { name: 'Confirm void' });
        expect(confirm).toBeDisabled();
        fireEvent.change(screen.getByLabelText(/Reason \(required/), { target: { value: 'alt pair' } });
        fireEvent.click(confirm);

        await waitFor(() => expect(duelMatchClient.voidHeld).toHaveBeenCalledWith(8, 'alt pair'));
        expect(await screen.findByRole('status')).toHaveTextContent('Voided.');
    });

    it('reverts a paid result and shows what was recovered and what is missing', async () => {
        mockId = '7';
        (duelMatchClient.getById as jest.Mock).mockResolvedValue(PAID);
        (duelMatchClient.revert as jest.Mock).mockResolvedValue({
            match: { ...PAID, review: 'Voided', reviewReason: 'thrown', revertResult: SPENT, undeliveredItems: 'ReturnToOwners' },
            settlement: 'Refunded', alreadyDone: false, revert: SPENT,
        });
        render(<DuelMatchDetailPage />);

        fireEvent.click(await screen.findByRole('button', { name: 'Revert…' }));
        expect(screen.getByRole('button', { name: 'Confirm revert' })).toBeDisabled();
        fireEvent.change(screen.getByLabelText(/Reason \(required/), { target: { value: 'thrown' } });
        fireEvent.click(screen.getByRole('button', { name: 'Confirm revert' }));

        const summary = await screen.findByRole('status', { name: 'Revert result' });
        expect(summary).toHaveTextContent('Recovered 1,200 coins of the 1,710 coins payout.');
        expect(summary).toHaveTextContent('Returned to the loser 800 coins');
        expect(summary).toHaveTextContent('Still missing: 510 coins');
        expect(summary).toHaveTextContent('/inventory or /enderchest');
        expect(duelMatchClient.revert).toHaveBeenCalledWith(7, 'thrown');
        // Voided now: no more actions on it.
        expect(screen.queryByRole('button', { name: 'Revert…' })).not.toBeInTheDocument();
    });

    it('confiscates, and shows the API refusal', async () => {
        mockId = '7';
        (duelMatchClient.getById as jest.Mock).mockResolvedValue(PAID);
        (duelMatchClient.confiscate as jest.Mock).mockRejectedValue(
            Object.assign(new Error('Duel 7 was already reverted.'), { status: 409, response: { code: 'WrongState', message: 'Duel 7 was already reverted.' } }));
        render(<DuelMatchDetailPage />);

        fireEvent.click(await screen.findByRole('button', { name: 'Confiscate…' }));
        fireEvent.change(screen.getByLabelText(/Reason \(required/), { target: { value: 'both in on it' } });
        fireEvent.click(screen.getByRole('button', { name: 'Confirm confiscate' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('Duel 7 was already reverted.');
        expect(duelMatchClient.confiscate).toHaveBeenCalledWith(7, 'both in on it');
    });

    it('clears the escalation of the pair or the winner', async () => {
        mockId = '7';
        (duelMatchClient.getById as jest.Mock).mockResolvedValue(PAID);
        (duelMatchClient.clearEscalation as jest.Mock).mockResolvedValue({ acknowledgedAlertIds: [501, 502] });
        render(<DuelMatchDetailPage />);

        const card = await screen.findByRole('region', { name: 'Clear escalation' });
        fireEvent.click(within(card).getByRole('button', { name: 'Clear escalation' }));
        expect(await within(card).findByText('Cleared 2 open flags.')).toBeInTheDocument();
        expect(duelMatchClient.clearEscalation).toHaveBeenCalledWith({ userId: 1, otherUserId: 2, reason: null });

        fireEvent.click(within(card).getByLabelText(/The winner \(alice\)/));
        fireEvent.change(within(card).getByLabelText('Reason (optional)'), { target: { value: 'checked' } });
        fireEvent.click(within(card).getByRole('button', { name: 'Clear escalation' }));
        await waitFor(() => expect(duelMatchClient.clearEscalation).toHaveBeenLastCalledWith({ userId: 1, reason: 'checked' }));
    });

    it('offers nothing to review on a friendly draw', async () => {
        mockId = '9';
        (duelMatchClient.getById as jest.Mock).mockResolvedValue(FRIENDLY_DRAW);
        render(<DuelMatchDetailPage />);

        expect(await screen.findByText('A friendly duel: nothing was staked.')).toBeInTheDocument();
        expect(screen.getByText(/Not scored/)).toBeInTheDocument();
        expect(screen.queryByRole('region', { name: 'Clear escalation' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /…$/ })).not.toBeInTheDocument();
    });
});
