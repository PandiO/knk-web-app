import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import ObjectDashboard, { getDefaultEntityName, getEntityNamesWithPublishedDefaultDisplay } from '../ObjectDashboard';
import { displayConfigClient } from '../../../apiClients/displayConfigClient';
import { formConfigClient } from '../../../apiClients/formConfigClient';
import { formSubmissionClient } from '../../../apiClients/formSubmissionClient';
import { DisplayConfigurationDto } from '../../../types/dtos/displayConfig/DisplayModels';
import { logging } from '../../../utils';
import { fakeRealtime } from '../../../test-utils/fakeRealtime';
import { LIVE_REFRESH_DEBOUNCE_MS } from '../../../realtime/liveUpdates';
import { act } from '@testing-library/react';
import { entityReferenceClient } from '../../../apiClients/entityReferenceClient';
import { dashboardClient } from '../../../apiClients/dashboardClient';
import { usePermission, usePermissions } from '../../../hooks/useStaffAccess';
import { mockHeldNodes } from '../../../test-utils/permissions';
import { toastRequests } from '../../../utils/toast';

// #280: the dashboard asks for the type's nodes (actionNodes). Every test holds everything unless it says otherwise.
jest.mock('../../../hooks/useStaffAccess', () => ({
    ...jest.requireActual('../../../hooks/useStaffAccess'),
    usePermission: jest.fn(),
    usePermissions: jest.fn(),
}));
const holdAll = () => {
    (usePermission as jest.Mock).mockImplementation(() => ({ allowed: true, isChecking: false, status: 'allowed', retry: jest.fn() }));
    (usePermissions as jest.Mock).mockImplementation((nodes: readonly string[]) => Object.fromEntries(nodes.map(node => [node, 'allowed'])));
};
jest.mock('../../../apiClients/dashboardClient', () => ({
    ...jest.requireActual('../../../apiClients/dashboardClient'),
    dashboardClient: { bulkDelete: jest.fn(), export: jest.fn() },
}));

// #406: the row menu's Export writes a file; the download itself is the browser's.
jest.mock('../../../utils/csv', () => ({
    ...jest.requireActual('../../../utils/csv'),
    downloadCsv: jest.fn(),
}));

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
// #177 follow-up: the header's "New with" and "Drafts (n)" read the type's configurations and drafts.
jest.mock('../../../apiClients/formConfigClient', () => ({
    formConfigClient: { getByEntityTypeName: jest.fn(), getEntityNames: jest.fn() },
}));
jest.mock('../../../apiClients/formSubmissionClient', () => ({
    formSubmissionClient: { getByEntityTypeName: jest.fn() },
}));

// #205: the single-row Delete (FeedbackModal) also takes the row out of the bulk selection.
const mockDeleteRow = jest.fn();
jest.mock('../../../apiClients/entityReferenceClient', () => ({ entityReferenceClient: { getRows: jest.fn() } }));
jest.mock('../../../utils/entityApiMapping', () => ({
    ...jest.requireActual('../../../utils/entityApiMapping'),
    getDeleteFunctionForEntity: () => mockDeleteRow,
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
// button for the row click (absent when the dashboard gives none) and the empty state. Its last
// props (query, onQueryChange, rowHref: #39) are kept in mockTableProps.
let mockTableProps: Record<string, any> = {};
jest.mock('../../PagedEntityTable/PagedEntityTable', () => ({
    PagedEntityTable: (props: {
        entityTypeName: string;
        rowActions?: Array<(row: unknown) => React.ReactNode>;
        onRowClick?: (row: unknown) => void;
        emptyState?: React.ReactNode;
    }) => {
        mockTableProps = props;
        const { entityTypeName, rowActions, onRowClick, emptyState } = props;
        return (
        <div>
            <div data-testid="table">{entityTypeName}</div>
            {onRowClick && <button type="button" onClick={() => onRowClick({ id: 7, name: 'Row seven' })}>row</button>}
            {rowActions?.map((action, index) => <span key={index}>{action({ id: 7, name: 'Row seven' })}</span>)}
            <div data-testid="empty-state">{emptyState}</div>
        </div>
        );
    },
}));

const getAll = displayConfigClient.getAll as jest.Mock;
const getFormConfigs = formConfigClient.getByEntityTypeName as jest.Mock;
const getDrafts = formSubmissionClient.getByEntityTypeName as jest.Mock;
const getFormEntityNames = formConfigClient.getEntityNames as jest.Mock;

// CRA resets mock implementations before each test: no other configurations and no drafts by default.
beforeEach(() => {
    holdAll();
    getFormConfigs.mockResolvedValue([]);
    getDrafts.mockResolvedValue([]);
    getFormEntityNames.mockResolvedValue([]);
});

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

    it('stars a type to the top of the explorer, keeps it in the list (#225) and remembers it in this browser', async () => {
        render(<ObjectDashboard objectTypes={[]} />);
        await screen.findByTestId('table');
        const sidebar = screen.getByRole('complementary', { name: 'Sidebar' });

        fireEvent.click(within(sidebar).getByRole('button', { name: 'Add Town to favourites' }));
        fireEvent.click(within(sidebar).getByRole('button', { name: 'Add Category to favourites' }));

        expect(typeNames(within(sidebar).getByRole('region', { name: 'Favourites' }))).toEqual(['Category', 'Town']);
        expect(typeNames(sidebar)).toEqual(['Category', 'Town', 'Category', 'District', 'Street', 'Town']);
        expect(JSON.parse(window.localStorage.getItem('knk.dashboard.favouriteEntityTypes') ?? '[]')).toEqual(['Town', 'Category']);
        expect(mockNavigate).not.toHaveBeenCalled();

        // Either copy's star unstars it; the type stays in the full list.
        fireEvent.click(within(sidebar).getAllByRole('button', { name: 'Remove Town from favourites' })[1]);
        expect(typeNames(sidebar)).toEqual(['Category', 'Category', 'District', 'Street', 'Town']);
        expect(JSON.parse(window.localStorage.getItem('knk.dashboard.favouriteEntityTypes') ?? '[]')).toEqual(['Category']);
    });

    it('lists the stored favourites first on the next visit', async () => {
        window.localStorage.setItem('knk.dashboard.favouriteEntityTypes', '["Street","town"]');

        render(<ObjectDashboard objectTypes={[]} />);
        await screen.findByTestId('table');

        expect(typeNames(screen.getByRole('complementary', { name: 'Sidebar' })))
            .toEqual(['Street', 'Town', 'Category', 'District', 'Street', 'Town']);
    });
});

describe('ObjectDashboard explorer filters (PandiO/knk-workspace#226)', () => {
    const typeNames = (container: HTMLElement) =>
        itemLabels(container).map(text => text?.replace('No display configuration – set one up via ⚙', ''));

    beforeEach(() => {
        jest.clearAllMocks();
        window.localStorage.clear();
        mockMetadata = { baseMetadata: loadedMetadata, loading: false };
        mockParams = { entityName: 'District' };
        mockLocation = { pathname: '/dashboard/District', search: '' };
        getAll.mockResolvedValue([config('Street', true, false), config('District', true, false)]);
        getFormEntityNames.mockResolvedValue(['Town', 'district']);
    });

    it('filters the explorer by display configuration (the marker\'s rule) and by form configuration', async () => {
        render(<ObjectDashboard objectTypes={[]} />);
        await screen.findByTestId('table');
        const sidebar = screen.getByRole('complementary', { name: 'Sidebar' });
        await waitFor(() => expect(getFormEntityNames).toHaveBeenCalledTimes(1));

        fireEvent.click(within(sidebar).getByTestId('explorer-filter-button'));
        const display = await within(sidebar).findByRole('combobox', { name: 'Display configuration' });
        fireEvent.change(display, { target: { value: 'no' } });
        expect(typeNames(sidebar)).toEqual(['Category', 'Town']);

        fireEvent.change(display, { target: { value: '' } });
        const form = await within(sidebar).findByRole('combobox', { name: 'Form configuration' });
        fireEvent.change(form, { target: { value: 'no' } });
        expect(typeNames(sidebar)).toEqual(['Category', 'Street']);
        expect(JSON.parse(window.localStorage.getItem('objectTypeExplorer.dashboard.filters') ?? '{}'))
            .toEqual({ formConfiguration: 'no' });
        // Filtering the list doesn't change the selected type or its table.
        expect(screen.getByTestId('table')).toHaveTextContent('District');
        expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('leaves the form configuration filter out when its list could not be loaded', async () => {
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
        getFormEntityNames.mockRejectedValue(new Error('offline'));
        render(<ObjectDashboard objectTypes={[]} />);
        await screen.findByTestId('table');
        const sidebar = screen.getByRole('complementary', { name: 'Sidebar' });
        await waitFor(() => expect(consoleError).toHaveBeenCalled());

        fireEvent.click(await within(sidebar).findByTestId('explorer-filter-button'));
        expect(await within(sidebar).findByRole('combobox', { name: 'Display configuration' })).toBeInTheDocument();
        expect(within(sidebar).queryByRole('combobox', { name: 'Form configuration' })).not.toBeInTheDocument();
        consoleError.mockRestore();
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
        expect(title).toHaveClass('leading-9', 'text-fg');
        const newButton = within(header).getByRole('button', { name: 'New Street' });
        const configure = within(header).getByRole('button', { name: 'Configure Street' });
        expect(newButton).toHaveClass('btn-primary', 'h-9');
        expect(configure).toHaveClass('btn-secondary', 'h-9', 'w-9');
        // Title first, then the buttons in one group, all children of the same row (New sits in its
        // split-button wrapper with the optional "New with" menu, #177 follow-up).
        const group = configure.parentElement!;
        expect(newButton.parentElement!.parentElement).toBe(group);
        expect(Array.from(header.children)).toEqual([title, group]);
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

describe('ObjectDashboard table state in the URL and rows as links (#39)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        window.localStorage.clear();
        mockMetadata = { baseMetadata: loadedMetadata, loading: false };
        mockParams = { entityName: 'Street' };
        mockLocation = { pathname: '/dashboard/Street', search: '?page=2&q=north&sort=name&dir=desc' };
        getAll.mockResolvedValue([config('Street', true, false), config('District', true, false)]);
    });

    it('gives the table the page, search and sort from the URL', async () => {
        render(<ObjectDashboard objectTypes={[]} />);
        await screen.findByTestId('table');
        expect(mockTableProps.query).toEqual({ page: 2, searchTerm: 'north', sortBy: 'name', sortDescending: true, filters: {} });
    });

    it('writes table changes to the URL, replacing the entry and keeping the type', async () => {
        render(<ObjectDashboard objectTypes={[]} />);
        await screen.findByTestId('table');

        mockTableProps.onQueryChange({ page: 3, pageSize: 10, searchTerm: 'north', sortBy: 'name', sortDescending: true, filters: {} });
        expect(mockNavigate).toHaveBeenLastCalledWith(
            { pathname: '/dashboard/Street', search: '?page=3&q=north&sort=name&dir=desc' },
            { replace: true }
        );

        mockTableProps.onQueryChange({ page: 1, pageSize: 10, searchTerm: '', sortBy: undefined, sortDescending: false, filters: {} });
        expect(mockNavigate).toHaveBeenLastCalledWith({ pathname: '/dashboard/Street', search: '' }, { replace: true });
    });

    it('does not navigate when the table reports the query the URL already holds', async () => {
        render(<ObjectDashboard objectTypes={[]} />);
        await screen.findByTestId('table');
        mockNavigate.mockClear();
        mockTableProps.onQueryChange({ page: 2, pageSize: 10, searchTerm: 'north', sortBy: 'name', sortDescending: true, filters: {} });
        expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('makes rows links to the detail page that come back to this page of the table', async () => {
        render(<ObjectDashboard objectTypes={[]} />);
        await screen.findByTestId('table');
        await waitFor(() => expect(mockTableProps.rowHref).toBeDefined());
        expect(mockTableProps.rowHref({ id: 7 }))
            .toBe('/display/Street/7?returnTo=%2Fdashboard%2FStreet%3Fpage%3D2%26q%3Dnorth%26sort%3Dname%26dir%3Ddesc');
        expect(mockTableProps.rowHref({})).toBeUndefined();

        // Edit keeps the table state in its returnTo too (#58: buildReturnTo includes the query).
        fireEvent.click(screen.getByTitle('Edit'));
        expect(mockNavigate).toHaveBeenLastCalledWith(
            '/forms/Street/edit/7?returnTo=%2Fdashboard%2FStreet%3Fpage%3D2%26q%3Dnorth%26sort%3Dname%26dir%3Ddesc'
        );
    });

    it('has no row links for a type without a display configuration', async () => {
        mockParams = { entityName: 'Town' };
        mockLocation = { pathname: '/dashboard/Town', search: '' };
        render(<ObjectDashboard objectTypes={[]} />);
        await screen.findByRole('button', { name: /^View – No display configuration/ });
        expect(mockTableProps.rowHref).toBeUndefined();
    });
});

describe('ObjectDashboard "Drafts (n)" and "New with" (#177 follow-up)', () => {
    const formConfig = (id: string, configurationName: string, isDefault: boolean) => ({
        id, configurationName, isDefault, entityTypeName: 'Street', steps: [],
    });
    const draft = (id: string, status: string, updatedAt: string, entityTypeName = 'Street') => ({
        id, formConfigurationId: '1', formConfigurationName: `Street form ${id}`, entityTypeName,
        currentStepIndex: 1, status, updatedAt,
    });

    beforeEach(() => {
        jest.clearAllMocks();
        window.localStorage.clear();
        mockMetadata = { baseMetadata: loadedMetadata, loading: false };
        mockParams = { entityName: 'Street' };
        mockLocation = { pathname: '/dashboard/Street', search: '?page=2' };
        getAll.mockResolvedValue([config('Street', true, false)]);
    });

    it('shows neither without other configurations or open drafts', async () => {
        getFormConfigs.mockResolvedValue([formConfig('1', 'Street form', true)]);
        getDrafts.mockResolvedValue([draft('d1', 'Completed', '2026-10-30T10:00:00Z')]);
        render(<ObjectDashboard objectTypes={[]} />);
        await screen.findByTestId('table');
        await waitFor(() => expect(getDrafts).toHaveBeenCalledWith('Street', true));
        expect(getFormConfigs).toHaveBeenCalledWith('Street', false);
        expect(screen.queryByTestId('dashboard-new-with')).not.toBeInTheDocument();
        expect(screen.queryByTestId('dashboard-drafts')).not.toBeInTheDocument();
    });

    it('offers the other form configurations under "New with", coming back to this page', async () => {
        getFormConfigs.mockResolvedValue([
            formConfig('1', 'Street form', true),
            formConfig('9', 'Quick street', false),
            formConfig('4', 'Avenue', false),
        ]);
        render(<ObjectDashboard objectTypes={[]} />);
        const toggle = await screen.findByRole('button', { name: 'New Street with another form' });
        expect(toggle).toHaveAttribute('aria-expanded', 'false');
        fireEvent.click(toggle);
        expect(toggle).toHaveAttribute('aria-expanded', 'true');

        const menu = screen.getByRole('list', { name: 'New with' });
        expect(within(menu).getAllByRole('button').map(button => button.textContent)).toEqual(['Avenue', 'Quick street']);
        // The first item has the focus; ArrowDown moves on, Escape closes and gives the focus back.
        expect(within(menu).getByRole('button', { name: 'Avenue' })).toHaveFocus();
        fireEvent.keyDown(within(menu).getByRole('button', { name: 'Avenue' }), { key: 'ArrowDown' });
        expect(within(menu).getByRole('button', { name: 'Quick street' })).toHaveFocus();
        fireEvent.keyDown(within(menu).getByRole('button', { name: 'Quick street' }), { key: 'Escape' });
        expect(screen.queryByRole('list', { name: 'New with' })).not.toBeInTheDocument();
        expect(toggle).toHaveFocus();

        fireEvent.click(toggle);
        fireEvent.click(screen.getByRole('button', { name: 'Quick street' }));
        expect(mockNavigate).toHaveBeenLastCalledWith('/forms/Street?configId=9&returnTo=%2Fdashboard%2FStreet%3Fpage%3D2');
    });

    it('shows long configuration names in full, wrapped, with the full name on hover (developer test 2026-11-03)', async () => {
        const longName = 'Street with district, town and gate links - imported from the old world map, east bank';
        getFormConfigs.mockResolvedValue([
            formConfig('1', 'Street form', true),
            { ...formConfig('7', longName, false), description: 'Only for streets crossing a district border' },
        ]);
        getDrafts.mockResolvedValue([{ ...draft('d1', 'InProgress', '2026-10-29T10:00:00Z'), formConfigurationName: longName }]);
        render(<ObjectDashboard objectTypes={[]} />);

        fireEvent.click(await screen.findByRole('button', { name: 'New Street with another form' }));
        const option = within(screen.getByRole('list', { name: 'New with' })).getAllByRole('button')[0];
        expect(option).toHaveTextContent(longName);
        const label = within(option).getByText(longName);
        expect(label).not.toHaveClass('truncate');
        expect(label).toHaveClass('whitespace-normal');
        expect(option).toHaveAttribute('title', `${longName}\nOnly for streets crossing a district border`);
        // Keyboard navigation still reaches it.
        expect(option).toHaveFocus();
        fireEvent.keyDown(option, { key: 'Escape' });

        fireEvent.click(await screen.findByRole('button', { name: /^Drafts \(1\)/ }));
        const draftItem = within(screen.getByRole('list', { name: 'Resume a draft' })).getAllByRole('button')[0];
        expect(within(draftItem).getByText(longName)).not.toHaveClass('truncate');
        expect(draftItem.getAttribute('title')).toMatch(new RegExp(`^${longName}\nStep 2 · In progress`));
    });

    it('lists the open drafts of this type, newest first, and resumes one', async () => {
        getDrafts.mockResolvedValue([
            draft('d1', 'InProgress', '2026-10-29T10:00:00Z'),
            draft('d2', 'Paused', '2026-10-31T10:00:00Z'),
            draft('d3', 'Completed', '2026-11-01T10:00:00Z'),
            draft('d4', 'Abandoned', '2026-11-01T10:00:00Z'),
            draft('d5', 'InProgress', '2026-11-01T10:00:00Z', 'District'),
        ]);
        render(<ObjectDashboard objectTypes={[]} />);
        const chip = await screen.findByRole('button', { name: /^Drafts \(2\)/ });
        expect(chip).toHaveTextContent('Drafts (2)');
        fireEvent.click(chip);

        const menu = screen.getByRole('list', { name: 'Resume a draft' });
        const items = within(menu).getAllByRole('button');
        expect(items.map(item => item.textContent)).toEqual([
            expect.stringContaining('Street form d2'),
            expect.stringContaining('Street form d1'),
        ]);
        expect(items[0]).toHaveTextContent('Step 2 · Paused');
        expect(items[1]).toHaveTextContent('Step 2 · In progress');

        fireEvent.click(items[1]);
        expect(mockNavigate).toHaveBeenLastCalledWith('/forms/Street?resume=d1&returnTo=%2Fdashboard%2FStreet%3Fpage%3D2');
    });

    it('links to all saved progress on the Entity setup page', async () => {
        getDrafts.mockResolvedValue([draft('d1', 'InProgress', '2026-10-29T10:00:00Z')]);
        render(<ObjectDashboard objectTypes={[]} />);
        fireEvent.click(await screen.findByRole('button', { name: /^Drafts \(1\)/ }));
        fireEvent.click(screen.getByRole('button', { name: 'All saved progress (Entity setup)' }));
        expect(mockNavigate).toHaveBeenLastCalledWith('/forms/Street');
    });

    it('closes the menu on a click outside', async () => {
        getDrafts.mockResolvedValue([draft('d1', 'InProgress', '2026-10-29T10:00:00Z')]);
        render(<ObjectDashboard objectTypes={[]} />);
        fireEvent.click(await screen.findByRole('button', { name: /^Drafts \(1\)/ }));
        expect(screen.getByRole('list', { name: 'Resume a draft' })).toBeInTheDocument();
        fireEvent.mouseDown(screen.getByTestId('dashboard-header'));
        expect(screen.queryByRole('list', { name: 'Resume a draft' })).not.toBeInTheDocument();
    });

    it('leaves both out when the requests fail', async () => {
        getFormConfigs.mockRejectedValue(new Error('down'));
        getDrafts.mockRejectedValue(new Error('down'));
        const errors = jest.spyOn(console, 'error').mockImplementation(() => undefined);
        try {
            render(<ObjectDashboard objectTypes={[]} />);
            await screen.findByTestId('table');
            await waitFor(() => expect(errors).toHaveBeenCalledTimes(2));
            expect(screen.queryByTestId('dashboard-new-with')).not.toBeInTheDocument();
            expect(screen.queryByTestId('dashboard-drafts')).not.toBeInTheDocument();
        } finally {
            errors.mockRestore();
        }
    });
});

// PandiO/knk-workspace#183 (Realtime S4): another admin's save of the shown type refreshes the table quietly.
describe('ObjectDashboard live updates', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        window.localStorage.clear();
        mockMetadata = { baseMetadata: loadedMetadata, loading: false };
        mockParams = { entityName: 'Town' };
        mockLocation = { pathname: '/dashboard/Town', search: '' };
        getAll.mockResolvedValue([config('Town', true, false)]);
    });
    afterEach(() => jest.useRealTimers());

    it("bumps the table's live key once per burst for the shown type, with who changed it", async () => {
        const hub = fakeRealtime({ userId: 1 });
        render(<hub.Provider><ObjectDashboard objectTypes={[]} /></hub.Provider>);
        expect(await screen.findByTestId('table')).toHaveTextContent('Town');
        const before = mockTableProps.liveRefreshKey;
        jest.useFakeTimers();

        act(() => {
            hub.emit('EntityChanged', { type: 'Street', id: 1, op: 'Updated', actorUserId: 7, actorName: 'alice' }, 7);
            hub.emit('EntityChanged', { type: 'Town', id: 4, op: 'Created', actorUserId: 7, actorName: 'alice' }, 7);
            hub.emit('EntityChanged', { type: 'Town', id: 5, op: 'Updated', actorUserId: 8, actorName: 'bob' }, 8);
        });
        expect(mockTableProps.liveRefreshKey).toBe(before);
        act(() => { jest.advanceTimersByTime(LIVE_REFRESH_DEBOUNCE_MS); });

        expect(mockTableProps.liveRefreshKey).toBe(before + 1);
        expect(mockTableProps.refreshKey).toBe(0); // not the spinner refresh
        expect(screen.getByTestId('dashboard-live-notice')).toHaveTextContent(/^Updated by alice and bob at /);
    });

    it('ignores your own saves and other types; a reconnect re-reads without a notice', async () => {
        const hub = fakeRealtime({ userId: 7 });
        render(<hub.Provider><ObjectDashboard objectTypes={[]} /></hub.Provider>);
        await screen.findByTestId('table');
        const before = mockTableProps.liveRefreshKey;
        jest.useFakeTimers();

        act(() => {
            hub.emit('EntityChanged', { type: 'Town', id: 4, op: 'Updated', actorUserId: 7, actorName: 'me' }, 7);
            hub.emit('EntityChanged', { type: 'District', id: 2, op: 'Updated', actorUserId: 8, actorName: 'bob' }, 8);
            jest.advanceTimersByTime(LIVE_REFRESH_DEBOUNCE_MS);
        });
        expect(mockTableProps.liveRefreshKey).toBe(before);

        act(() => {
            hub.reconnect();
            jest.advanceTimersByTime(LIVE_REFRESH_DEBOUNCE_MS);
        });
        expect(mockTableProps.liveRefreshKey).toBe(before + 1);
        expect(screen.getByTestId('dashboard-live-notice')).toHaveTextContent('');
    });

    it('without the hub the table is never bumped', async () => {
        render(<ObjectDashboard objectTypes={[]} />);
        await screen.findByTestId('table');
        expect(mockTableProps.liveRefreshKey).toBe(0);
    });
});

describe('ObjectDashboard checkbox selection and bulk bar (PandiO/knk-workspace#205)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        window.localStorage.clear();
        mockMetadata = { baseMetadata: loadedMetadata, loading: false };
        mockParams = { entityName: 'Street' };
        mockLocation = { pathname: '/dashboard/Street', search: '' };
        getAll.mockResolvedValue([config('Street', true, false), config('District', true, false)]);
    });

    it('selects with a checkbox column and keeps the row links and the row click', async () => {
        render(<ObjectDashboard objectTypes={[]} />);
        await screen.findByTestId('table');
        await waitFor(() => expect(mockTableProps.rowHref).toBeDefined());
        expect(mockTableProps.selectionConfig).toEqual({ mode: 'multiple' });
        expect(mockTableProps.selectionStyle).toBe('checkbox');
        expect(mockTableProps.showSelectionBanner).toBe(false);
        expect(mockTableProps.onRowClick).toBeDefined();
        expect(mockTableProps.selectedItems).toEqual([]);
    });

    it('renders the bulk bar for the type with the table state', async () => {
        render(<ObjectDashboard objectTypes={[]} />);
        await screen.findByTestId('table');
        const state = { selected: [], clearSelection: jest.fn(), columns: [], query: { page: 1, pageSize: 10 }, totalCount: 0, loading: false };
        const bar = mockTableProps.renderSelectionBar(state);
        expect(bar.props).toMatchObject({ state, entityTypeName: 'Street', typeLabel: 'Street' });
    });

    it('takes a deleted row out of the selection', async () => {
        mockDeleteRow.mockResolvedValue(undefined);
        render(<ObjectDashboard objectTypes={[]} />);
        await screen.findByTestId('table');
        act(() => mockTableProps.onSelectionChange([{ id: 7, name: 'Row seven' }, { id: 8 }]));
        fireEvent.click(screen.getByTitle('Delete'));
        const dialog = await screen.findByRole('alertdialog');
        fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
        await waitFor(() => expect(mockDeleteRow).toHaveBeenCalledWith(7));
        await waitFor(() => expect(mockTableProps.selectedItems).toEqual([{ id: 8 }]));
    });

    it('offers what uses a row when its delete is refused as in use, and nothing more for other failures (#44)', async () => {
        mockDeleteRow.mockRejectedValueOnce(Object.assign(new Error('in use'), {
            status: 409, response: { code: 'DbConstraint', message: "This street can't be deleted: it is still used by 1 structure." },
        }));
        (entityReferenceClient.getRows as jest.Mock).mockResolvedValue({
            entityTypeName: 'Street', id: 7, groups: [{
                referencedBy: 'Structure.StreetId', entityType: 'Structure', count: 1, listed: true, readable: false,
                nodes: ['knk.admin.world'], rows: [{ id: 3, label: 'Smithy' }], more: false,
            }],
        });
        render(<ObjectDashboard objectTypes={[]} />);
        await screen.findByTestId('table');
        fireEvent.click(screen.getByTitle('Delete'));
        let dialog = await screen.findByRole('alertdialog');
        await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' })); });

        dialog = await screen.findByRole('alertdialog', { name: 'Delete Failed' });
        expect(dialog).toHaveTextContent("This street can't be deleted: it is still used by 1 structure.");
        fireEvent.click(within(dialog).getByRole('button', { name: 'Show what uses it' }));
        expect(await within(dialog).findByText('Smithy')).toBeInTheDocument();
        expect(entityReferenceClient.getRows).toHaveBeenCalledWith('Street', 7);
        expect(within(dialog).getByText('Opening structures requires one of: knk.admin.world')).toBeInTheDocument();
        fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));

        mockDeleteRow.mockRejectedValueOnce(Object.assign(new Error('boom'), { status: 500 }));
        fireEvent.click(screen.getByTitle('Delete'));
        dialog = await screen.findByRole('alertdialog');
        await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' })); });
        dialog = await screen.findByRole('alertdialog', { name: 'Delete Failed' });
        expect(within(dialog).queryByRole('button', { name: 'Show what uses it' })).not.toBeInTheDocument();
    });

    it('keeps the selection for the type and clears it when the type changes', async () => {
        const { rerender } = render(<ObjectDashboard objectTypes={[]} />);
        await screen.findByTestId('table');
        act(() => mockTableProps.onSelectionChange([{ id: 7, name: 'Row seven' }, { id: 8 }]));
        expect(mockTableProps.selectedItems).toEqual([{ id: 7, name: 'Row seven' }, { id: 8 }]);

        mockParams = { entityName: 'District' };
        mockLocation = { pathname: '/dashboard/District', search: '' };
        rerender(<ObjectDashboard objectTypes={[]} />);
        await waitFor(() => expect(mockTableProps.entityTypeName).toBe('District'));
        expect(mockTableProps.selectedItems).toEqual([]);
    });
});


// PandiO/knk-workspace#280 (AM3): types and actions follow the metadata's nodes.
const accessMeta = (entityName: string, area: string, bulk = true) => ({
    entityName, displayName: entityName, fields: [],
    accessNode: area, readNodes: [area], deletable: true, bulkDeletable: bulk, exportable: true,
    actionNodes: {
        view: [area], create: [area], edit: [area], delete: [area, 'knk.admin.delete'],
        ...(bulk ? { bulkDelete: [area, 'knk.admin.delete', 'knk.admin.delete.bulk'] } : {}),
        export: [area, 'knk.admin.export'],
    },
});
const accessMetadata = [
    accessMeta('Town', 'knk.admin.world'),
    accessMeta('Street', 'knk.admin.world'),
    accessMeta('Category', 'knk.admin.content'),
    accessMeta('User', 'knk.admin.user.manage', false),
];
const hold = (nodes: string[]) => mockHeldNodes({ usePermission: usePermission as jest.Mock, usePermissions: usePermissions as jest.Mock }, nodes);

describe('ObjectDashboard access per type (PandiO/knk-workspace#280)', () => {
    let toasts: Array<{ kind: string; message: string }>;
    let subscription: { unsubscribe: () => void };
    beforeEach(() => {
        jest.clearAllMocks();
        window.localStorage.clear();
        mockMetadata = { baseMetadata: accessMetadata as never, loading: false };
        mockParams = { entityName: 'Street' };
        mockLocation = { pathname: '/dashboard/Street', search: '' };
        getAll.mockResolvedValue([config('Street', true, false), config('Town', true, false), config('Category', true, false)]);
        toasts = [];
        subscription = toastRequests.subscribe(request => toasts.push({ kind: request.kind, message: request.message }));
    });
    afterEach(() => subscription.unsubscribe());

    it('lists only the types of the areas the user holds and falls back from another area in the URL', async () => {
        hold(['knk.admin.world']);
        mockParams = { entityName: 'Category' };
        mockLocation = { pathname: '/dashboard/Category', search: '' };
        render(<ObjectDashboard objectTypes={[]} />);
        await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/dashboard/Street', { replace: true }));
        const labels = itemLabels(document.body).join(' ');
        expect(labels).toMatch(/Street/);
        expect(labels).toMatch(/Town/);
        expect(labels).not.toMatch(/Category|User/);
    });

    it('disables New, Edit, Delete and the cogwheel with "Requires <node>", and hides the bulk Delete', async () => {
        // A Staff-like account: the area node of users, nothing else.
        hold(['knk.admin.user.manage']);
        mockParams = { entityName: 'User' };
        mockLocation = { pathname: '/dashboard/User', search: '' };
        render(<ObjectDashboard objectTypes={[]} />);
        await screen.findByTestId('table');
        // #371: New opens the form wizard (knk.admin.content); Edit of a user opens the player profile and stays.
        expect(screen.getByTestId('dashboard-new')).toBeDisabled();
        expect(screen.getByTestId('dashboard-create-hint')).toHaveTextContent('New User: Requires knk.admin.content');
        expect(screen.getByLabelText('Delete – Requires knk.admin.delete')).toBeDisabled();
        expect(screen.getByLabelText('Edit')).toBeEnabled();
        expect(screen.getByLabelText('Configure User – Requires knk.admin.content')).toBeDisabled();
        const state = { selected: [{ id: 7 }], clearSelection: jest.fn(), columns: [], query: { page: 1, pageSize: 10 }, totalCount: 1, loading: false };
        const bar = mockTableProps.renderSelectionBar(state);
        expect(bar.props.actions).toBeNull();
        expect(bar.props.exportGate).toMatchObject({ allowed: false, hint: 'Requires knk.admin.export' });
    });

    it('disables New and Edit for a type whose area node is missing but which is still in view', async () => {
        // Holds the view node but not its write nodes: a read node only (e.g. a cross-area page node).
        (usePermissions as jest.Mock).mockImplementation((nodes: readonly string[]) => Object.fromEntries(nodes.map(node =>
            [node, node === 'knk.admin.world' ? 'allowed' : 'denied'])));
        mockMetadata = { baseMetadata: [{ ...accessMeta('Street', 'knk.admin.world'), actionNodes: {
            view: ['knk.admin.world'], create: ['knk.admin.road'], edit: ['knk.admin.road'], delete: ['knk.admin.road', 'knk.admin.delete'],
        } }] as never, loading: false };
        render(<ObjectDashboard objectTypes={[]} />);
        await screen.findByTestId('table');
        expect(screen.getByTestId('dashboard-new')).toBeDisabled();
        expect(screen.getByTestId('dashboard-create-hint')).toHaveTextContent('New Street: Requires knk.admin.road and knk.admin.content');
        expect(screen.getByLabelText('Edit – Requires knk.admin.road and knk.admin.content')).toBeDisabled();
        expect(screen.getByLabelText('Delete – Requires knk.admin.road and knk.admin.delete')).toBeDisabled();
    });

    it('disables New, New with and Edit for a world-only account with "Requires knk.admin.content" (#371)', async () => {
        hold(['knk.admin.world', 'knk.admin.delete', 'knk.admin.export']);
        getFormConfigs.mockResolvedValue([
            { id: '1', configurationName: 'Street form', isDefault: true, entityTypeName: 'Street', steps: [] },
            { id: '9', configurationName: 'Quick street', isDefault: false, entityTypeName: 'Street', steps: [] },
        ]);
        render(<ObjectDashboard objectTypes={[]} />);
        await screen.findByTestId('table');
        expect(screen.getByTestId('dashboard-new')).toBeDisabled();
        expect(screen.getByTestId('dashboard-create-hint')).toHaveTextContent('New Street: Requires knk.admin.content');
        await waitFor(() => expect(getFormConfigs).toHaveBeenCalledWith('Street', false));
        await act(async () => { await Promise.resolve(); });
        expect(screen.queryByRole('button', { name: 'New Street with another form' })).not.toBeInTheDocument();
        expect(screen.getByLabelText('Edit – Requires knk.admin.content')).toBeDisabled();
        // Delete and export keep their own nodes.
        expect(screen.getByLabelText('Delete')).toBeEnabled();
        const state = { selected: [{ id: 7 }], clearSelection: jest.fn(), columns: [], query: { page: 1, pageSize: 10 }, totalCount: 1, loading: false };
        expect(mockTableProps.renderSelectionBar(state).props.exportGate).toMatchObject({ allowed: true });
    });

    it('enables New and Edit for the area node plus knk.admin.content (#371)', async () => {
        hold(['knk.admin.world', 'knk.admin.content']);
        getFormConfigs.mockResolvedValue([
            { id: '1', configurationName: 'Street form', isDefault: true, entityTypeName: 'Street', steps: [] },
            { id: '9', configurationName: 'Quick street', isDefault: false, entityTypeName: 'Street', steps: [] },
        ]);
        render(<ObjectDashboard objectTypes={[]} />);
        await screen.findByTestId('table');
        expect(await screen.findByRole('button', { name: 'New Street with another form' })).toBeEnabled();
        expect(screen.getByTestId('dashboard-new')).toBeEnabled();
        expect(screen.queryByTestId('dashboard-create-hint')).not.toBeInTheDocument();
        expect(screen.getByLabelText('Edit')).toBeEnabled();
    });

    it('bulk deletes the selection after a confirm naming the count and type, keeps the refused rows selected', async () => {
        hold(['knk.admin.world', 'knk.admin.delete', 'knk.admin.delete.bulk', 'knk.admin.export']);
        (dashboardClient.bulkDelete as jest.Mock).mockResolvedValue({
            deleted: [7], refused: [{ id: 8, reason: "This street can't be deleted: it is still used by 1 structure.", code: 'InUse' }],
        });
        (entityReferenceClient.getRows as jest.Mock).mockResolvedValue({
            entityTypeName: 'Street', id: 8, groups: [{
                referencedBy: 'Structure.StreetId', entityType: 'Structure', count: 1, listed: true, readable: true,
                nodes: ['knk.admin.world'], rows: [{ id: 3, label: 'Smithy' }], more: false,
            }],
        });
        render(<ObjectDashboard objectTypes={[]} />);
        await screen.findByTestId('table');
        act(() => mockTableProps.onSelectionChange([{ id: 7, name: 'Main Street' }, { id: 8, name: 'Market Street' }]));
        const state = { selected: mockTableProps.selectedItems, clearSelection: jest.fn(), columns: [], query: { page: 1, pageSize: 10 }, totalCount: 2, loading: false };
        const { unmount } = render(<>{mockTableProps.renderSelectionBar(state)}</>);
        fireEvent.click(screen.getByTestId('bulk-delete'));
        const confirmDialog = await screen.findByRole('alertdialog', { name: 'Delete 2 Streets?' });
        await act(async () => { fireEvent.click(within(confirmDialog).getByRole('button', { name: 'Delete 2 Streets' })); });

        expect(dashboardClient.bulkDelete).toHaveBeenCalledWith('Street', [7, 8]);
        await waitFor(() => expect(mockTableProps.selectedItems).toEqual([{ id: 8, name: 'Market Street' }]));
        const result = await screen.findByRole('alertdialog', { name: 'Deleted 1 of 2 Streets' });
        expect(result).toHaveTextContent('Market Street');
        expect(result).toHaveTextContent("This street can't be deleted: it is still used by 1 structure.");
        fireEvent.click(within(result).getByRole('button', { name: 'Show what uses it' }));
        expect(await within(result).findByText('Smithy')).toBeInTheDocument();
        expect(toasts).toEqual([{ kind: 'warning', message: "Deleted 1 of 2 Streets; 1 weren't deleted." }]);
        unmount();
    });

    it('sends a large selection in chunks of 100 and ends with a toast when all were deleted', async () => {
        hold(['knk.admin.world', 'knk.admin.delete', 'knk.admin.delete.bulk']);
        (dashboardClient.bulkDelete as jest.Mock).mockImplementation(async (_type: string, ids: number[]) => ({ deleted: ids, refused: [] }));
        render(<ObjectDashboard objectTypes={[]} />);
        await screen.findByTestId('table');
        const rows = Array.from({ length: 150 }, (_, i) => ({ id: i + 1, name: `S${i + 1}` }));
        act(() => mockTableProps.onSelectionChange(rows));
        const state = { selected: rows, clearSelection: jest.fn(), columns: [], query: { page: 1, pageSize: 10 }, totalCount: 150, loading: false };
        render(<>{mockTableProps.renderSelectionBar(state)}</>);
        fireEvent.click(screen.getByTestId('bulk-delete'));
        const confirmDialog = await screen.findByRole('alertdialog', { name: 'Delete 150 Streets?' });
        await act(async () => { fireEvent.click(within(confirmDialog).getByRole('button', { name: 'Delete 150 Streets' })); });
        await waitFor(() => expect(mockTableProps.selectedItems).toEqual([]));
        expect((dashboardClient.bulkDelete as jest.Mock).mock.calls.map(call => call[1].length)).toEqual([100, 50]);
        expect(toasts).toEqual([{ kind: 'success', message: 'Deleted 150 Streets.' }]);
        expect(screen.queryByTestId('bulk-delete-result')).not.toBeInTheDocument();
    });

    it('does nothing when the bulk confirm is cancelled', async () => {
        hold(['knk.admin.world', 'knk.admin.delete', 'knk.admin.delete.bulk']);
        render(<ObjectDashboard objectTypes={[]} />);
        await screen.findByTestId('table');
        act(() => mockTableProps.onSelectionChange([{ id: 7 }]));
        const state = { selected: [{ id: 7 }], clearSelection: jest.fn(), columns: [], query: { page: 1, pageSize: 10 }, totalCount: 1, loading: false };
        render(<>{mockTableProps.renderSelectionBar(state)}</>);
        fireEvent.click(screen.getByTestId('bulk-delete'));
        const confirmDialog = await screen.findByRole('alertdialog', { name: 'Delete 1 Street?' });
        fireEvent.click(within(confirmDialog).getByRole('button', { name: 'Cancel' }));
        await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
        expect(dashboardClient.bulkDelete).not.toHaveBeenCalled();
    });
});

describe('ObjectDashboard row context menu (PandiO/knk-workspace#406)', () => {
    let toasts: Array<{ kind: string; message: string }>;
    let subscription: { unsubscribe: () => void };
    const columns = [{ key: 'name', label: 'Name' }];
    const stateWith = (selected: any[]) => ({
        selected, clearSelection: jest.fn(), columns, query: { page: 1, pageSize: 10, searchTerm: 'main' }, totalCount: 2, loading: false,
    });
    const menuOf = (row: any, selected: any[] = []) =>
        mockTableProps.rowContextMenu(row, stateWith(selected)) as Array<{ key: string; label: string; disabled?: boolean; hint?: string | null; onSelect: () => void }>;
    const byKey = (items: ReturnType<typeof menuOf>, key: string) => items.find(item => item.key === key)!;
    const row7 = { id: 7, name: 'Main Street' };
    const row8 = { id: 8, name: 'Market Street' };

    beforeEach(() => {
        jest.clearAllMocks();
        window.localStorage.clear();
        mockMetadata = { baseMetadata: accessMetadata as never, loading: false };
        mockParams = { entityName: 'Street' };
        mockLocation = { pathname: '/dashboard/Street', search: '' };
        getAll.mockResolvedValue([config('Street', true, false)]);
        toasts = [];
        subscription = toastRequests.subscribe(request => toasts.push({ kind: request.kind, message: request.message }));
    });
    afterEach(() => subscription.unsubscribe());

    it('offers View, Edit, Delete and Export, enabled with every node, with an accessible name per row', async () => {
        hold(['knk.admin.world', 'knk.admin.content', 'knk.admin.delete', 'knk.admin.delete.bulk', 'knk.admin.export']);
        render(<ObjectDashboard objectTypes={[]} />);
        await screen.findByTestId('table');
        await waitFor(() => expect(mockTableProps.rowHref).toBeDefined());
        const items = menuOf(row7);
        expect(items.map(item => [item.key, item.label, !!item.disabled])).toEqual([
            ['view', 'View', false], ['edit', 'Edit', false], ['delete', 'Delete', false], ['export', 'Export as CSV', false],
        ]);
        expect(mockTableProps.rowContextMenuLabel(row7)).toBe('Actions for Main Street');
    });

    it('gates every item with the node of its button: disabled with "Requires <node>", not hidden', async () => {
        hold(['knk.admin.world']);
        render(<ObjectDashboard objectTypes={[]} />);
        await screen.findByTestId('table');
        await waitFor(() => expect(mockTableProps.rowHref).toBeDefined());
        const items = menuOf(row7);
        expect(items).toHaveLength(4);
        expect(byKey(items, 'view')).toMatchObject({ disabled: false, hint: null });
        expect(byKey(items, 'edit')).toMatchObject({ disabled: true, hint: 'Requires knk.admin.content' });
        expect(byKey(items, 'delete')).toMatchObject({ disabled: true, hint: 'Requires knk.admin.delete' });
        expect(byKey(items, 'export')).toMatchObject({ disabled: true, hint: 'Requires knk.admin.export' });
        // The same gates as the buttons.
        expect(screen.getByLabelText('Edit – Requires knk.admin.content')).toBeDisabled();
        expect(screen.getByLabelText('Delete – Requires knk.admin.delete')).toBeDisabled();
    });

    it('disables View with the display configuration hint for a type without one', async () => {
        hold(['knk.admin.world', 'knk.admin.content']);
        getAll.mockResolvedValue([]);
        render(<ObjectDashboard objectTypes={[]} />);
        await screen.findByTestId('table');
        await waitFor(() => expect(byKey(menuOf(row7), 'view')).toMatchObject({
            disabled: true, hint: 'No display configuration – set one up via ⚙',
        }));
        expect(byKey(menuOf(row7), 'edit').disabled).toBe(false);
    });

    it('opens the clicked row with View and Edit', async () => {
        hold(['knk.admin.world', 'knk.admin.content']);
        render(<ObjectDashboard objectTypes={[]} />);
        await screen.findByTestId('table');
        await waitFor(() => expect(mockTableProps.rowHref).toBeDefined());
        act(() => byKey(menuOf(row7, [row7, row8]), 'view').onSelect());
        expect(mockNavigate).toHaveBeenLastCalledWith(expect.stringMatching(/^\/display\/Street\/7\?/));
        act(() => byKey(menuOf(row7), 'edit').onSelect());
        expect(mockNavigate).toHaveBeenLastCalledWith(expect.stringMatching(/Street.*7/));
    });

    it('deletes and exports the single row when the clicked row is not ticked', async () => {
        hold(['knk.admin.world', 'knk.admin.delete', 'knk.admin.delete.bulk', 'knk.admin.export']);
        mockDeleteRow.mockResolvedValue(undefined);
        (dashboardClient.export as jest.Mock).mockResolvedValue({ items: [row8], total: 1, truncated: false });
        render(<ObjectDashboard objectTypes={[]} />);
        await screen.findByTestId('table');
        act(() => mockTableProps.onSelectionChange([row7]));
        const items = menuOf(row8, [row7]);
        expect(byKey(items, 'delete').label).toBe('Delete');
        expect(byKey(items, 'export').label).toBe('Export as CSV');

        await act(async () => { byKey(items, 'export').onSelect(); });
        expect(dashboardClient.export).toHaveBeenCalledWith('Street', { ids: [8] });
        await waitFor(() => expect(toasts).toContainEqual({ kind: 'success', message: 'Exported 1 Street row' }));

        act(() => byKey(items, 'delete').onSelect());
        const dialog = await screen.findByRole('alertdialog', { name: 'Delete Street "Market Street"?' });
        await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' })); });
        expect(mockDeleteRow).toHaveBeenCalledWith(8);
        expect(dashboardClient.bulkDelete).not.toHaveBeenCalled();
    });

    it('acts on the whole selection when the clicked row is ticked', async () => {
        hold(['knk.admin.world', 'knk.admin.delete', 'knk.admin.delete.bulk', 'knk.admin.export']);
        (dashboardClient.export as jest.Mock).mockResolvedValue({ items: [row7, row8], total: 2, truncated: false });
        (dashboardClient.bulkDelete as jest.Mock).mockResolvedValue({ deleted: [7, 8], refused: [] });
        render(<ObjectDashboard objectTypes={[]} />);
        await screen.findByTestId('table');
        act(() => mockTableProps.onSelectionChange([row7, row8]));
        const items = menuOf(row8, [row7, row8]);
        expect(byKey(items, 'delete').label).toBe('Delete 2 Streets');
        expect(byKey(items, 'export').label).toBe('Export 2 Streets as CSV');

        await act(async () => { byKey(items, 'export').onSelect(); });
        expect(dashboardClient.export).toHaveBeenCalledWith('Street', { ids: [7, 8] });

        act(() => byKey(items, 'delete').onSelect());
        const dialog = await screen.findByRole('alertdialog', { name: 'Delete 2 Streets?' });
        await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Delete 2 Streets' })); });
        expect(dashboardClient.bulkDelete).toHaveBeenCalledWith('Street', [7, 8]);
        expect(mockDeleteRow).not.toHaveBeenCalled();
    });

    it('gates Delete on the selection with the bulk delete nodes', async () => {
        hold(['knk.admin.world', 'knk.admin.delete']);
        render(<ObjectDashboard objectTypes={[]} />);
        await screen.findByTestId('table');
        await waitFor(() => expect(mockTableProps.rowHref).toBeDefined());
        expect(byKey(menuOf(row7, [row7]), 'delete')).toMatchObject({ disabled: false, label: 'Delete' });
        expect(byKey(menuOf(row7, [row7, row8]), 'delete')).toMatchObject({
            disabled: true, label: 'Delete 2 Streets', hint: 'Requires knk.admin.delete.bulk',
        });
    });
});
