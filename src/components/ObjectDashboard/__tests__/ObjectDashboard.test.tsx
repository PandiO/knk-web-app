import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import ObjectDashboard, { getDefaultEntityName, getEntityNamesWithPublishedDefaultDisplay } from '../ObjectDashboard';
import { displayConfigClient } from '../../../apiClients/displayConfigClient';
import { DisplayConfigurationDto } from '../../../types/dtos/displayConfig/DisplayModels';
import { logging } from '../../../utils';

// virtual: CRA's Jest resolver can't resolve react-router-dom's package exports
const mockNavigate = jest.fn();
let mockParams: { entityName?: string } = {};
let mockLocation = { pathname: '/dashboard', search: '' };
jest.mock('react-router-dom', () => ({
    useNavigate: () => mockNavigate,
    useParams: () => mockParams,
    useLocation: () => mockLocation,
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

// The table renders one row with the dashboard's own row actions (View, Edit, Delete), a "row"
// button for the row click (absent when the dashboard gives none) and the empty state.
jest.mock('../../PagedEntityTable/PagedEntityTable', () => ({
    PagedEntityTable: ({ entityTypeName, rowActions, onRowClick, emptyState }: {
        entityTypeName: string;
        rowActions?: Array<(row: unknown) => React.ReactNode>;
        onRowClick?: (row: unknown) => void;
        emptyState?: React.ReactNode;
    }) => (
        <div>
            <div data-testid="table">{entityTypeName}</div>
            {onRowClick && <button type="button" onClick={() => onRowClick({ id: 7, name: 'Row seven' })}>row</button>}
            {rowActions?.map((action, index) => <span key={index}>{action({ id: 7, name: 'Row seven' })}</span>)}
            <div data-testid="empty-state">{emptyState}</div>
        </div>
    ),
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
        mockParams = {};
        mockLocation = { pathname: '/dashboard', search: '' };
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
    });

    it('still uses the built-in list when there is no metadata at all', async () => {
        getAll.mockResolvedValue([]);
        mockMetadata = { baseMetadata: [], loading: false };
        const builtIn = [{ id: 'location', label: 'Location', icon: null, createRoute: '/forms/location' }];

        render(<ObjectDashboard objectTypes={builtIn as never} />);

        expect(await screen.findByTestId('table')).toHaveTextContent('location');
    });

    it('opens on the first type with a display configuration, A-Z, once that is known', async () => {
        // KNG-61 live test: the API's first type (often without a display configuration) was
        // selected, which re-opened the collapsed group on every visit.
        let answer: (configs: DisplayConfigurationDto[]) => void = () => undefined;
        getAll.mockReturnValue(new Promise(resolve => { answer = resolve; }));

        render(<ObjectDashboard objectTypes={[]} />);
        expect(screen.queryByTestId('table')).not.toBeInTheDocument();

        answer([config('Street', true, false), config('District', true, false)]);

        expect(await screen.findByTestId('table')).toHaveTextContent('District');
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

    it('loads display configurations once and shows one flat list, marking types without a published default (#177 link 2)', async () => {
        getAll.mockResolvedValue([
            config('town', true, false),
            config('Street', true, true),
            config('District', false, false),
        ]);

        render(<ObjectDashboard objectTypes={[]} />);

        await screen.findByTestId('table');
        const sidebar = screen.getByRole('complementary', { name: 'Sidebar' });
        expect(screen.queryByRole('region')).not.toBeInTheDocument();
        await waitFor(() => expect(within(sidebar).getAllByTestId('explorer-marker')).toHaveLength(3));
        const markedRows = within(sidebar).getAllByTestId('explorer-marker').map(marker => marker.closest('li')?.textContent);
        expect(markedRows.map(text => text?.replace('No display configuration – set one up via ⚙', '').trim()).sort())
            .toEqual(['Category', 'District', 'Street']);
        expect(within(sidebar).getAllByTestId('explorer-marker')[0]).toHaveAttribute('title', 'No display configuration – set one up via ⚙');

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

describe('ObjectDashboard favourite types (PandiO/knk-workspace#194)', () => {
    // Category and Town have no display configuration here: drop their marker's hint text.
    const typeNames = (container: HTMLElement) =>
        itemLabels(container).map(text => text?.replace('No display configuration – set one up via ⚙', ''));

    beforeEach(() => {
        jest.clearAllMocks();
        window.localStorage.clear();
        mockMetadata = { baseMetadata: loadedMetadata, loading: false };
        mockParams = { entityName: 'District' };
        mockLocation = { pathname: '/dashboard/District', search: '' };
        getAll.mockResolvedValue([config('Street', true, false), config('District', true, false)]);
    });

    it('stars a type to the top of the explorer and remembers it in this browser', async () => {
        render(<ObjectDashboard objectTypes={[]} />);
        await screen.findByTestId('table');
        const sidebar = screen.getByRole('complementary', { name: 'Sidebar' });

        fireEvent.click(within(sidebar).getByRole('button', { name: 'Add Town to favourites' }));
        fireEvent.click(within(sidebar).getByRole('button', { name: 'Add Category to favourites' }));

        expect(typeNames(within(sidebar).getByRole('region', { name: 'Favourites' }))).toEqual(['Category', 'Town']);
        expect(typeNames(sidebar)).toEqual(['Category', 'Town', 'District', 'Street']);
        expect(JSON.parse(window.localStorage.getItem('knk.dashboard.favouriteEntityTypes') ?? '[]')).toEqual(['Town', 'Category']);
        expect(mockNavigate).not.toHaveBeenCalled();

        fireEvent.click(within(sidebar).getByRole('button', { name: 'Remove Town from favourites' }));
        expect(typeNames(sidebar)).toEqual(['Category', 'District', 'Street', 'Town']);
        expect(JSON.parse(window.localStorage.getItem('knk.dashboard.favouriteEntityTypes') ?? '[]')).toEqual(['Category']);
    });

    it('lists the stored favourites first on the next visit', async () => {
        window.localStorage.setItem('knk.dashboard.favouriteEntityTypes', '["Street","town"]');

        render(<ObjectDashboard objectTypes={[]} />);
        await screen.findByTestId('table');

        expect(typeNames(screen.getByRole('complementary', { name: 'Sidebar' })))
            .toEqual(['Street', 'Town', 'Category', 'District']);
    });
});

describe('ObjectDashboard type in the URL (#177 link 1, #58)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        window.localStorage.clear();
        mockMetadata = { baseMetadata: loadedMetadata, loading: false };
        mockParams = {};
        mockLocation = { pathname: '/dashboard', search: '' };
        getAll.mockResolvedValue([config('Street', true, false), config('District', true, false)]);
    });

    it('opens the type named in the URL, whatever its case, and remembers it', async () => {
        mockParams = { entityName: 'street' };
        mockLocation = { pathname: '/dashboard/street', search: '' };

        render(<ObjectDashboard objectTypes={[]} />);

        expect(await screen.findByTestId('table')).toHaveTextContent('street');
        expect(mockNavigate).not.toHaveBeenCalled();
        expect(window.localStorage.getItem('knk.dashboard.lastEntityType')).toBe('street');
    });

    it('reopens the last viewed type on the bare dashboard and puts it in the URL', async () => {
        window.localStorage.setItem('knk.dashboard.lastEntityType', 'Category');

        render(<ObjectDashboard objectTypes={[]} />);

        expect(await screen.findByTestId('table')).toHaveTextContent('Category');
        expect(mockNavigate).toHaveBeenCalledWith('/dashboard/Category', { replace: true });
    });

    it('falls back to the default type for an unknown type or a forgotten last type', async () => {
        mockParams = { entityName: 'NoSuchType' };
        window.localStorage.setItem('knk.dashboard.lastEntityType', 'Gone');

        render(<ObjectDashboard objectTypes={[]} />);

        expect(await screen.findByTestId('table')).toHaveTextContent('District');
        expect(mockNavigate).toHaveBeenCalledWith('/dashboard/District', { replace: true });
    });

    it('puts a type picked in the explorer in the URL', async () => {
        mockParams = { entityName: 'District' };

        render(<ObjectDashboard objectTypes={[]} />);
        await screen.findByTestId('table');
        fireEvent.click(within(screen.getByRole('complementary', { name: 'Sidebar' })).getByText('Street'));

        expect(mockNavigate).toHaveBeenCalledWith('/dashboard/Street', { replace: false });
        expect(screen.getByTestId('table')).toHaveTextContent('Street');
    });

    it('opens Edit with a returnTo to this dashboard type', async () => {
        mockParams = { entityName: 'Street' };
        mockLocation = { pathname: '/dashboard/Street', search: '' };

        render(<ObjectDashboard objectTypes={[]} />);
        fireEvent.click(await screen.findByTitle('Edit'));

        expect(mockNavigate).toHaveBeenCalledWith('/forms/Street/edit/7?returnTo=%2Fdashboard%2FStreet');
    });
});

describe('ObjectDashboard as the CRUD hub (#177 link 2)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        window.localStorage.clear();
        mockMetadata = { baseMetadata: loadedMetadata, loading: false };
        mockParams = { entityName: 'Street' };
        mockLocation = { pathname: '/dashboard/Street', search: '' };
        getAll.mockResolvedValue([config('Street', true, false), config('District', true, false)]);
    });

    it('opens the default form for "New {Type}" with a returnTo to this type', async () => {
        render(<ObjectDashboard objectTypes={[]} />);
        await screen.findByTestId('table');

        fireEvent.click(screen.getAllByRole('button', { name: 'New Street' })[0]);

        expect(mockNavigate).toHaveBeenCalledWith('/forms/Street?autoOpen=true&returnTo=%2Fdashboard%2FStreet');
    });

    it('offers "New {Type}" in the empty state too', async () => {
        render(<ObjectDashboard objectTypes={[]} />);
        await screen.findByTestId('table');

        const emptyState = screen.getByTestId('empty-state');
        expect(emptyState).toHaveTextContent('No Street yet.');
        fireEvent.click(within(emptyState).getByRole('button', { name: 'New Street' }));
        expect(mockNavigate).toHaveBeenCalledWith('/forms/Street?autoOpen=true&returnTo=%2Fdashboard%2FStreet');
    });

    it('puts the title, "New {Type}" and the cogwheel on one spaced row of equal height (#195)', async () => {
        const { container } = render(<ObjectDashboard objectTypes={[]} />);
        await screen.findByTestId('table');

        // Both columns start below the app's header, not against it.
        expect(container.firstChild).toHaveClass('dashboard-parent', 'pt-6');
        const header = screen.getByTestId('dashboard-header');
        expect(header).toHaveClass('flex', 'items-center', 'justify-between', 'min-h-9');
        const title = within(header).getByRole('heading', { level: 2, name: 'Street' });
        expect(title).toHaveClass('leading-9', 'text-gray-900');
        const newButton = within(header).getByRole('button', { name: 'New Street' });
        const configure = within(header).getByRole('button', { name: 'Configure Street' });
        expect(newButton).toHaveClass('btn-primary', 'h-9');
        expect(configure).toHaveClass('btn-secondary', 'h-9', 'w-9');
        // Title first, then the buttons in one group, all children of the same row.
        expect(newButton.parentElement).toBe(configure.parentElement);
        expect(Array.from(header.children)).toEqual([title, newButton.parentElement]);
    });

    it('opens the Entity setup page of the type with the cogwheel', async () => {
        render(<ObjectDashboard objectTypes={[]} />);
        await screen.findByTestId('table');

        const configure = screen.getByRole('button', { name: 'Configure Street' });
        expect(configure).toHaveAttribute('title', expect.stringContaining('Configure Street'));
        fireEvent.click(configure);

        expect(mockNavigate).toHaveBeenCalledWith('/forms/Street');
    });

    it('opens the detail page with a returnTo from View and the row click', async () => {
        render(<ObjectDashboard objectTypes={[]} />);
        await screen.findByTestId('table');
        await waitFor(() => expect(getAll).toHaveBeenCalled());

        fireEvent.click(screen.getByRole('button', { name: 'View' }));
        expect(mockNavigate).toHaveBeenLastCalledWith('/display/Street/7?returnTo=%2Fdashboard%2FStreet');

        fireEvent.click(screen.getByRole('button', { name: 'row' }));
        expect(mockNavigate).toHaveBeenCalledTimes(2);
    });

    it('disables View and the row click for a type without a display configuration', async () => {
        mockParams = { entityName: 'Town' };
        mockLocation = { pathname: '/dashboard/Town', search: '' };

        render(<ObjectDashboard objectTypes={[]} />);
        await screen.findByTestId('table');

        const view = await screen.findByRole('button', { name: /^View – No display configuration/ });
        expect(view).toBeDisabled();
        expect(view).toHaveAttribute('title', 'No display configuration – set one up via ⚙');
        expect(screen.queryByRole('button', { name: 'row' })).not.toBeInTheDocument();
        // New and Edit still work.
        expect(screen.getAllByRole('button', { name: 'New Town' })[0]).toBeEnabled();
    });

    it('sends Edit on a User row to the player profile', async () => {
        mockMetadata = { baseMetadata: [...loadedMetadata, { entityName: 'User', displayName: 'User', fields: [] }], loading: false };
        mockParams = { entityName: 'User' };
        mockLocation = { pathname: '/dashboard/User', search: '' };

        render(<ObjectDashboard objectTypes={[]} />);
        fireEvent.click(await screen.findByTitle('Edit'));

        expect(mockNavigate).toHaveBeenCalledWith('/admin/users/7');
    });
});
