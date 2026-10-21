import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DuelHistoryPage } from '../DuelHistoryPage';
import { duelMatchClient } from '../../../../apiClients/duelMatchClient';
import { arenaClient } from '../../../../apiClients/arenaClient';
import { playerClient } from '../../../../apiClients/playerClient';
import { FRIENDLY_DRAW, HELD, PAID } from '../__fixtures__/duelFixtures';

// virtual: CRA's Jest resolver can't resolve react-router-dom's package exports
jest.mock('react-router-dom', () => ({
    Link: ({ to, children, ...rest }: { to: string; children: React.ReactNode }) => <a href={to} {...rest}>{children}</a>
}), { virtual: true });
jest.mock('../../../../apiClients/duelMatchClient', () => ({ duelMatchClient: { query: jest.fn() } }));
jest.mock('../../../../apiClients/arenaClient', () => ({ arenaClient: { getAll: jest.fn() } }));
jest.mock('../../../../apiClients/playerClient', () => ({ playerClient: { getByName: jest.fn() } }));

describe('DuelHistoryPage', () => {
    beforeEach(() => {
        (duelMatchClient.query as jest.Mock).mockReset().mockResolvedValue([PAID, HELD, FRIENDLY_DRAW]);
        (arenaClient.getAll as jest.Mock).mockReset().mockResolvedValue([{ id: 3, name: 'Old Arena' }]);
        (playerClient.getByName as jest.Mock).mockReset();
    });

    it('lists matches with stakes, result and review', async () => {
        render(<DuelHistoryPage />);

        const paidRow = (await screen.findByRole('link', { name: '#7' })).closest('tr')!;
        expect(within(paidRow).getByText('1,000 + 800 coins, 1 item stack')).toBeInTheDocument();
        expect(within(paidRow).getByText('alice won')).toBeInTheDocument();
        expect(within(paidRow).getByText('Flagged')).toBeInTheDocument();
        expect(within(paidRow).getByText('S1 S4')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: '#7' })).toHaveAttribute('href', '/admin/duels/7');

        const heldRow = screen.getByRole('link', { name: '#8' }).closest('tr')!;
        expect(within(heldRow).getByText('Held')).toBeInTheDocument();
        const drawRow = screen.getByRole('link', { name: '#9' }).closest('tr')!;
        expect(within(drawRow).getByText('Friendly')).toBeInTheDocument();
        expect(within(drawRow).getByText('Draw: agreed')).toBeInTheDocument();
        expect(within(drawRow).getByText('Not reviewed')).toBeInTheDocument();
    });

    it('filters by arena, status and review', async () => {
        render(<DuelHistoryPage />);
        await screen.findByRole('link', { name: '#7' });
        await screen.findByRole('option', { name: 'Old Arena' });

        fireEvent.change(screen.getByLabelText('Arena'), { target: { value: '3' } });
        fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'Completed' } });
        fireEvent.change(screen.getByLabelText('Review'), { target: { value: 'Held' } });

        await waitFor(() => expect(duelMatchClient.query).toHaveBeenLastCalledWith(
            expect.objectContaining({ arenaId: 3, status: 'Completed', review: 'Held', userId: undefined })));
    });

    it('finds a player by name, and says when there is none', async () => {
        (playerClient.getByName as jest.Mock).mockImplementation((name: string) =>
            name === 'bob' ? Promise.resolve({ userId: 2, username: 'bob' }) : Promise.reject(Object.assign(new Error('nf'), { status: 404 })));
        render(<DuelHistoryPage />);
        await screen.findByRole('link', { name: '#7' });

        const input = screen.getByLabelText('Player (name or id)');
        fireEvent.change(input, { target: { value: 'bob' } });
        fireEvent.blur(input);
        await waitFor(() => expect(duelMatchClient.query).toHaveBeenLastCalledWith(expect.objectContaining({ userId: 2 })));

        fireEvent.change(input, { target: { value: 'nobody' } });
        fireEvent.blur(input);
        expect(await screen.findByText('No player called "nobody".')).toBeInTheDocument();
    });

    it('shows the API refusal when the history fails to load', async () => {
        (duelMatchClient.query as jest.Mock).mockRejectedValue(Object.assign(new Error("You don't have permission to do this."), { status: 403 }));
        render(<DuelHistoryPage />);
        expect(await screen.findByText("You don't have permission to do this.")).toBeInTheDocument();
    });
});
