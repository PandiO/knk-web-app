import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { roadClient } from '../../../../apiClients/roadClient';
import { DomainNavigationDefaultsCard } from '../DomainNavigationDefaultsCard';
import { DomainNavigationDefaultDto } from '../../../../types/dtos/road/RoadDtos';

// KNG-73: where /navigate <domain> leads without spawn/region, per domain type; rev. 7 Part C (KNG-92):
// whether each type's entry rule keeps routes off its roads.

jest.mock('../../../../apiClients/roadClient', () => ({
    roadClient: { getDomainNavigationDefaults: jest.fn(), updateDomainNavigationDefault: jest.fn() },
}));

const getDefaults = roadClient.getDomainNavigationDefaults as jest.Mock;
const updateDefault = roadClient.updateDomainNavigationDefault as jest.Mock;

const defaults: DomainNavigationDefaultDto[] = [
    { domainType: 'Town', defaultMode: 'Spawn', overrideCount: 0, roadAccess: 'Applies', roadAccessOverrideCount: 0 },
    { domainType: 'District', defaultMode: 'Spawn', overrideCount: 2, roadAccess: 'Applies', roadAccessOverrideCount: 0 },
    { domainType: 'Structure', defaultMode: 'Spawn', overrideCount: 0, roadAccess: 'Ignored', roadAccessOverrideCount: 3 },
    { domainType: 'GateStructure', defaultMode: 'Region', overrideCount: 0, roadAccess: 'Applies', roadAccessOverrideCount: 0 },
];

describe('DomainNavigationDefaultsCard', () => {
    beforeEach(() => {
        getDefaults.mockReset();
        updateDefault.mockReset();
    });

    it('lists every domain type with its default and override count', async () => {
        getDefaults.mockResolvedValue(defaults);
        render(<DomainNavigationDefaultsCard />);

        expect(await screen.findByLabelText('Towns navigation default')).toHaveValue('Spawn');
        expect(screen.getByLabelText('Gates navigation default')).toHaveValue('Region');
        expect(screen.getByText('Districts').closest('tr')).toHaveTextContent('2');
    });

    it('saves a changed default for that type', async () => {
        getDefaults.mockResolvedValue(defaults);
        updateDefault.mockResolvedValue({ ...defaults[1], defaultMode: 'Region' });
        render(<DomainNavigationDefaultsCard />);

        fireEvent.change(await screen.findByLabelText('Districts navigation default'), { target: { value: 'Region' } });

        expect(updateDefault).toHaveBeenCalledWith('District', { defaultMode: 'Region' });
        await waitFor(() => expect(screen.getByLabelText('Districts navigation default')).toHaveValue('Region'));
    });

    it('lists each type\'s entry rule on roads and its override count', async () => {
        getDefaults.mockResolvedValue(defaults);
        render(<DomainNavigationDefaultsCard />);

        expect(await screen.findByLabelText('Structures entry rule on roads')).toHaveValue('Ignored');
        expect(screen.getByLabelText('Towns entry rule on roads')).toHaveValue('Applies');
        expect(screen.getByText('Structures').closest('tr')).toHaveTextContent('3');
    });

    it('saves only the entry rule when that changes', async () => {
        getDefaults.mockResolvedValue(defaults);
        updateDefault.mockResolvedValue({ ...defaults[0], roadAccess: 'Ignored' });
        render(<DomainNavigationDefaultsCard />);

        fireEvent.change(await screen.findByLabelText('Towns entry rule on roads'), { target: { value: 'Ignored' } });

        expect(updateDefault).toHaveBeenCalledWith('Town', { roadAccess: 'Ignored' });
        await waitFor(() => expect(screen.getByLabelText('Towns entry rule on roads')).toHaveValue('Ignored'));
        expect(screen.getByLabelText('Towns navigation default')).toHaveValue('Spawn');
    });

    it('shows the API message when a save is refused', async () => {
        getDefaults.mockResolvedValue(defaults);
        updateDefault.mockRejectedValue(Object.assign(new Error('You may not change road settings.'), { status: 403 }));
        render(<DomainNavigationDefaultsCard />);

        fireEvent.change(await screen.findByLabelText('Towns navigation default'), { target: { value: 'Region' } });

        expect(await screen.findByText('Towns: You may not change road settings.')).toBeInTheDocument();
        expect(screen.getByLabelText('Towns navigation default')).toHaveValue('Spawn');
    });

    it('says so when the defaults cannot be loaded', async () => {
        getDefaults.mockRejectedValue(new Error('down'));
        render(<DomainNavigationDefaultsCard />);

        expect(await screen.findByText('Could not load the navigation defaults.')).toBeInTheDocument();
    });
});
