import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { roadClient } from '../../../apiClients/roadClient';
import { FieldRenderer } from '../../FormWizard/FieldRenderers';
import { FieldType } from '../../../utils/enums';
import { StreetRoadDto } from '../../../types/dtos/road/RoadDtos';

// Road navigation Phase 5: the Street form's read-only road panel (displayPanel "streetRoad").

jest.mock('../../../apiClients/roadClient', () => ({
    roadClient: { getStreetRoad: jest.fn() },
}));

const getStreetRoad = roadClient.getStreetRoad as jest.Mock;

const roadField = {
    id: '99',
    fieldName: 'Id',
    label: 'Road',
    description: 'The stretches carrying this street.',
    fieldType: FieldType.Integer,
    isRequired: false,
    isReadOnly: true,
    order: 0,
    isReusable: false,
    isLinkedToSource: false,
    hasCompatibilityIssues: false,
    validations: [],
    settingsJson: '{"displayPanel":"streetRoad"}'
};

const road: StreetRoadDto = {
    streetId: 5,
    name: 'Market Street',
    edgeCount: 2,
    totalLength: 511.4,
    nodes: [
        { id: 1, world: 'world', x: 0, y: 64, z: 100, tileId: 1, kind: 'Boundary', source: 'Detected', name: null, componentId: 1, locked: false },
        { id: 2, world: 'world', x: 200, y: 64, z: 100, tileId: 1, kind: 'Junction', source: 'Detected', name: null, componentId: 1, locked: false },
        { id: 3, world: 'world', x: 511, y: 64, z: 100, tileId: 1, kind: 'Boundary', source: 'Detected', name: null, componentId: 1, locked: false },
    ],
    edges: [
        {
            id: 10, fromNodeId: 1, toNodeId: 2, tileId: 1, world: 'world', geometry: [[0, 64, 100], [200, 64, 100]], length: 200,
            minX: 0, minY: 64, minZ: 100, maxX: 200, maxY: 64, maxZ: 100, avgWidth: 3, profileId: 1, streetId: 5, streetSource: 'Inferred',
            costMultiplier: 1, flags: [], gateDoorIds: [], domainIds: [], regionIds: [], source: 'Detected', status: 'Ok',
        },
        {
            id: 11, fromNodeId: 2, toNodeId: 3, tileId: 1, world: 'world', geometry: [[200, 64, 100], [511, 64, 100]], length: 311.4,
            minX: 200, minY: 64, minZ: 100, maxX: 511, maxY: 64, maxZ: 100, avgWidth: 3, profileId: 1, streetId: 5, streetSource: 'Manual',
            costMultiplier: 1, flags: ['Oneway'], gateDoorIds: [], domainIds: [], regionIds: [], source: 'Detected', status: 'Stale',
        },
    ],
};

describe('Street road panel (displayPanel field)', () => {
    beforeEach(() => {
        getStreetRoad.mockReset();
    });

    const renderPanel = (entityId?: string) => render(
        <FieldRenderer field={roadField} value={entityId ? Number(entityId) : null} onChange={jest.fn()} parentEntityId={entityId} />
    );

    it('asks for a save first while the street has no id, without calling the API', () => {
        renderPanel(undefined);

        expect(screen.getByText(/submit to save the street first/i)).toBeInTheDocument();
        expect(getStreetRoad).not.toHaveBeenCalled();
        expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
    });

    it('shows the loading state, then the stretches with their totals', async () => {
        let resolve: (value: StreetRoadDto) => void = () => undefined;
        getStreetRoad.mockReturnValue(new Promise<StreetRoadDto>((r) => { resolve = r; }));

        renderPanel('5');
        expect(screen.getByText('Loading…')).toBeInTheDocument();
        expect(getStreetRoad).toHaveBeenCalledWith(5);

        resolve(road);
        await waitFor(() => expect(screen.getByText('2')).toBeInTheDocument());
        expect(screen.getByText('stretches')).toBeInTheDocument();
        expect(screen.getByText('511')).toBeInTheDocument();
        expect(screen.getByText('#11')).toBeInTheDocument();
        expect(screen.getByText('0, 64, 100')).toBeInTheDocument();
        expect(screen.getByText('Oneway')).toBeInTheDocument();
        expect(screen.getByText('Detected · stale')).toBeInTheDocument();
        expect(screen.getAllByRole('link', { name: 'Roads page' })[0]).toHaveAttribute('href', '/admin/roads');
    });

    it('says so when no stretch carries the street yet, and refreshes on demand', async () => {
        getStreetRoad.mockResolvedValue({ ...road, edgeCount: 0, totalLength: 0, edges: [], nodes: [] });

        renderPanel('5');

        await waitFor(() => expect(screen.getByText(/no road stretch carries this street yet/i)).toBeInTheDocument());
        fireEvent.click(screen.getByRole('button', { name: /refresh/i }));
        await waitFor(() => expect(getStreetRoad).toHaveBeenCalledTimes(2));
    });

    it('shows the API error when the road cannot be loaded', async () => {
        getStreetRoad.mockRejectedValue(new Error('down'));

        renderPanel('5');

        await waitFor(() => expect(screen.getByText('down')).toBeInTheDocument());
    });

    it('explains a missing street (404)', async () => {
        getStreetRoad.mockRejectedValue(Object.assign(new Error('HTTP 404: Not Found'), { status: 404 }));

        renderPanel('5');

        await waitFor(() => expect(screen.getByText('This street does not exist (any more).')).toBeInTheDocument());
    });
});
