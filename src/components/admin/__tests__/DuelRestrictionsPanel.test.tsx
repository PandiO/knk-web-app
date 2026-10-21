import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DuelRestrictionsPanel, expiryToIso } from '../DuelRestrictionsPanel';
import { duelMatchClient } from '../../../apiClients/duelMatchClient';
import { playerClient } from '../../../apiClients/playerClient';
import { DuelRestrictionDto } from '../../../types/dtos/duels/DuelDtos';

let mockAllowed = true;
jest.mock('react-router-dom', () => ({
    Link: ({ to, children, ...rest }: { to: string; children: React.ReactNode }) => <a href={to} {...rest}>{children}</a>
}), { virtual: true });
jest.mock('../../../hooks/useStaffAccess', () => ({ usePermission: () => ({ allowed: mockAllowed, isChecking: false }) }));
jest.mock('../../../apiClients/duelMatchClient', () => ({
    duelMatchClient: { getRestrictions: jest.fn(), createRestriction: jest.fn(), liftRestriction: jest.fn() }
}));
jest.mock('../../../apiClients/playerClient', () => ({ playerClient: { getByName: jest.fn() } }));

const PAIR: DuelRestrictionDto = {
    id: 4, userId: 1, username: 'alice', otherUserId: 2, otherUsername: 'bob', reason: 'Suspected alt pair',
    expiresAt: '2026-11-01T00:00:00', createdAt: '2026-10-21T10:00:00', createdByUserId: 9, active: true,
};

describe('DuelRestrictionsPanel', () => {
    beforeEach(() => {
        mockAllowed = true;
        (duelMatchClient.getRestrictions as jest.Mock).mockReset().mockResolvedValue([PAIR]);
        (duelMatchClient.createRestriction as jest.Mock).mockReset().mockResolvedValue({ ...PAIR, id: 5 });
        (duelMatchClient.liftRestriction as jest.Mock).mockReset().mockResolvedValue({ ...PAIR, active: false });
        (playerClient.getByName as jest.Mock).mockReset().mockImplementation((name: string) =>
            name === 'carol' ? Promise.resolve({ userId: 3 }) : name === 'dave' ? Promise.resolve({ userId: 4 })
                : Promise.reject(Object.assign(new Error('nf'), { status: 404 })));
    });

    it('lists active restrictions and can include lifted ones', async () => {
        render(<DuelRestrictionsPanel />);

        const row = await screen.findByRole('listitem', { name: 'Restriction 4' });
        expect(within(row).getByText('Active')).toBeInTheDocument();
        expect(within(row).getByText('(this pair only)')).toBeInTheDocument();
        expect(within(row).getByText('Suspected alt pair')).toBeInTheDocument();
        expect(duelMatchClient.getRestrictions).toHaveBeenCalledWith(undefined, true);

        fireEvent.click(screen.getByLabelText('Show lifted and expired'));
        await waitFor(() => expect(duelMatchClient.getRestrictions).toHaveBeenLastCalledWith(undefined, false));
    });

    it('adds a pair restriction with an end date, names resolved to ids', async () => {
        render(<DuelRestrictionsPanel />);
        await screen.findByRole('listitem', { name: 'Restriction 4' });

        const add = screen.getByRole('button', { name: 'Add restriction' });
        fireEvent.change(screen.getByLabelText('Player (name or id)'), { target: { value: 'carol' } });
        expect(add).toBeDisabled(); // a reason is required
        fireEvent.change(screen.getByLabelText(/Only against this player/), { target: { value: 'dave' } });
        fireEvent.change(screen.getByLabelText(/Ends/), { target: { value: '2026-11-01T12:00' } });
        fireEvent.change(screen.getByLabelText(/Reason \(required/), { target: { value: 'Feeding' } });
        fireEvent.click(add);

        expect(await screen.findByRole('status')).toHaveTextContent('Restriction added.');
        expect(duelMatchClient.createRestriction).toHaveBeenCalledWith({
            userId: 3, otherUserId: 4, reason: 'Feeding', expiresAt: expiryToIso('2026-11-01T12:00')
        });
        expect(duelMatchClient.getRestrictions).toHaveBeenCalledTimes(2);
    });

    it('says when a name is unknown, without calling the API', async () => {
        render(<DuelRestrictionsPanel />);
        await screen.findByRole('listitem', { name: 'Restriction 4' });

        fireEvent.change(screen.getByLabelText('Player (name or id)'), { target: { value: 'nobody' } });
        fireEvent.change(screen.getByLabelText(/Reason \(required/), { target: { value: 'x' } });
        fireEvent.click(screen.getByRole('button', { name: 'Add restriction' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('No player called "nobody".');
        expect(duelMatchClient.createRestriction).not.toHaveBeenCalled();
    });

    it('lifts a restriction with an optional reason', async () => {
        render(<DuelRestrictionsPanel />);
        fireEvent.click(await screen.findByRole('button', { name: 'Lift restriction 4' }));
        fireEvent.change(screen.getByLabelText('Why (optional)'), { target: { value: 'cleared' } });
        fireEvent.click(screen.getByRole('button', { name: 'Confirm lift' }));

        await waitFor(() => expect(duelMatchClient.liftRestriction).toHaveBeenCalledWith(4, 'cleared'));
    });

    it('on a staff profile: filtered to the player, who is fixed in the form', async () => {
        render(<DuelRestrictionsPanel userId={1} username="alice" asProfileCard />);
        await screen.findByRole('listitem', { name: 'Restriction 4' });

        expect(duelMatchClient.getRestrictions).toHaveBeenCalledWith(1, true);
        expect(screen.getByText('Player: alice')).toBeInTheDocument();
        expect(screen.queryByLabelText('Player (name or id)')).not.toBeInTheDocument();
        fireEvent.change(screen.getByLabelText(/Reason \(required/), { target: { value: 'Farming' } });
        fireEvent.click(screen.getByRole('button', { name: 'Add restriction' }));
        await waitFor(() => expect(duelMatchClient.createRestriction).toHaveBeenCalledWith(
            { userId: 1, otherUserId: null, reason: 'Farming', expiresAt: null }));
    });

    it('on a staff profile: hidden without the review node', () => {
        mockAllowed = false;
        const { container } = render(<DuelRestrictionsPanel userId={1} asProfileCard />);
        expect(container).toBeEmptyDOMElement();
        expect(duelMatchClient.getRestrictions).not.toHaveBeenCalled();
    });
});
