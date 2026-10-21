import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DUEL_POLICY_CHANGED_MESSAGE, DuelPolicyPage } from '../DuelPolicyPage';
import { duelMatchClient } from '../../../../apiClients/duelMatchClient';
import { DuelPolicyDto } from '../../../../types/dtos/duels/DuelDtos';
import { POLICY } from '../__fixtures__/duelFixtures';

jest.mock('react-router-dom', () => ({
    Link: ({ to, children, ...rest }: { to: string; children: React.ReactNode }) => <a href={to} {...rest}>{children}</a>
}), { virtual: true });
jest.mock('../../../../apiClients/duelMatchClient', () => ({ duelMatchClient: { getPolicy: jest.fn(), updatePolicy: jest.fn() } }));

describe('DuelPolicyPage', () => {
    beforeEach(() => {
        (duelMatchClient.getPolicy as jest.Mock).mockReset().mockResolvedValue(POLICY);
        (duelMatchClient.updatePolicy as jest.Mock).mockReset();
    });

    it('saves thresholds and switches, sending back the version it loaded', async () => {
        (duelMatchClient.updatePolicy as jest.Mock).mockImplementation((body: DuelPolicyDto) =>
            Promise.resolve({ ...body, updatedAt: '2026-10-21T09:00:00.000001' }));
        render(<DuelPolicyPage />);

        const save = await screen.findByRole('button', { name: 'Save policy' });
        expect(save).toBeDisabled();
        fireEvent.change(screen.getByLabelText('Fight shorter than (seconds)'), { target: { value: '15' } });
        fireEvent.click(screen.getByLabelText(/S6 Funnel/));
        fireEvent.change(screen.getByLabelText('Hold from flag number'), { target: { value: '3' } });
        fireEvent.click(save);

        expect(await screen.findByRole('status')).toHaveTextContent('Saved.');
        expect(duelMatchClient.updatePolicy).toHaveBeenCalledWith(expect.objectContaining({
            s2ShortFightSeconds: 15, s6Enabled: false, escalationFlagCount: 3, updatedAt: '2026-10-21T08:00:00.123456'
        }));
    });

    it('refuses non-numbers before sending', async () => {
        render(<DuelPolicyPage />);
        fireEvent.change(await screen.findByLabelText('Within (days)'), { target: { value: 'a week' } });
        expect(screen.getByText('Whole number required.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Save policy' })).toBeDisabled();
    });

    it('on 409 PolicyChanged asks to reload, then shows the current values', async () => {
        (duelMatchClient.updatePolicy as jest.Mock).mockRejectedValue(
            Object.assign(new Error('changed'), { status: 409, response: { code: 'PolicyChanged', message: 'changed' } }));
        render(<DuelPolicyPage />);

        fireEvent.change(await screen.findByLabelText('Fight shorter than (seconds)'), { target: { value: '15' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save policy' }));
        expect(await screen.findByRole('alert')).toHaveTextContent(DUEL_POLICY_CHANGED_MESSAGE);
        expect(screen.getByRole('button', { name: 'Save policy' })).toBeDisabled();

        (duelMatchClient.getPolicy as jest.Mock).mockResolvedValue({ ...POLICY, s2ShortFightSeconds: 12, updatedAt: '2026-10-21T08:30:00' });
        fireEvent.click(screen.getByRole('button', { name: 'Reload current policy' }));
        await waitFor(() => expect(screen.getByLabelText('Fight shorter than (seconds)')).toHaveValue('12'));
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
});
