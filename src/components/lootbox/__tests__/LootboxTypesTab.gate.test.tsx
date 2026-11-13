import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import { LootboxTypesTab } from '../LootboxTypesTab';
import { lootboxTypeClient } from '../../../apiClients/lootboxTypeClient';

// Jest 27 can't read react-router-dom v7's exports map; react-router has the same router and components.
jest.mock('react-router-dom', () => jest.requireActual('react-router'), { virtual: true });

// PandiO/knk-workspace#383: Enable/Disable saves through PUT api/LootboxTypes/{id}, which needs knk.admin.content
// since #374, so the toggle is greyed out with "Requires knk.admin.content" without it.

jest.mock('../../../apiClients/lootboxTypeClient', () => ({
    lootboxTypeClient: { getAll: jest.fn(), getAllOdds: jest.fn(), getById: jest.fn(), update: jest.fn() },
}));
const mockHeld = new Set<string>();
jest.mock('../../../hooks/useStaffAccess', () => ({
    ...jest.requireActual('../../../hooks/useStaffAccess'),
    usePermissions: (nodes: string[]) => Object.fromEntries(nodes.map(node => [node, mockHeld.has(node) ? 'allowed' : 'denied'])),
}));
jest.mock('../../../hooks/loadedEntityMetadata', () => ({
    useLoadedEntityMetadata: () => [{
        entityName: 'LootboxType',
        accessNode: 'knk.admin.lootbox.manage',
        actionNodes: { view: ['knk.admin.lootbox.manage'], edit: ['knk.admin.lootbox.manage', 'knk.admin.content'] },
    }],
}));

const type = {
    id: 3, name: 'Weapons', categoryId: 1, includeSubcategories: false, enabled: false, spawnWeight: 1,
    minBoxStars: 1, maxBoxStars: 2, itemStarSpread: 1, gradeWeights: [], poolEntries: [], enchantRolls: [],
};
const client = lootboxTypeClient as jest.Mocked<typeof lootboxTypeClient>;

const renderTab = () => render(<MemoryRouter><LootboxTypesTab onShowOdds={jest.fn()} /></MemoryRouter>);

describe('LootboxTypesTab Enable/Disable gate (#383)', () => {
    beforeEach(() => {
        mockHeld.clear();
        client.getAll.mockResolvedValue([type]);
        client.getAllOdds.mockResolvedValue([]);
        client.getById.mockResolvedValue(type);
        client.update.mockResolvedValue(undefined);
    });

    it('greys the toggle out with "Requires knk.admin.content" for a lootbox rank without it', async () => {
        mockHeld.add('knk.admin.lootbox.manage');
        renderTab();
        const toggle = await screen.findByRole('button', { name: 'Enable Weapons' });
        expect(toggle).toBeDisabled();
        expect(toggle).toHaveAttribute('title', 'Requires knk.admin.content');
        expect(screen.getByText('Enable/Disable: Requires knk.admin.content')).toBeInTheDocument();
        fireEvent.click(toggle);
        expect(client.update).not.toHaveBeenCalled();
    });

    it('switches the type with the lootbox node and knk.admin.content', async () => {
        mockHeld.add('knk.admin.lootbox.manage');
        mockHeld.add('knk.admin.content');
        renderTab();
        const toggle = await screen.findByRole('button', { name: 'Enable Weapons' });
        expect(toggle).toBeEnabled();
        expect(screen.queryByText(/Enable\/Disable: Requires/)).not.toBeInTheDocument();
        fireEvent.click(toggle);
        fireEvent.click(await screen.findByRole('button', { name: 'Enable' }));
        await waitFor(() => expect(client.update).toHaveBeenCalledWith(expect.objectContaining({ id: 3, enabled: true })));
    });
});
