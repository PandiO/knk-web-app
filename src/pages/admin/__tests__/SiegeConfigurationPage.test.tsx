import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SiegeConfigurationPage } from '../SiegeConfigurationPage';
import { siegeConfigurationClient } from '../../../apiClients/siegeConfigurationClient';

jest.mock('../../../apiClients/siegeConfigurationClient', () => ({
    siegeConfigurationClient: { get: jest.fn(), update: jest.fn() }
}));

const DEFAULTS = {
    captureAttackBase: 5, captureAttackPerExtra: 1, captureAttackPerExtraInstantVictory: 1,
    captureDefendBase: 5, captureDefendPerExtra: 1, captureDefendPerExtraInstantVictory: 1,
    sideCaptureReduction: 0.4,
    voteCloseSecondsBeforeStart: 30, drawSecondsBeforeStart: 25, hubSecondsBeforeStart: 15, teamSplitSecondsBeforeStart: 10,
    matchmakingAnnouncementMarks: [290, 60, 30, 15], killAnnouncementThresholds: [5, 10, 15], killStreakAnnounceAbove: 3,
    headshotMultiplier: 1.5, allowedCommands: ['/siege', '/msg'], spawnPickerDelayTicks: 20,
    enchantDropChancePerMille: 30, allowedEnchantmentKeys: ['minecraft:sharpness'], enchantLevelMin: 1, enchantLevelMax: 2,
    maxBooksAlive: 10, nonMemberGateView: 'PreLockdownView', updatedAt: '2026-09-25T17:00:00Z'
};

describe('SiegeConfigurationPage', () => {
    beforeEach(() => {
        (siegeConfigurationClient.get as jest.Mock).mockResolvedValue(DEFAULTS);
        (siegeConfigurationClient.update as jest.Mock).mockImplementation(async (dto: object) => ({ ...DEFAULTS, ...dto }));
    });

    it('sends only the changed values (partial PUT), parsing lists', async () => {
        render(<SiegeConfigurationPage />);
        await waitFor(() => expect(screen.getByDisplayValue('1.5')).toBeInTheDocument());

        const save = screen.getByRole('button', { name: /save/i });
        expect(save).toBeDisabled();

        fireEvent.change(screen.getByDisplayValue('1.5'), { target: { value: '1' } });
        fireEvent.change(screen.getByDisplayValue('290,60,30,15'), { target: { value: '120, 60' } });
        fireEvent.click(screen.getByRole('button', { name: /save \(2\)/i }));

        await waitFor(() => expect(siegeConfigurationClient.update).toHaveBeenCalledWith({
            headshotMultiplier: 1,
            matchmakingAnnouncementMarks: [120, 60]
        }));
        await waitFor(() => expect(screen.getByText('Saved 2 settings.')).toBeInTheDocument());
    });

    it('blocks saving invalid input and shows the API reason on a rejected save', async () => {
        (siegeConfigurationClient.update as jest.Mock).mockRejectedValue(new Error('headshotMultiplier must be between 1 and 10.'));
        render(<SiegeConfigurationPage />);
        await waitFor(() => expect(screen.getByDisplayValue('3')).toBeInTheDocument());

        fireEvent.change(screen.getByDisplayValue('3'), { target: { value: 'three' } });
        expect(screen.getByText('Whole number required.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();

        fireEvent.change(screen.getByDisplayValue('three'), { target: { value: '4' } });
        fireEvent.change(screen.getByDisplayValue('1.5'), { target: { value: '99' } });
        fireEvent.click(screen.getByRole('button', { name: /save \(2\)/i }));
        await waitFor(() => expect(screen.getByText('headshotMultiplier must be between 1 and 10.')).toBeInTheDocument());
    });
});
