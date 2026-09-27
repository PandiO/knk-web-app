import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AdjustBalanceCard } from '../AdjustBalanceCard';
import { currencyClient } from '../../../apiClients/currencyClient';

jest.mock('../../../apiClients/currencyClient', () => ({
    currencyClient: { adjust: jest.fn() }
}));

let mockHeld: string[] = [];
jest.mock('../../../hooks/useStaffAccess', () => ({
    usePermission: (node: string) => ({ allowed: mockHeld.includes(node), isChecking: false })
}));

const BALANCES = { coins: 100, gems: 5, experiencePoints: 2500 };

describe('AdjustBalanceCard', () => {
    beforeEach(() => {
        mockHeld = [];
        (currencyClient.adjust as jest.Mock).mockReset();
    });

    it('is a titled "Adjust balance" card offering only the balances the staff member may change', () => {
        mockHeld = ['knk.admin.user.coins', 'knk.admin.user.xp'];
        render(<AdjustBalanceCard userId={7} balances={BALANCES} onAdjusted={jest.fn()} />);

        expect(screen.getByRole('heading', { name: 'Adjust balance' })).toBeInTheDocument();
        const options = Array.from((screen.getByLabelText('Balance') as HTMLSelectElement).options).map(o => o.textContent);
        expect(options).toEqual(['Coins', 'XP']);
        expect(screen.getByLabelText('Category')).toBeInTheDocument();
        expect(screen.getByLabelText('Reason')).toBeInTheDocument();
    });

    it('is hidden from staff without any balance permission', () => {
        const { container } = render(<AdjustBalanceCard userId={7} balances={BALANCES} onAdjusted={jest.fn()} />);
        expect(container).toBeEmptyDOMElement();
    });

    it('posts the adjustment with its category and note, and a Set with the balance shown', async () => {
        mockHeld = ['knk.admin.user.gems'];
        const result = { newCoins: 100, newGems: 50, newExperiencePoints: 2500, replayed: false, changes: [] };
        (currencyClient.adjust as jest.Mock).mockResolvedValue(result);
        const onAdjusted = jest.fn();
        render(<AdjustBalanceCard userId={7} balances={BALANCES} onAdjusted={onAdjusted} />);

        await waitFor(() => expect((screen.getByLabelText('Balance') as HTMLSelectElement).value).toBe('gems'));
        fireEvent.change(screen.getByLabelText('Action'), { target: { value: 'set' } });
        fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '50' } });
        fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'COMPENSATION' } });
        const apply = screen.getByRole('button', { name: 'Apply adjustment' });
        fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'too short' } });
        expect(apply).toBeDisabled();
        fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Lost gems to a lag spike' } });
        fireEvent.click(apply);

        await waitFor(() => expect(onAdjusted).toHaveBeenCalledWith(result));
        expect(currencyClient.adjust).toHaveBeenCalledWith({
            targetUserId: 7, currency: 'Gems', mode: 'Set', amount: 50, expectedCurrent: 5,
            category: 'COMPENSATION', note: 'Lost gems to a lag spike'
        }, expect.any(String));
    });

    it('shows the API reason when refused, e.g. an XP increase without the coins and gems permissions', async () => {
        mockHeld = ['knk.admin.user.xp'];
        (currencyClient.adjust as jest.Mock).mockRejectedValue(
            Object.assign(new Error('Requires the knk.admin.user.coins permission.'), { status: 403 }));
        render(<AdjustBalanceCard userId={7} balances={BALANCES} onAdjusted={jest.fn()} />);

        await waitFor(() => expect((screen.getByLabelText('Balance') as HTMLSelectElement).value).toBe('experiencePoints'));
        expect(screen.getByText(/also needs the\s+coins and gems permissions/)).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '10' } });
        fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'COMPENSATION' } });
        fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Missed quest reward' } });
        fireEvent.click(screen.getByRole('button', { name: 'Apply adjustment' }));

        await waitFor(() => expect(screen.getByText('Requires the knk.admin.user.coins permission.')).toBeInTheDocument());
    });
});
