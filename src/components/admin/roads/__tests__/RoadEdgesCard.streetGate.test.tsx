import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import { RoadEdgesCard } from '../RoadEdgesCard';
import { roadClient } from '../../../../apiClients/roadClient';
import { streetClient } from '../../../../apiClients/streetClient';

// Jest 27 can't read react-router-dom v7's exports map; react-router has the same router and components.
jest.mock('react-router-dom', () => jest.requireActual('react-router'), { virtual: true });

// PandiO/knk-workspace#383: "Create New Street" saves through POST api/Streets, which needs knk.admin.world and
// knk.admin.content since #374; greyed out with "Requires …" without them. The edge itself stays editable.

jest.mock('../../../../apiClients/roadClient', () => ({ roadClient: { searchEdges: jest.fn(), updateEdge: jest.fn() } }));
jest.mock('../../../../apiClients/streetClient', () => ({ streetClient: { searchPaged: jest.fn(), create: jest.fn() } }));
const mockHeld = new Set<string>();
jest.mock('../../../../hooks/useStaffAccess', () => ({
    ...jest.requireActual('../../../../hooks/useStaffAccess'),
    usePermissions: (nodes: string[]) => Object.fromEntries(nodes.map(node => [node, mockHeld.has(node) ? 'allowed' : 'denied'])),
}));
jest.mock('../../../../hooks/loadedEntityMetadata', () => ({
    useLoadedEntityMetadata: () => [{
        entityName: 'Street',
        accessNode: 'knk.admin.world',
        actionNodes: { view: ['knk.admin.world'], create: ['knk.admin.world', 'knk.admin.content'] },
    }],
}));

const edge = {
    id: 7, fromNodeId: 1, toNodeId: 2, tileId: 1, world: 'world', geometry: [[0, 64, 0], [10, 64, 0]], length: 10,
    minX: 0, minY: 64, minZ: 0, maxX: 10, maxY: 64, maxZ: 0, avgWidth: 3, profileId: null, streetId: null,
    streetSource: 'None', costMultiplier: 1, flags: [], source: 'Scan', status: 'Active', gateDoorIds: [],
};

const renderCard = async () => {
    render(
        <MemoryRouter>
            <RoadEdgesCard world="world" tiles={[]} profiles={[]} streets={[]} tileId={null} onTileCleared={jest.fn()} />
        </MemoryRouter>
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Edit stretch 7' }));
    // Open the edit row's Street dropdown (nothing picked yet: its toggle reads "Select Street").
    fireEvent.click(await screen.findByRole('button', { name: /Select Street/ }));
};

describe('RoadEdgesCard Create New Street gate (#383)', () => {
    beforeEach(() => {
        mockHeld.clear();
        (roadClient.searchEdges as jest.Mock).mockResolvedValue({ items: [edge], totalCount: 1, pageNumber: 1, pageSize: 25 });
        (streetClient.searchPaged as jest.Mock).mockResolvedValue({ items: [{ id: 1, name: 'Main Street' }] });
    });

    it('greys Create New Street out for a world-only rank', async () => {
        mockHeld.add('knk.admin.world');
        await renderCard();
        const row = await screen.findByRole('button', { name: /Create New Street/ });
        expect(row).toBeDisabled();
        expect(row).toHaveTextContent('Requires knk.admin.content');
        fireEvent.click(row);
        expect(screen.queryByTestId('create-street-form')).not.toBeInTheDocument();
    });

    it('opens the new-street form with world and content', async () => {
        mockHeld.add('knk.admin.world');
        mockHeld.add('knk.admin.content');
        await renderCard();
        fireEvent.click(await screen.findByRole('button', { name: /Create New Street/ }));
        expect(screen.getByTestId('create-street-form')).toBeInTheDocument();
    });
});
