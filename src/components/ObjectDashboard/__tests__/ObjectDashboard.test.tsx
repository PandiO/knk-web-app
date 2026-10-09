import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import ObjectDashboard, { getDefaultEntityName, getEntityNamesWithPublishedDefaultDisplay } from '../ObjectDashboard';
import { displayConfigClient } from '../../../apiClients/displayConfigClient';
import { DisplayConfigurationDto } from '../../../types/dtos/displayConfig/DisplayModels';
import { logging } from '../../../utils';

// virtual: CRA's Jest resolver can't resolve react-router-dom's package exports
jest.mock('react-router-dom', () => ({
    useNavigate: () => jest.fn(),
}), { virtual: true });

jest.mock('../../../apiClients/displayConfigClient', () => ({
    displayConfigClient: { getAll: jest.fn() },
}));

const loadedMetadata = [
    { entityName: 'Town', displayName: 'Town', fields: [] },
    { entityName: 'Street', displayName: 'Street', fields: [] },
    { entityName: 'District', displayName: 'District', fields: [] },
    { entityName: 'Category', displayName: 'Category', fields: [] },
];
// The live app starts with no metadata (loading) and the built-in objectTypes list.
let mockMetadata: { baseMetadata: typeof loadedMetadata; loading: boolean } = { baseMetadata: loadedMetadata, loading: false };
jest.mock('../../../hooks/useEntityMetadata', () => ({
    useEntityMetadata: () => mockMetadata,
}));

jest.mock('../../PagedEntityTable/PagedEntityTable', () => ({
    PagedEntityTable: ({ entityTypeName }: { entityTypeName: string }) => <div data-testid="table">{entityTypeName}</div>,
}));

const getAll = displayConfigClient.getAll as jest.Mock;

const config = (entityTypeName: string, isDefault: boolean, isDraft: boolean): DisplayConfigurationDto => ({
    name: `${entityTypeName} display`,
    entityTypeName,
    isDefault,
    isDraft,
    sections: [],
});

const itemLabels = (container: HTMLElement) =>
    within(container).queryAllByRole('listitem').map(item => item.textContent?.trim());

describe('ObjectDashboard entity navigator', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        window.localStorage.clear();
        mockMetadata = { baseMetadata: loadedMetadata, loading: false };
    });

    it('does not settle on the built-in list while the metadata is still loading', async () => {
        // KNG-61 re-test: objectTypes[0] ("location") was picked during loading and kept afterwards.
        getAll.mockResolvedValue([config('Street', true, false), config('District', true, false)]);
        mockMetadata = { baseMetadata: [], loading: true };
        const builtIn = [{ id: 'location', label: 'Location', icon: null, createRoute: '/forms/location' }];

        const { rerender } = render(<ObjectDashboard objectTypes={builtIn as never} />);
        await waitFor(() => expect(getAll).toHaveBeenCalled());
        expect(screen.queryByTestId('table')).not.toBeInTheDocument();

        mockMetadata = { baseMetadata: loadedMetadata, loading: false };
        rerender(<ObjectDashboard objectTypes={builtIn as never} />);

        expect(await screen.findByTestId('table')).toHaveTextContent('District');
        expect(screen.getByRole('button', { name: /Without display configuration/ })).toHaveAttribute('aria-expanded', 'false');
    });

    it('still uses the built-in list when there is no metadata at all', async () => {
        getAll.mockResolvedValue([]);
        mockMetadata = { baseMetadata: [], loading: false };
        const builtIn = [{ id: 'location', label: 'Location', icon: null, createRoute: '/forms/location' }];

        render(<ObjectDashboard objectTypes={builtIn as never} />);

        expect(await screen.findByTestId('table')).toHaveTextContent('location');
    });

    it('opens on the first type of the Entities group, A-Z, once the grouping is known', async () => {
        // KNG-61 live test: the API's first type (often without a display configuration) was
        // selected, which re-opened the collapsed group on every visit.
        let answer: (configs: DisplayConfigurationDto[]) => void = () => undefined;
        getAll.mockReturnValue(new Promise(resolve => { answer = resolve; }));

        render(<ObjectDashboard objectTypes={[]} />);
        expect(screen.queryByTestId('table')).not.toBeInTheDocument();

        answer([config('Street', true, false), config('District', true, false)]);

        expect(await screen.findByTestId('table')).toHaveTextContent('District');
        const without = screen.getByRole('button', { name: /Without display configuration/ });
        expect(without).toHaveAttribute('aria-expanded', 'false');
    });

    it('falls back to the first type when the display configurations fail to load', async () => {
        getAll.mockRejectedValue(new Error('offline'));

        render(<ObjectDashboard objectTypes={[]} />);

        expect(await screen.findByTestId('table')).toHaveTextContent('Town');
    });

    it('picks the default type by label, falling back to API order', () => {
        const metadata = [
            { entityName: 'Town', displayName: 'Town' },
            { entityName: 'GateStructure', displayName: 'Gate structure' },
            { entityName: 'Item', displayName: null },
        ];
        expect(getDefaultEntityName(metadata, new Set(['town', 'gatestructure']))).toBe('GateStructure');
        expect(getDefaultEntityName(metadata, new Set(['item']))).toBe('Item');
        expect(getDefaultEntityName(metadata, new Set())).toBe('Town');
        expect(getDefaultEntityName(metadata, null)).toBe('Town');
        expect(getDefaultEntityName([], null)).toBe('');
    });

    it('keeps only published default configurations', () => {
        const names = getEntityNamesWithPublishedDefaultDisplay([
            config('Town', true, false),
            config('Street', true, true),
            config('District', false, false),
        ]);

        expect(Array.from(names)).toEqual(['town']);
    });

    it('loads display configurations once and groups entities by published default', async () => {
        getAll.mockResolvedValue([
            config('town', true, false),
            config('Street', true, true),
            config('District', false, false),
        ]);

        render(<ObjectDashboard objectTypes={[]} />);

        const entities = await screen.findByRole('region', { name: 'Entities' });
        expect(itemLabels(entities)).toEqual(['Town']);
        // Town is selected by default (first metadata entry), so the collapsed group stays closed.
        const toggle = screen.getByRole('button', { name: 'Without display configuration (3)' });
        expect(toggle).toHaveAttribute('aria-expanded', 'false');

        expect(getAll).toHaveBeenCalledTimes(1);
        expect(getAll).toHaveBeenCalledWith(false);
    });

    it('shows one flat list and logs when loading display configurations fails', async () => {
        const next = jest.spyOn(logging.errorHandler, 'next').mockImplementation(() => undefined);
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
        getAll.mockRejectedValue(new Error('offline'));

        render(<ObjectDashboard objectTypes={[]} />);

        await waitFor(() => expect(next).toHaveBeenCalledWith('ErrorMessage.DisplayConfiguration.LoadFailed'));
        expect(screen.queryByRole('region')).not.toBeInTheDocument();
        expect(itemLabels(screen.getByRole('complementary', { name: 'Sidebar' }))).toEqual([
            'Category', 'District', 'Street', 'Town',
        ]);
        expect(getAll).toHaveBeenCalledTimes(1);

        next.mockRestore();
        consoleError.mockRestore();
    });
});
