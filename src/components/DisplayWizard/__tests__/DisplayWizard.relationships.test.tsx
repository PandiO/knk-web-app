import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DisplayWizard } from '../DisplayWizard';
import { relationshipClient } from '../../../apiClients/relationshipClient';
import { lookupClient } from '../../../apiClients/lookupClient';
import { getDeleteFunctionForEntity } from '../../../utils/entityApiMapping';
import { toast } from '../../../utils/toast';
import { PICKER_SEARCH_DELAY_MS } from '../RelationshipPickerDialog';

/**
 * The page is a District's: its Streets are the link-table example (`many`), Structures the required-parent one. A
 * Town's Streets are derived from its districts (#409): read-only, with the hint.
 * PandiO/knk-workspace#188: Select / Unlink / Add really link and unlink through api/Relationships; Unlink never
 * deletes the related record; Delete is a separate red action; actions the viewer can't use are disabled with
 * "Requires …". #189: readable load errors.
 */

const mockNavigate = jest.fn();
let mockPathname = '/display/District/4';
const STREETS_HINT = 'Streets are managed on the district: open a district to add or remove them.';
jest.mock('react-router-dom', () => ({
    useNavigate: () => mockNavigate,
    useLocation: () => ({ pathname: mockPathname, search: '' }),
}), { virtual: true });

let mockHeld = new Set<string>(['knk.admin.world', 'knk.admin.content', 'knk.admin.delete']);
jest.mock('../../../hooks/useStaffAccess', () => ({
    ...jest.requireActual('../../../hooks/useStaffAccess'),
    usePermissions: (nodes: string[]) => Object.fromEntries(nodes.map(node => [node, mockHeld.has(node) ? 'allowed' : 'denied'])),
    usePermission: (node: string) => ({ allowed: mockHeld.has(node), isChecking: false, status: mockHeld.has(node) ? 'allowed' : 'denied', retry: jest.fn() }),
}));

const world = ['knk.admin.world'];
const mockMetadata = [
    {
        entityName: 'District', displayName: 'District', fields: [], readNodes: world, lookupGettable: true,
        actionNodes: { edit: world, delete: ['knk.admin.world', 'knk.admin.delete'] },
        relationships: [
            { property: 'streets', relatedType: 'Street', kind: 'collection', storage: 'many', canLink: true, canUnlink: true, nodes: world },
            {
                property: 'structures', relatedType: 'Structure', kind: 'collection', storage: 'children', canLink: false, canUnlink: false,
                linkReason: 'A Structure always belongs to one District: create a new one here, or change it on the Structure\'s Edit page.',
                unlinkReason: 'A Structure always belongs to one District: delete it, or move it on its own Edit page.', nodes: world,
            },
            { property: 'location', relatedType: 'Location', kind: 'reference', storage: 'foreignKey', canLink: false, canUnlink: false, linkReason: 'Change this on the Edit page.', unlinkReason: 'Change this on the Edit page.', nodes: world },
        ],
    },
    { entityName: 'Street', displayName: 'Street', fields: [], readNodes: ['knk.admin.world', 'knk.admin.road'], lookupSearchable: true, deletable: true, actionNodes: { delete: ['knk.admin.world', 'knk.admin.delete'] } },
    { entityName: 'Structure', displayName: 'Structure', fields: [], readNodes: world, deletable: true, actionNodes: { delete: ['knk.admin.world', 'knk.admin.delete'] } },
    // #409: a town's streets are derived from its districts: read-only, with the reason as the hint.
    {
        entityName: 'Town', displayName: 'Town', fields: [], readNodes: world, lookupGettable: true,
        actionNodes: { edit: world, delete: ['knk.admin.world', 'knk.admin.delete'] },
        relationships: [
            {
                property: 'streets', relatedType: 'Street', kind: 'collection', storage: 'derived', canLink: false, canUnlink: false,
                linkReason: STREETS_HINT, unlinkReason: STREETS_HINT, nodes: world,
            },
        ],
    },
    { entityName: 'Location', displayName: 'Location', fields: [], readNodes: ['knk.admin.world', 'knk.admin.config'] },
];
jest.mock('../../../hooks/useEntityMetadata', () => ({ useEntityMetadata: () => ({ baseMetadata: mockMetadata }) }));
jest.mock('../../../apiClients/relationshipClient', () => ({ relationshipClient: { link: jest.fn(), unlink: jest.fn() } }));
jest.mock('../../../apiClients/lookupClient', () => ({ lookupClient: { search: jest.fn(), get: jest.fn() }, LOOKUP_MAX_PAGE_SIZE: 50 }));
jest.mock('../../../utils/entityApiMapping', () => ({ getDeleteFunctionForEntity: jest.fn(), getUpdateFunctionForEntity: jest.fn() }));
jest.mock('../../../utils/toast', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const field = (fieldGuid: string, label: string, fieldName: string) => ({ fieldGuid, label, fieldName, isReusable: false, isLinkedToSource: false });
const mockConfig = {
    name: 'District display', sectionOrderJson: null,
    sections: [
        {
            sectionGuid: 's1', sectionName: 'Streets', isCollection: true, isReusable: false, isLinkedToSource: false,
            relatedEntityPropertyName: 'Streets', relatedEntityTypeName: 'Street',
            actionButtonsConfigJson: JSON.stringify({ showViewButton: true, showAddButton: true, showRemoveButton: true, showDeleteButton: true, showCreateButton: true }),
            fields: [field('f1', 'Name', 'name')], subSections: [],
        },
        {
            sectionGuid: 's2', sectionName: 'Structures', isCollection: true, isReusable: false, isLinkedToSource: false,
            relatedEntityPropertyName: 'Structures', relatedEntityTypeName: 'Structure',
            actionButtonsConfigJson: JSON.stringify({ showAddButton: true, showRemoveButton: true }),
            fields: [field('f2', 'Name', 'name')], subSections: [],
        },
        {
            sectionGuid: 's3', sectionName: 'Location', isCollection: false, isReusable: false, isLinkedToSource: false,
            relatedEntityPropertyName: 'Location', relatedEntityTypeName: 'Location',
            actionButtonsConfigJson: JSON.stringify({ showSelectButton: true, showUnlinkButton: true }),
            fields: [field('f3', 'Name', 'name')], subSections: [],
        },
    ],
};
let mockConfigError: unknown = null;
let mockDataError: unknown = null;
const mockRefetch = jest.fn().mockResolvedValue(undefined);
let mockEntity: Record<string, unknown>;
jest.mock('../hooks/useDisplayConfig', () => ({
    useDisplayConfig: () => ({ config: mockConfigError ? null : mockConfig, loading: false, error: mockConfigError }),
}));
jest.mock('../hooks/useEntityData', () => ({
    useEntityData: () => ({ data: mockDataError ? null : mockEntity, loading: false, error: mockDataError, refetch: mockRefetch }),
}));

const link = relationshipClient.link as jest.Mock;
const unlink = relationshipClient.unlink as jest.Mock;
const search = lookupClient.search as jest.Mock;

const renderPage = () => render(<DisplayWizard entityTypeName="District" entityId={4} />);
const streets = () => screen.getByRole('list', { name: 'Streets' });
const addStreet = () => within(screen.getByRole('region', { name: 'Streets' })).getByRole('button', { name: /Add…/ });

beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    mockHeld = new Set(['knk.admin.world', 'knk.admin.content', 'knk.admin.delete']);
    mockPathname = '/display/District/4';
    mockConfigError = null;
    mockDataError = null;
    mockEntity = {
        id: 4, name: 'Old Quarter',
        streets: [{ id: 11, name: 'Main Street' }, { id: 12, name: 'Harbour Road' }],
        structures: [{ id: 21, name: 'Town Hall' }],
        location: { id: 31, name: 'Old Quarter spawn' },
    };
    link.mockResolvedValue({ changed: true });
    unlink.mockResolvedValue({ changed: true });
    search.mockResolvedValue({ items: [{ id: 11, label: 'Main Street' }, { id: 13, label: 'Market Lane', detail: 'Old Quarter' }], total: 2 });
});

describe('relationship actions (#188)', () => {
    it('Unlink on an item removes only the link, after a plain (not red) question, and never deletes the street', async () => {
        renderPage();
        fireEvent.click(within(streets()).getByRole('button', { name: 'Unlink Main Street' }));

        const dialog = await screen.findByRole('alertdialog');
        expect(dialog).toHaveTextContent('"Main Street" stays as it is; only its link to District "Old Quarter" is removed.');
        fireEvent.click(within(dialog).getByRole('button', { name: 'Unlink' }));

        await waitFor(() => expect(unlink).toHaveBeenCalledWith('District', 4, 'streets', 11));
        expect(getDeleteFunctionForEntity).not.toHaveBeenCalled();
        expect(toast.success).toHaveBeenCalledWith('"Main Street" unlinked.');
        expect(mockRefetch).toHaveBeenCalledWith(true);
    });

    it('Delete is a separate red action that deletes the record itself', async () => {
        const deleteFn = jest.fn().mockResolvedValue(undefined);
        (getDeleteFunctionForEntity as jest.Mock).mockReturnValue(deleteFn);
        renderPage();

        const button = within(streets()).getByRole('button', { name: 'Delete Harbour Road' });
        expect(button).toHaveClass('btn-danger');
        fireEvent.click(button);
        const dialog = await screen.findByRole('alertdialog');
        expect(dialog).toHaveTextContent('Street "Harbour Road" itself is deleted, everywhere, not only unlinked from "Old Quarter".');
        fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

        await waitFor(() => expect(deleteFn).toHaveBeenCalledWith(12));
        expect(getDeleteFunctionForEntity).toHaveBeenCalledWith('Street');
        expect(unlink).not.toHaveBeenCalled();
    });

    it('Add searches the lookup, marks what is linked, and links the pick', async () => {
        renderPage();
        fireEvent.click(addStreet());

        const picker = await screen.findByTestId('relationship-picker');
        expect(within(picker).getByRole('heading', { name: 'Add a Street to "Old Quarter"' })).toBeInTheDocument();
        await waitFor(() => expect(search).toHaveBeenCalledWith('Street', '', 1, 10));
        expect(await within(picker).findByRole('button', { name: 'Main Street is linked' })).toBeDisabled();
        fireEvent.click(within(picker).getByRole('button', { name: 'Add Market Lane' }));

        await waitFor(() => expect(link).toHaveBeenCalledWith('District', 4, 'streets', 13));
        await waitFor(() => expect(screen.queryByTestId('relationship-picker')).not.toBeInTheDocument());
        expect(toast.success).toHaveBeenCalledWith('"Market Lane" added.');
        expect(mockRefetch).toHaveBeenCalledWith(true);
    });

    it('asks before moving a record that belongs elsewhere, then links it with move', async () => {
        link.mockRejectedValueOnce({ status: 409, message: 'This Street already belongs to District #2. Move it here?', response: { error: 'AlreadyLinked', message: 'This Street already belongs to District #2. Move it here?', currentId: 2 } });
        renderPage();
        fireEvent.click(addStreet());
        const picker = await screen.findByTestId('relationship-picker');
        fireEvent.click(await within(picker).findByRole('button', { name: 'Add Market Lane' }));

        const question = await screen.findByRole('alertdialog');
        expect(question).toHaveTextContent('Move "Market Lane" here?');
        fireEvent.click(within(question).getByRole('button', { name: 'Move here' }));
        await waitFor(() => expect(link).toHaveBeenLastCalledWith('District', 4, 'streets', 13, true));
    });

    it('searches as you type, after a short pause', async () => {
        jest.useFakeTimers();
        renderPage();
        fireEvent.click(addStreet());
        act(() => { jest.advanceTimersByTime(PICKER_SEARCH_DELAY_MS); });
        fireEvent.change(screen.getByLabelText('Search Street'), { target: { value: 'mar' } });
        expect(search).not.toHaveBeenCalledWith('Street', 'mar', 1, 10);
        await act(async () => { jest.advanceTimersByTime(PICKER_SEARCH_DELAY_MS); });
        expect(search).toHaveBeenCalledWith('Street', 'mar', 1, 10);
        jest.useRealTimers();
    });

    it('shows a link the API refuses (a required parent) disabled, with the reason', () => {
        renderPage();
        const structures = screen.getByRole('region', { name: 'Structures' });
        const unlinkButton = within(structures).getByRole('button', { name: 'Unlink Town Hall' });
        expect(unlinkButton).toBeDisabled();
        expect(unlinkButton).toHaveAttribute('title', 'A Structure always belongs to one District: delete it, or move it on its own Edit page.');
        expect(within(structures).getByText(/^Unlink: A Structure always belongs to one District/)).toBeInTheDocument();
        expect(within(structures).getByRole('button', { name: /Add…/ })).toBeDisabled();

        const location = screen.getByRole('region', { name: 'Location' });
        expect(within(location).getByRole('button', { name: /Change…/ })).toBeDisabled();
        expect(within(location).getByTestId('action-hint')).toHaveTextContent('Change… and Unlink: Change this on the Edit page.');
    });

    it('a staff account without knk.admin.delete sees Delete disabled with "Requires knk.admin.delete", Unlink still works', () => {
        mockHeld = new Set(['knk.admin.world', 'knk.admin.content']);
        renderPage();
        const button = within(streets()).getByRole('button', { name: 'Delete Main Street' });
        expect(button).toBeDisabled();
        expect(button).toHaveAttribute('title', 'Requires knk.admin.delete');
        expect(screen.getByText('Delete: Requires knk.admin.delete')).toBeInTheDocument();
        expect(within(streets()).getByRole('button', { name: 'Unlink Main Street' })).toBeEnabled();
    });

    it('without the write node, Add and Unlink are disabled with "Requires knk.admin.world and knk.admin.content"', () => {
        mockHeld = new Set(['knk.admin.road']);
        renderPage();
        expect(within(screen.getByRole('region', { name: 'Streets' })).getByRole('button', { name: /Add…/ })).toBeDisabled();
        expect(within(screen.getByRole('region', { name: 'Streets' })).getByTestId('action-hint'))
            .toHaveTextContent('Add…: Requires knk.admin.world and knk.admin.content');
        expect(within(streets()).getByRole('button', { name: 'Unlink Main Street' }))
            .toHaveAttribute('title', 'Requires knk.admin.world and knk.admin.content');
    });

    it('#374: the area node without knk.admin.content disables Add and Unlink, Delete still works', () => {
        mockHeld = new Set(['knk.admin.world', 'knk.admin.delete']);
        renderPage();
        expect(within(screen.getByRole('region', { name: 'Streets' })).getByRole('button', { name: /Add…/ })).toBeDisabled();
        expect(within(screen.getByRole('region', { name: 'Streets' })).getByTestId('action-hint'))
            .toHaveTextContent('Add…: Requires knk.admin.content');
        expect(within(streets()).getByRole('button', { name: 'Unlink Main Street' })).toHaveAttribute('title', 'Requires knk.admin.content');
        expect(within(streets()).getByRole('button', { name: 'Delete Main Street' })).toBeEnabled();
    });

    it('#374: an API that already lists knk.admin.content asks for it once', () => {
        const streetsRelationship = mockMetadata[0].relationships!.find(r => r.property === 'streets')!;
        const before = streetsRelationship.nodes;
        streetsRelationship.nodes = ['knk.admin.world', 'knk.admin.content'];
        try {
            mockHeld = new Set(['knk.admin.world']);
            renderPage();
            expect(within(streets()).getByRole('button', { name: 'Unlink Main Street' })).toHaveAttribute('title', 'Requires knk.admin.content');
        } finally {
            streetsRelationship.nodes = before;
        }
    });
});

describe('readability (#189)', () => {
    it('counts each collection and links values to the related record', () => {
        renderPage();
        expect(screen.getByLabelText('2 items')).toHaveTextContent('2');
        expect(screen.getByLabelText('1 item')).toBeInTheDocument();
        const street = within(streets()).getByRole('link', { name: 'Main Street' });
        expect(street).toHaveAttribute('href', `/display/Street/11?returnTo=${encodeURIComponent('/display/District/4')}`);
        fireEvent.click(street, { button: 0 });
        expect(mockNavigate).toHaveBeenCalledWith(`/display/Street/11?returnTo=${encodeURIComponent('/display/District/4')}`);
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });

    it("shows a related value as text with the reason when the viewer can't open that type", () => {
        mockHeld = new Set(['knk.admin.road']); // reads streets, not locations
        renderPage();
        expect(within(streets()).getByRole('link', { name: 'Main Street' })).toBeInTheDocument();
        const location = screen.getByRole('region', { name: 'Location' });
        expect(within(location).queryByRole('link')).not.toBeInTheDocument();
        expect(within(location).getByTitle('Opening Location requires one of: knk.admin.world, knk.admin.config')).toHaveTextContent('Old Quarter spawn');
    });

    it('says "You don\'t have access" with the nodes and the lookup label instead of a raw error', async () => {
        mockDataError = { status: 403, message: "You don't have access to District.", response: { code: 'NoReadAccess', entityType: 'District', nodes: ['knk.admin.world'] } };
        (lookupClient.get as jest.Mock).mockResolvedValue({ id: 4, label: 'Old Quarter' });
        renderPage();

        expect(await screen.findByRole('heading', { name: 'You don\'t have access to District "Old Quarter".' })).toBeInTheDocument();
        expect(screen.getByText('Requires one of: knk.admin.world.')).toBeInTheDocument();
        expect(screen.queryByText(/^Error:/)).not.toBeInTheDocument();
        expect(lookupClient.get).toHaveBeenCalledWith('District', 4);
    });

    it('says a missing record or display page in words, and offers a retry only for a failed load', () => {
        mockDataError = { status: 404, message: 'District 4 not found.' };
        const { unmount } = renderPage();
        expect(screen.getByRole('heading', { name: "This District (#4) doesn't exist." })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
        unmount();

        mockDataError = null;
        mockConfigError = { status: 404 };
        const second = renderPage();
        expect(screen.getByRole('heading', { name: 'There is no detail page set up for District yet.' })).toBeInTheDocument();
        second.unmount();

        mockConfigError = new Error('promise timeout');
        renderPage();
        expect(screen.getByText(/Check your connection and try again/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    });
});

describe('derived relationships (#409)', () => {
    const renderTown = () => {
        mockPathname = '/display/Town/4';
        mockEntity = { id: 4, name: 'Cinix', streets: [{ id: 11, name: 'Main Street' }, { id: 12, name: 'Harbour Road' }] };
        return render(<DisplayWizard entityTypeName="Town" entityId={4} />);
    };

    it("a town's streets show with View, the hint, and no Add…, Unlink, Delete or Create New", () => {
        renderTown();
        const region = screen.getByRole('region', { name: 'Streets' });

        expect(within(streets()).getByRole('link', { name: 'Main Street' })).toBeInTheDocument();
        expect(within(streets()).getByRole('button', { name: 'View Main Street' })).toBeEnabled();
        expect(within(region).getByTestId('derived-hint')).toHaveTextContent(STREETS_HINT);
        expect(within(region).queryByRole('button', { name: /Add…/ })).not.toBeInTheDocument();
        expect(within(region).queryByRole('button', { name: /Unlink/ })).not.toBeInTheDocument();
        expect(within(region).queryByRole('button', { name: /Delete/ })).not.toBeInTheDocument();
        expect(within(region).queryByRole('button', { name: 'Create New' })).not.toBeInTheDocument();
        // The reason is the visible hint, not a greyed-out button's hint.
        expect(within(region).queryByTestId('action-hint')).not.toBeInTheDocument();
        expect(within(region).queryByText(/^Unlink:/)).not.toBeInTheDocument();
    });

    it('a district keeps its Add… and Unlink for the same streets, without the hint', () => {
        renderPage();
        const region = screen.getByRole('region', { name: 'Streets' });
        expect(within(region).getByRole('button', { name: /Add…/ })).toBeEnabled();
        expect(within(streets()).getByRole('button', { name: 'Unlink Main Street' })).toBeEnabled();
        expect(within(region).queryByTestId('derived-hint')).not.toBeInTheDocument();
    });
});
