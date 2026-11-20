import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SiegeConfigurationPage } from '../SiegeConfigurationPage';
import { siegeConfigurationClient } from '../../../apiClients/siegeConfigurationClient';
import { toast } from '../../../utils/toast';

// virtual: CRA's Jest resolver can't resolve react-router-dom's package exports. No data router here, so the
// SettingsPage shell (#187) leaves its navigation blocker out.
jest.mock('react-router-dom', () => ({}), { virtual: true });

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
    maxBooksAlive: 10, nonMemberGateView: 'PreLockdownView', giveNavigationItem: false,
    playerSkipMatchmakingSeconds: 60, adminSkipMatchmakingSeconds: 31, postMatchSeconds: 30,
    // Siege points (#866/#878); values chosen so no display value repeats one the tests above look up.
    pointsPerKill: 100, pointsStreakStep: 0.1, pointsStreakCap: 1.75, pointsPerAssist: 40, assistMinDamage: 4,
    assistWindowSeconds: 12, pointsPerDeath: 15, gateHpPerPoint: 5.5, pointsPerCapturePercent: 6, pointsPerCapture: 101,
    trickleAmount: 11, trickleIntervalSeconds: 61, pointTransfersEnabled: false,
    updatedAt: '2026-09-25T17:00:00Z'
};

describe('SiegeConfigurationPage', () => {
    beforeEach(() => {
        (siegeConfigurationClient.get as jest.Mock).mockResolvedValue(DEFAULTS);
        (siegeConfigurationClient.update as jest.Mock).mockImplementation(async (dto: object) => ({ ...DEFAULTS, ...dto }));
    });

    let successToast: jest.SpyInstance;
    beforeEach(() => {
        successToast = jest.spyOn(toast, 'success').mockImplementation(() => undefined);
    });
    afterEach(() => successToast.mockRestore());

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
        // #187: the shell's success toast; the header says nothing is left to save.
        await waitFor(() => expect(successToast).toHaveBeenCalledWith('Saved 2 settings.'));
        expect(screen.getByText('No unsaved changes.')).toBeInTheDocument();
    });

    it('blocks saving invalid input and shows the API reason on a rejected save', async () => {
        (siegeConfigurationClient.update as jest.Mock).mockRejectedValue(Object.assign(new Error('headshotMultiplier must be between 1 and 10.'), { status: 400 }));
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

    it('edits the /siege skip seconds (playtest 2026-10-24) and sends only those', async () => {
        render(<SiegeConfigurationPage />);
        const playerSkip = await screen.findByLabelText(/Player skip leaves/);
        expect(playerSkip).toHaveValue('60');
        expect(screen.getByLabelText(/Admin skip leaves/)).toHaveValue('31');

        fireEvent.change(playerSkip, { target: { value: '90' } });
        fireEvent.change(screen.getByLabelText(/Admin skip leaves/), { target: { value: '45' } });
        fireEvent.click(screen.getByRole('button', { name: /save \(2\)/i }));

        await waitFor(() => expect(siegeConfigurationClient.update).toHaveBeenCalledWith({
            playerSkipMatchmakingSeconds: 90,
            adminSkipMatchmakingSeconds: 45
        }));
    });

    it('edits the post-match time at the hub (#198) and sends only that', async () => {
        render(<SiegeConfigurationPage />);
        const postMatch = await screen.findByLabelText(/Time at the hub after the match/);
        expect(postMatch).toHaveValue('30');

        fireEvent.change(postMatch, { target: { value: '45' } });
        fireEvent.click(screen.getByRole('button', { name: /save \(1\)/i }));

        await waitFor(() => expect(siegeConfigurationClient.update).toHaveBeenCalledWith({ postMatchSeconds: 45 }));
    });

    it('shows the siege points section (#878) and sends only the changed earn amounts and the transfer switch', async () => {
        render(<SiegeConfigurationPage />);
        const kill = await screen.findByLabelText(/Points per kill/);
        expect(kill).toHaveValue('100');
        expect(screen.getByText('Siege points')).toBeInTheDocument();
        expect(screen.getByLabelText(/Kill streak cap/)).toHaveValue('1.75');
        expect(screen.getByLabelText(/Gate HP per point/)).toHaveValue('5.5');
        expect(screen.getByLabelText(/Trickle interval/)).toHaveValue('61');
        const transfers = screen.getByLabelText(/Allow teammate transfers/);
        expect(transfers).not.toBeChecked();

        fireEvent.change(kill, { target: { value: '120' } });
        fireEvent.change(screen.getByLabelText(/Kill streak step/), { target: { value: '0,2' } });
        fireEvent.change(screen.getByLabelText(/Assist minimum damage/), { target: { value: '6' } });
        fireEvent.click(transfers);
        fireEvent.click(screen.getByRole('button', { name: /save \(4\)/i }));

        await waitFor(() => expect(siegeConfigurationClient.update).toHaveBeenCalledWith({
            pointsPerKill: 120, pointsStreakStep: 0.2, assistMinDamage: 6, pointTransfersEnabled: true
        }));
    });

    it('keeps Save off for a fractional siege point amount', async () => {
        render(<SiegeConfigurationPage />);
        const assist = await screen.findByLabelText(/Points per assist/);
        fireEvent.change(assist, { target: { value: '2.5' } });
        expect(screen.getByText('Whole number required.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
    });

    it('switches the global navigation compass on with a checkbox and sends only that', async () => {
        render(<SiegeConfigurationPage />);
        const box = await screen.findByLabelText(/Give the navigation compass at the hub/);
        expect(box).not.toBeChecked();

        fireEvent.click(box);
        fireEvent.click(screen.getByRole('button', { name: /save \(1\)/i }));

        await waitFor(() => expect(siegeConfigurationClient.update).toHaveBeenCalledWith({ giveNavigationItem: true }));
        await waitFor(() => expect(screen.getByLabelText(/Give the navigation compass at the hub/)).toBeChecked());
    });
});
