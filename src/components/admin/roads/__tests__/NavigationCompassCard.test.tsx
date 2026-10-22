import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { roadClient } from '../../../../apiClients/roadClient';
import { NavigationCompassCard, describeCompassRule } from '../NavigationCompassCard';
import { NavigationCompassSettingsDto } from '../../../../types/dtos/road/RoadDtos';

// KNG-234: the item rule (material + display name) of the navigation compass and where it works.

jest.mock('../../../../apiClients/roadClient', () => ({
    roadClient: { getNavigationCompassSettings: jest.fn(), updateNavigationCompassSettings: jest.fn() },
}));

const getSettings = roadClient.getNavigationCompassSettings as jest.Mock;
const updateSettings = roadClient.updateNavigationCompassSettings as jest.Mock;

const defaults: NavigationCompassSettingsDto = {
    enabled: true,
    material: 'COMPASS',
    displayName: 'Navigation Compass',
    nameMatch: 'Exact',
    siegeEnabled: true,
    generalEnabled: false,
    generalTargets: '',
    updatedAt: null,
};

describe('NavigationCompassCard', () => {
    beforeEach(() => {
        getSettings.mockReset();
        updateSettings.mockReset();
    });

    it('shows the saved item rule', async () => {
        getSettings.mockResolvedValue(defaults);
        render(<NavigationCompassCard />);

        expect(await screen.findByDisplayValue('COMPASS')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Navigation Compass')).toBeInTheDocument();
        expect(screen.getByText(/Matches a COMPASS whose name is “Navigation Compass”/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Save compass settings' })).toBeDisabled();
    });

    it('saves the edited rule and shows what the server answered', async () => {
        getSettings.mockResolvedValue(defaults);
        updateSettings.mockResolvedValue({ ...defaults, material: 'RECOVERY_COMPASS', displayName: 'Siege Compass', nameMatch: 'Contains' });
        render(<NavigationCompassCard />);

        fireEvent.change(await screen.findByDisplayValue('COMPASS'), { target: { value: 'RECOVERY_COMPASS' } });
        fireEvent.change(screen.getByDisplayValue('Navigation Compass'), { target: { value: 'Siege Compass' } });
        fireEvent.change(screen.getByDisplayValue('Exact'), { target: { value: 'Contains' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save compass settings' }));

        await waitFor(() => expect(updateSettings).toHaveBeenCalledWith({
            enabled: true,
            material: 'RECOVERY_COMPASS',
            displayName: 'Siege Compass',
            nameMatch: 'Contains',
            siegeEnabled: true,
            generalEnabled: false,
            generalTargets: '',
        }));
        expect(await screen.findByText(/Saved\./)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Save compass settings' })).toBeDisabled();
    });

    it('only lets the destinations outside sieges be edited while the compass works there', async () => {
        getSettings.mockResolvedValue(defaults);
        updateSettings.mockResolvedValue({ ...defaults, generalEnabled: true, generalTargets: 'town:Kardenna' });
        render(<NavigationCompassCard />);

        const targets = await screen.findByLabelText('Destinations outside sieges');
        expect(targets).toBeDisabled();

        fireEvent.click(screen.getByLabelText('Works outside sieges'));
        expect(targets).toBeEnabled();
        fireEvent.change(targets, { target: { value: 'town:Kardenna' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save compass settings' }));

        await waitFor(() => expect(updateSettings).toHaveBeenCalledWith(
            expect.objectContaining({ generalEnabled: true, generalTargets: 'town:Kardenna' })));
    });

    it('shows why a save was refused and keeps the edit', async () => {
        getSettings.mockResolvedValue(defaults);
        updateSettings.mockRejectedValue(Object.assign(new Error('material must be a Minecraft material.'), { status: 400, response: { error: 'ValidationFailed', message: 'material must be a Minecraft material.' } }));
        render(<NavigationCompassCard />);

        fireEvent.change(await screen.findByDisplayValue('COMPASS'), { target: { value: 'not a material' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save compass settings' }));

        await waitFor(() => expect(updateSettings).toHaveBeenCalled());
        expect(await screen.findByText('material must be a Minecraft material.')).toBeInTheDocument();
        expect(screen.getByDisplayValue('not a material')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Save compass settings' })).toBeEnabled();
    });

    it('says when the settings could not be loaded', async () => {
        getSettings.mockRejectedValue(new Error('boom'));
        jest.spyOn(console, 'error').mockImplementation(() => undefined);
        render(<NavigationCompassCard />);

        expect(await screen.findByText('Could not load the navigation compass settings.')).toBeInTheDocument();
    });

    it('describes an empty display name as material only', () => {
        expect(describeCompassRule({ ...defaults, displayName: ' ' })).toBe('any COMPASS (whatever its name)');
        expect(describeCompassRule({ ...defaults, nameMatch: 'Contains' })).toBe('a COMPASS whose name contains “Navigation Compass”');
    });
});
