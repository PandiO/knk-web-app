import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { buildCreateMenuItems, CreateNewMenu, createMenuTarget } from '../CreateNewMenu';

/** #177 link 2 (#39 CRUD-2): the Create New menu is built from the entity metadata. */

const mockNavigate = jest.fn();
// virtual: CRA's Jest resolver can't resolve react-router-dom's package exports
jest.mock('react-router-dom', () => ({
    useNavigate: () => mockNavigate,
}), { virtual: true });

const mockMetadata = {
    baseMetadata: [
        { entityName: 'Town', displayName: 'Town', fields: [] },
        { entityName: 'ItemBlueprint', displayName: 'Item blueprint', fields: [] },
        { entityName: 'Kit', displayName: 'Kit', fields: [] },
        { entityName: 'GateDoor', displayName: 'Gate door', fields: [] },
        { entityName: 'AuditEntry', displayName: 'Audit entry', fields: [] },
    ],
};
jest.mock('../../hooks/useEntityMetadata', () => ({
    useEntityMetadata: () => mockMetadata,
}));

const builtIn = [
    { id: 'town', label: 'Town', icon: <span data-testid="town-icon" />, createRoute: '/forms/town' },
    { id: 'itemType', label: 'Item Type', icon: null, createRoute: '/forms/itemType' },
];

describe('buildCreateMenuItems', () => {
    it('lists the metadata types the app can create, A-Z, with built-in icons where there are some', () => {
        const items = buildCreateMenuItems(mockMetadata.baseMetadata, builtIn);

        // AuditEntry has no create client; itemType (built-in only) is not offered.
        expect(items.map(item => item.label)).toEqual(['Gate door', 'Item blueprint', 'Kit', 'Town']);
        render(<>{items.find(item => item.entityName === 'Town')!.icon}</>);
        expect(screen.getByTestId('town-icon')).toBeInTheDocument();
    });

    it('falls back to the built-in list (still checked) without metadata, and drops duplicates', () => {
        expect(buildCreateMenuItems([], builtIn).map(item => item.entityName)).toEqual(['town']);
        const twice = [{ entityName: 'Town', displayName: 'Town' }, { entityName: 'town', displayName: 'Town' }];
        expect(buildCreateMenuItems(twice, [], () => true)).toHaveLength(1);
    });

    it('opens the default form and comes back to the dashboard on the type', () => {
        expect(createMenuTarget('Kit')).toBe('/forms/Kit?autoOpen=true&returnTo=%2Fdashboard%2FKit');
    });
});

describe('CreateNewMenu', () => {
    beforeEach(() => mockNavigate.mockClear());

    const open = () => {
        render(<CreateNewMenu objectTypes={builtIn} />);
        fireEvent.click(screen.getByTitle('Create a new object'));
        return screen.getByRole('list', { name: 'Entity types' });
    };

    it('navigates once to the picked type', () => {
        const list = open();

        fireEvent.click(within(list).getByRole('button', { name: /Kit/ }));

        expect(mockNavigate).toHaveBeenCalledTimes(1);
        expect(mockNavigate).toHaveBeenCalledWith('/forms/Kit?autoOpen=true&returnTo=%2Fdashboard%2FKit');
        expect(screen.queryByRole('list', { name: 'Entity types' })).not.toBeInTheDocument();
    });

    it('filters, moves with the arrow keys and opens with Enter from the focused filter box', () => {
        open();
        const filter = screen.getByRole('searchbox', { name: 'Filter entity types to create' });
        expect(filter).toHaveFocus();

        fireEvent.change(filter, { target: { value: 'gate' } });
        expect(within(screen.getByRole('list', { name: 'Entity types' })).getAllByRole('button')).toHaveLength(1);

        fireEvent.change(filter, { target: { value: '' } });
        fireEvent.keyDown(filter, { key: 'ArrowDown' });
        fireEvent.keyDown(filter, { key: 'ArrowDown' });
        fireEvent.keyDown(filter, { key: 'Enter' });

        expect(mockNavigate).toHaveBeenCalledTimes(1);
        expect(mockNavigate).toHaveBeenCalledWith('/forms/Kit?autoOpen=true&returnTo=%2Fdashboard%2FKit');
    });

    it('closes on Escape and gives focus back to the button', () => {
        open();
        fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'Escape' });

        expect(screen.queryByRole('list', { name: 'Entity types' })).not.toBeInTheDocument();
        expect(screen.getByTitle('Create a new object')).toHaveFocus();
        expect(mockNavigate).not.toHaveBeenCalled();
    });
});
