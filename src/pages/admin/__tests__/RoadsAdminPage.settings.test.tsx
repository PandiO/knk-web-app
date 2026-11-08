import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { createMemoryRouter, Link, RouterProvider } from 'react-router-dom';
import { RoadsAdminPage } from '../RoadsAdminPage';
import { roadClient } from '../../../apiClients/roadClient';
import { toast } from '../../../utils/toast';
import { LEAVE_SETTINGS_TITLE } from '../../../components/SettingsPage';

// Jest 27 can't read react-router-dom v7's exports map; react-router has the same router and hooks.
jest.mock('react-router-dom', () => jest.requireActual('react-router'), { virtual: true });
jest.mock('../../../apiClients/roadClient', () => ({
    roadClient: {
        getProfiles: jest.fn(), createProfile: jest.fn(), updateProfile: jest.fn(), deleteProfile: jest.fn(),
        getTiles: jest.fn(), getMeta: jest.fn(), searchEdges: jest.fn(), updateEdge: jest.fn(),
        getDomainNavigationDefaults: jest.fn(), updateDomainNavigationDefault: jest.fn(),
        getNavigationCompassSettings: jest.fn(), updateNavigationCompassSettings: jest.fn(),
    },
}));
jest.mock('../../../apiClients/streetClient', () => ({ streetClient: { searchPaged: jest.fn().mockResolvedValue({ items: [], totalCount: 0 }), create: jest.fn() } }));
jest.mock('../../../apiClients/townClient', () => ({ townClient: { searchPaged: jest.fn().mockResolvedValue({ items: [], totalCount: 0 }) } }));
jest.mock('../../../apiClients/minecraftMaterialRefClient', () => ({ minecraftMaterialRefClient: { searchPaged: jest.fn().mockResolvedValue({ items: [], totalCount: 0 }) } }));

// PandiO/knk-workspace#26: the Road network page on the SettingsPage shell. Its header saves the navigation
// defaults and the compass rule as one batch; profiles and stretches keep their own Save.

const client = roadClient as jest.Mocked<typeof roadClient>;
const COMPASS = {
    enabled: true, material: 'COMPASS', displayName: 'Navigation Compass', nameMatch: 'Exact' as const,
    siegeEnabled: true, generalEnabled: false, generalTargets: '', updatedAt: null,
};

const renderAt = () => {
    const router = createMemoryRouter([
        { path: '/admin/roads', element: <><RoadsAdminPage /><Link to="/admin">Admin overview</Link></> },
        { path: '/admin', element: <p>overview page</p> },
    ], { initialEntries: ['/admin/roads'] });
    render(<RouterProvider router={router} />);
    return router;
};

describe('RoadsAdminPage settings (#26)', () => {
    let success: jest.SpyInstance;
    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(console, 'error').mockImplementation(() => undefined);
        success = jest.spyOn(toast, 'success').mockImplementation(() => undefined);
        client.getProfiles.mockResolvedValue([]);
        client.getTiles.mockResolvedValue([]);
        client.getMeta.mockResolvedValue({ profiles: [], streets: [], components: [] });
        client.searchEdges.mockResolvedValue({ items: [], totalCount: 0, pageNumber: 1, pageSize: 25 });
        client.getDomainNavigationDefaults.mockResolvedValue([
            { domainType: 'Town', defaultMode: 'Spawn', overrideCount: 0, roadAccess: 'Applies', roadAccessOverrideCount: 0 },
            { domainType: 'District', defaultMode: 'Spawn', overrideCount: 2, roadAccess: 'Applies', roadAccessOverrideCount: 0 },
        ]);
        client.getNavigationCompassSettings.mockResolvedValue(COMPASS);
    });
    afterEach(() => {
        success.mockRestore();
        (console.error as jest.Mock).mockRestore();
    });

    it('counts default and compass changes and saves them with the header, then is clean', async () => {
        client.updateDomainNavigationDefault.mockImplementation(async (type, update) => ({
            domainType: type, defaultMode: 'Region', overrideCount: 2, roadAccess: 'Applies', roadAccessOverrideCount: 0, ...update,
        }));
        client.updateNavigationCompassSettings.mockImplementation(async draft => ({ ...COMPASS, ...draft, updatedAt: '2026-11-08T10:00:00Z' }));
        renderAt();

        const header = await screen.findByRole('banner', { name: 'Road network' });
        fireEvent.change(await screen.findByLabelText('Districts navigation default'), { target: { value: 'Region' } });
        // A choice no longer saves at once.
        expect(client.updateDomainNavigationDefault).not.toHaveBeenCalled();
        fireEvent.change(await screen.findByLabelText('Material'), { target: { value: 'RECOVERY_COMPASS' } });
        expect(header).toHaveTextContent('2 unsaved changes.');
        expect(screen.getByRole('region', { name: 'Navigation defaults' })).toHaveTextContent('Changed');
        expect(screen.getByRole('region', { name: 'Navigation compass' })).toHaveTextContent('Changed');

        fireEvent.click(within(header).getByRole('button', { name: 'Save (2)' }));

        await waitFor(() => expect(client.updateDomainNavigationDefault).toHaveBeenCalledWith('District', { defaultMode: 'Region' }));
        expect(client.updateNavigationCompassSettings).toHaveBeenCalledWith(expect.objectContaining({ material: 'RECOVERY_COMPASS' }));
        await waitFor(() => expect(success).toHaveBeenCalledWith('Saved 2 changes. The game server picks them up within a minute.'));
        expect(header).toHaveTextContent('No unsaved changes.');
    });

    it('keeps what was refused, says why in the header and keeps what saved', async () => {
        client.updateDomainNavigationDefault.mockRejectedValue(Object.assign(new Error('You may not change road settings.'), { status: 403 }));
        client.updateNavigationCompassSettings.mockImplementation(async draft => ({ ...COMPASS, ...draft, updatedAt: null }));
        renderAt();

        const header = await screen.findByRole('banner', { name: 'Road network' });
        fireEvent.change(await screen.findByLabelText('Towns entry rule on roads'), { target: { value: 'Ignored' } });
        fireEvent.change(await screen.findByLabelText('Display name'), { target: { value: 'Guide' } });
        fireEvent.click(within(header).getByRole('button', { name: 'Save (2)' }));

        expect(await within(header).findByRole('alert')).toHaveTextContent('Saved 1 change; not saved: Towns: You may not change road settings.');
        expect(header).toHaveTextContent('1 unsaved change.');
        expect(screen.getByLabelText('Towns entry rule on roads')).toHaveValue('Ignored');
        expect(success).not.toHaveBeenCalled();
    });

    it('asks before leaving with unsaved changes; Stay keeps them, Leave goes', async () => {
        const router = renderAt();
        fireEvent.change(await screen.findByLabelText('Towns navigation default'), { target: { value: 'Region' } });

        fireEvent.click(screen.getByRole('link', { name: 'Admin overview' }));
        const dialog = await screen.findByRole('alertdialog', { name: LEAVE_SETTINGS_TITLE });
        expect(dialog).toHaveTextContent('1 unsaved change on this page will be lost.');
        fireEvent.click(within(dialog).getByRole('button', { name: 'Stay' }));
        await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
        expect(router.state.location.pathname).toBe('/admin/roads');
        expect(screen.getByLabelText('Towns navigation default')).toHaveValue('Region');

        fireEvent.click(screen.getByRole('link', { name: 'Admin overview' }));
        fireEvent.click(within(await screen.findByRole('alertdialog', { name: LEAVE_SETTINGS_TITLE })).getByRole('button', { name: 'Leave' }));
        expect(await screen.findByText('overview page')).toBeInTheDocument();
    });

    it('Discard puts the saved choices back without a request', async () => {
        renderAt();
        fireEvent.change(await screen.findByLabelText('Towns navigation default'), { target: { value: 'Region' } });
        fireEvent.click(screen.getByRole('button', { name: /Discard/ }));
        const dialog = await screen.findByRole('alertdialog');
        await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Discard' })); });
        expect(screen.getByLabelText('Towns navigation default')).toHaveValue('Spawn');
        expect(client.updateDomainNavigationDefault).not.toHaveBeenCalled();
    });
});
