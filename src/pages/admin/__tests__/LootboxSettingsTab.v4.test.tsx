import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { LootboxesPage } from '../LootboxesPage';
import { lootboxConfigurationClient } from '../../../apiClients/lootboxConfigurationClient';
import { lootboxSpawnAreaClient } from '../../../apiClients/lootboxSpawnAreaClient';
import { LEAVE_SETTINGS_TITLE } from '../../../components/SettingsPage';
import {
    ANNOUNCE_NEVER, fillAnnouncement, lootboxSwitchQuestion, unknownPlaceholders,
} from '../../../components/lootbox/LootboxSettingsTab';
import { typeToggleQuestion } from '../../../components/lootbox/LootboxTypesTab';
import { toast } from '../../../utils/toast';

// Jest 27 can't read react-router-dom v7's exports map; react-router has the same router and hooks.
jest.mock('react-router-dom', () => jest.requireActual('react-router'), { virtual: true });
jest.mock('../../../apiClients/lootboxConfigurationClient', () => ({ lootboxConfigurationClient: { get: jest.fn(), update: jest.fn() } }));
jest.mock('../../../apiClients/lootboxSpawnAreaClient', () => ({ lootboxSpawnAreaClient: { getAll: jest.fn() } }));

// PandiO/knk-workspace#26: the Lootboxes page's Settings tab on the SettingsPage shell (inside the tab), with
// units, help, the announcement preview and a question before switching lootboxes off.

const config = lootboxConfigurationClient as jest.Mocked<typeof lootboxConfigurationClient>;
const CONFIG = {
    enabled: true, globalMaxActive: 15, maxClaimsPerPlayerPerDay: 10, announceMinItemStars: 5, announceSpawnMinBoxStars: 6,
    dropAnnouncementTemplate: '&6{player} &efound {item} &ein a {box}!', spawnAnnouncementTemplate: '',
    updatedAt: '2026-09-26T10:00:00Z',
};

const renderTab = () => {
    const router = createMemoryRouter([{ path: '/admin/lootboxes', element: <LootboxesPage /> }], {
        initialEntries: ['/admin/lootboxes?tab=settings'],
    });
    render(<RouterProvider router={router} />);
    return router;
};

describe('Lootbox settings tab (#26)', () => {
    let success: jest.SpyInstance;
    beforeEach(() => {
        config.get.mockResolvedValue(CONFIG);
        config.update.mockImplementation(async dto => ({ ...dto, updatedAt: '2026-11-08T10:00:00Z' }));
        (lootboxSpawnAreaClient.getAll as jest.Mock).mockResolvedValue([]);
        success = jest.spyOn(toast, 'success').mockImplementation(() => undefined);
    });
    afterEach(() => success.mockRestore());

    it('is a settings shell inside the tab: an h2 under the page h1, a count, Save (n)', async () => {
        renderTab();
        const header = await screen.findByRole('banner', { name: 'Lootbox settings' });
        expect(within(header).getByRole('heading', { level: 2, name: 'Lootbox settings' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { level: 1, name: /Lootboxes/ })).toBeInTheDocument();
        fireEvent.change(await screen.findByLabelText('Max active boxes (all areas)'), { target: { value: '20' } });
        expect(header).toHaveTextContent('1 unsaved change.');
        expect(screen.getByRole('region', { name: 'Limits' })).toHaveTextContent('Changed');
        expect(screen.getByLabelText('Max active boxes (all areas)')).toHaveAccessibleDescription(expect.stringContaining('boxes'));
    });

    it('a tab switch with changes asks "Leave without saving?"; Stay keeps them, Leave switches', async () => {
        const router = renderTab();
        fireEvent.change(await screen.findByLabelText('Max active boxes (all areas)'), { target: { value: '20' } });

        fireEvent.click(screen.getByRole('tab', { name: 'Areas' }));
        let dialog = await screen.findByRole('alertdialog', { name: LEAVE_SETTINGS_TITLE });
        expect(dialog).toHaveTextContent('1 unsaved change in Lootbox settings will be lost.');
        fireEvent.click(within(dialog).getByRole('button', { name: 'Stay' }));
        await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
        expect(screen.getByRole('tab', { name: 'Settings' })).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByLabelText('Max active boxes (all areas)')).toHaveValue('20');

        fireEvent.click(screen.getByRole('tab', { name: 'Areas' }));
        dialog = await screen.findByRole('alertdialog', { name: LEAVE_SETTINGS_TITLE });
        fireEvent.click(within(dialog).getByRole('button', { name: 'Leave' }));
        await waitFor(() => expect(screen.getByRole('tab', { name: 'Areas' })).toHaveAttribute('aria-selected', 'true'));
        expect(router.state.location.search).toBe('?tab=areas');
        expect(config.update).not.toHaveBeenCalled();
    });

    it('switches tabs without asking when nothing changed', async () => {
        renderTab();
        await screen.findByLabelText('Max active boxes (all areas)');
        fireEvent.click(screen.getByRole('tab', { name: 'Areas' }));
        await waitFor(() => expect(screen.getByRole('tab', { name: 'Areas' })).toHaveAttribute('aria-selected', 'true'));
        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });

    it('previews both announcements with sample values, the empty one as the default', async () => {
        renderTab();
        const drop = await screen.findByRole('group', { name: 'Drop announcement preview' });
        expect(drop).toHaveTextContent('Steve found [Golemheart Sword] in a Weapons Lootbox ★★★★★!');
        const spawn = screen.getByRole('group', { name: 'Spawn announcement preview' });
        expect(spawn).toHaveTextContent('Preview (the default)');
        expect(spawn).toHaveTextContent('A Weapons Lootbox ★★★★★ appeared in Market Square!');

        fireEvent.change(screen.getByLabelText('Drop announcement'), { target: { value: '&a{player} got {loot}' } });
        expect(drop).toHaveTextContent('Steve got {loot}');
        expect(screen.getByLabelText('Drop announcement')).toHaveAccessibleDescription(expect.stringContaining('Not filled in by the game: {loot}'));
    });

    it('offers the thresholds as choices with "Never" for 11, and says what they mean', async () => {
        renderTab();
        const items = await screen.findByLabelText('Announce drops of items from');
        expect(items).toHaveValue('5');
        expect(items).toHaveAccessibleDescription(expect.stringContaining('★5 item or better'));
        fireEvent.change(items, { target: { value: String(ANNOUNCE_NEVER) } });
        expect(items).toHaveAccessibleDescription(expect.stringContaining('No drop is announced'));
        fireEvent.click(within(screen.getByRole('banner', { name: 'Lootbox settings' })).getByRole('button', { name: 'Save (1)' }));
        await waitFor(() => expect(config.update).toHaveBeenCalledWith(expect.objectContaining({ announceMinItemStars: 11 })));
        await waitFor(() => expect(success).toHaveBeenCalledWith('Lootbox settings saved.'));
    });

    it('asks before saving lootboxes off; Cancel keeps the change unsaved', async () => {
        renderTab();
        fireEvent.click(await screen.findByLabelText('Lootboxes enabled'));
        const header = screen.getByRole('banner', { name: 'Lootbox settings' });
        fireEvent.click(within(header).getByRole('button', { name: 'Save (1)' }));
        let dialog = await screen.findByRole('alertdialog', { name: 'Switch lootboxes off?' });
        expect(dialog).toHaveTextContent('Nothing spawns and no box can be claimed');
        fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
        await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
        expect(config.update).not.toHaveBeenCalled();
        expect(header).toHaveTextContent('1 unsaved change.');

        fireEvent.click(within(header).getByRole('button', { name: 'Save (1)' }));
        dialog = await screen.findByRole('alertdialog', { name: 'Switch lootboxes off?' });
        await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Switch off and save' })); });
        await waitFor(() => expect(config.update).toHaveBeenCalledWith(expect.objectContaining({ enabled: false })));
    });

    it('shows a refused save in the header and keeps the edit', async () => {
        config.update.mockRejectedValue(Object.assign(new Error('globalMaxActive must be at most 500.'), { status: 400 }));
        renderTab();
        fireEvent.change(await screen.findByLabelText('Max active boxes (all areas)'), { target: { value: '9999' } });
        const header = screen.getByRole('banner', { name: 'Lootbox settings' });
        fireEvent.click(within(header).getByRole('button', { name: 'Save (1)' }));
        expect(await within(header).findByRole('alert')).toHaveTextContent('globalMaxActive must be at most 500.');
        expect(screen.getByLabelText('Max active boxes (all areas)')).toHaveValue('9999');
    });

    it('shows the load failure with Retry instead of the form', async () => {
        config.get.mockRejectedValue(Object.assign(new Error('Forbidden'), { status: 403 }));
        renderTab();
        expect(await screen.findByRole('button', { name: 'Retry' })).toBeInTheDocument();
        expect(screen.queryByLabelText('Max active boxes (all areas)')).not.toBeInTheDocument();
    });
});

describe('lootbox settings helpers (#26)', () => {
    it('fills the template, falling back to the default when empty', () => {
        expect(fillAnnouncement('{player} / {box}', 'x')).toBe('Steve / &dWeapons Lootbox ★★★★★');
        expect(fillAnnouncement('  ', 'Default {area}')).toBe('Default Market Square');
    });

    it('lists placeholders the game does not fill in, once each', () => {
        expect(unknownPlaceholders('{player} {loot} {loot} {box}', ['{player}', '{box}'])).toEqual(['{loot}']);
        expect(unknownPlaceholders('no braces', ['{box}'])).toEqual([]);
    });

    it('asks only when the master switch changes, red for off', () => {
        expect(lootboxSwitchQuestion(true, true)).toBeNull();
        expect(lootboxSwitchQuestion(true, false)).toEqual(expect.objectContaining({ title: 'Switch lootboxes off?', danger: true }));
        expect(lootboxSwitchQuestion(false, true)).toEqual(expect.objectContaining({ title: 'Switch lootboxes on?', danger: false }));
    });

    it('words a type switch by its direction', () => {
        expect(typeToggleQuestion({ name: 'Food Lootbox', enabled: true }).title).toBe('Disable Food Lootbox?');
        expect(typeToggleQuestion({ name: 'Food Lootbox', enabled: false }).message).toMatch(/start spawning/);
    });
});
