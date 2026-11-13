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
 * PandiO/knk-workspace#188: Select / Unlink / Add really link and unlink through api/Relationships; Unlink never
 * deletes the related record; Delete is a separate red action; actions the viewer can't use are disabled with
 * "Requires …". #189: readable load errors.
 */

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
    useNavigate: () => mockNavigate,
    useLocation: () => ({ pathname: '/display/Town/4', search: '' }),
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
        entityName: 'Town', displayName: 'Town', fields: [], readNodes: world, lookupGettable: true,
        actionNodes: { edit: world, delete: ['knk.admin.world', 'knk.admin.delete'] },
        relationships: [
            { property: 'streets', relatedType: 'Street', kind: 'collection', storage: 'many', canLink: true, canUnlink: true, nodes: world },
            {
                property: 'districts', relatedType: 'District', kind: 'collection', storage: 'children', canLink: false, canUnlink: false,
                linkReason: 'A District always belongs to one Town: create a new one here, or change it on the District\'s Edit page.',
                unlinkReason: 'A District always belongs to one Town: delete it, or move it on its own Edit page.', nodes: world,
            },
            { property: 'location', relatedType: 'Location', kind: 'reference', storage: 'foreignKey', canLink: false, canUnlink: false, linkReason: 'Change this on the Edit page.', unlinkReason: 'Change this on the Edit page.', nodes: world },
        ],
    },
    { entityName: 'Street', displayName: 'Street', fields: [], readNodes: ['knk.admin.world', 'knk.admin.road'], lookupSearchable: true, deletable: true, actionNodes: { delete: ['knk.admin.world', 'knk.admin.delete'] } },
    { entityName: 'District', displayName: 'District', fields: [], readNodes: world, deletable: true, actionNodes: { delete: ['knk.admin.world', 'knk.admin.delete'] } },
    { entityName: 'Location', displayName: 'Location', fields: [], readNodes: ['knk.admin.world', 'knk.admin.config'] },
];
jest.mock('../../../hooks/useEntityMetadata', () => ({ useEntityMetadata: () => ({ baseMetadata: mockMetadata }) }));
jest.mock('../../../apiClients/relationshipClient', () => ({ relationshipClient: { link: jest.fn(), unlink: jest.fn() } }));
jest.mock('../../../apiClients/lookupClient', () => ({ lookupClient: { search: jest.fn(), get: jest.fn() }, LOOKUP_MAX_PAGE_SIZE: 50 }));
jest.mock('../../../utils/entityApiMapping', () => ({ getDeleteFunctionForEntity: jest.fn(), getUpdateFunctionForEntity: jest.fn() }));
jest.mock('../../../utils/toast', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const field = (fieldGuid: string, label: string, fieldName: string) => ({ fieldGuid, label, fieldName, isReusable: false, isLinkedToSource: false });
const mockConfig = {
    name: 'Town display', sectionOrderJson: null,
    sections: [
        {
            sectionGuid: 's1', sectionName: 'Streets', isCollection: true, isReusable: false, isLinkedToSource: false,
            relatedEntityPropertyName: 'Streets', relatedEntityTypeName: 'Street',
            actionButtonsConfigJson: JSON.stringify({ showViewButton: true, showAddButton: true, showRemoveButton: true, showDeleteButton: true }),
            fields: [field('f1', 'Name', 'name')], subSections: [],
        },
        {
            sectionGuid: 's2', sectionName: 'Districts', isCollection: true, isReusable: false, isLinkedToSource: false,
            relatedEntityPropertyName: 'Districts', relatedEntityTypeName: 'District',
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

const renderPage = () => render(<DisplayWizard entityTypeName="Town" entityId={4} />);
const streets = () => screen.getByRole('list', { name: 'Streets' });
const addStreet = () => within(screen.getByRole('region', { name: 'Streets' })).getByRole('button', { name: /Add…/ });

beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    mockHeld = new Set(['knk.admin.world', 'knk.admin.content', 'knk.admin.delete']);
    mockConfigError = null;
    mockDataError = null;
    mockEntity = {
        id: 4, name: 'Cinix',
        streets: [{ id: 11, name: 'Main Street' }, { id: 12, name: 'Harbour Road' }],
        districts: [{ id: 21, name: 'Old Town' }],
        location: { id: 31, name: 'Cinix spawn' },
    };
    link.mockResolvedValue({ changed: true });
    unlink.mockResolvedValue({ changed: true });
    search.mockResolvedValue({ items: [{ id: 11, label: 'Main Street' }, { id: 13, label: 'Market Lane', detail: 'Cinix' }], total: 2 });
});

describe('relationship actions (#188)', () => {
    it('Unlink on an item removes only the link, after a plain (not red) question, and never deletes the street', async () => {
        renderPage();
        fireEvent.click(within(streets()).getByRole('button', { name: 'Unlink Main Street' }));

        const dialog = await screen.findByRole('alertdialog');
        expect(dialog).toHaveTextContent('"Main Street" stays as it is; only its link to Town "Cinix" is removed.');
        fireEvent.click(within(dialog).getByRole('button', { name: 'Unlink' }));

        await waitFor(() => expect(unlink).toHaveBeenCalledWith('Town', 4, 'streets', 11));
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
        expect(dialog).toHaveTextContent('Street "Harbour Road" itself is deleted, everywhere, not only unlinked from "Cinix".');
        fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

        await waitFor(() => expect(deleteFn).toHaveBeenCalledWith(12));
        expect(getDeleteFunctionForEntity).toHaveBeenCalledWith('Street');
        expect(unlink).not.toHaveBeenCalled();
    });

    it('Add searches the lookup, marks what is linked, and links the pick', async () => {
        renderPage();
        fireEvent.click(addStreet());

        const picker = await screen.findByTestId('relationship-picker');
        expect(within(picker).getByRole('heading', { name: 'Add a Street to "Cinix"' })).toBeInTheDocument();
        await waitFor(() => expect(search).toHaveBeenCalledWith('Street', '', 1, 10));
        expect(await within(picker).findByRole('button', { name: 'Main Street is linked' })).toBeDisabled();
        fireEvent.click(within(picker).getByRole('button', { name: 'Add Market Lane' }));

        await waitFor(() => expect(link).toHaveBeenCalledWith('Town', 4, 'streets', 13));
        await waitFor(() => expect(screen.queryByTestId('relationship-picker')).not.toBeInTheDocument());
        expect(toast.success).toHaveBeenCalledWith('"Market Lane" added.');
        expect(mockRefetch).toHaveBeenCalledWith(true);
    });

    it('asks before moving a record that belongs elsewhere, then links it with move', async () => {
        link.mockRejectedValueOnce({ status: 409, message: 'This Street already belongs to Town #2. Move it here?', response: { error: 'AlreadyLinked', message: 'This Street already belongs to Town #2. Move it here?', currentId: 2 } });
        renderPage();
        fireEvent.click(addStreet());
        const picker = await screen.findByTestId('relationship-picker');
        fireEvent.click(await within(picker).findByRole('button', { name: 'Add Market Lane' }));

        const question = await screen.findByRole('alertdialog');
        expect(question).toHaveTextContent('Move "Market Lane" here?');
        fireEvent.click(within(question).getByRole('button', { name: 'Move here' }));
        await waitFor(() => expect(link).toHaveBeenLastCalledWith('Town', 4, 'streets', 13, true));
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
        const districts = screen.getByRole('region', { name: 'Districts' });
        const unlinkButton = within(districts).getByRole('button', { name: 'Unlink Old Town' });
        expect(unlinkButton).toBeDisabled();
        expect(unlinkButton).toHaveAttribute('title', 'A District always belongs to one Town: delete it, or move it on its own Edit page.');
        expect(within(districts).getByText(/^Unlink: A District always belongs to one Town/)).toBeInTheDocument();
        expect(within(districts).getByRole('button', { name: /Add…/ })).toBeDisabled();

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
        expect(street).toHaveAttribute('href', `/display/Street/11?returnTo=${encodeURIComponent('/display/Town/4')}`);
        fireEvent.click(street, { button: 0 });
        expect(mockNavigate).toHaveBeenCalledWith(`/display/Street/11?returnTo=${encodeURIComponent('/display/Town/4')}`);
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });

    it("shows a related value as text with the reason when the viewer can't open that type", () => {
        mockHeld = new Set(['knk.admin.road']); // reads streets, not locations
        renderPage();
        expect(within(streets()).getByRole('link', { name: 'Main Street' })).toBeInTheDocument();
        const location = screen.getByRole('region', { name: 'Location' });
        expect(within(location).queryByRole('link')).not.toBeInTheDocument();
        expect(within(location).getByTitle('Opening Location requires one of: knk.admin.world, knk.admin.config')).toHaveTextContent('Cinix spawn');
    });

    it('says "You don\'t have access" with the nodes and the lookup label instead of a raw error', async () => {
        mockDataError = { status: 403, message: "You don't have access to Town.", response: { code: 'NoReadAccess', entityType: 'Town', nodes: ['knk.admin.world'] } };
        (lookupClient.get as jest.Mock).mockResolvedValue({ id: 4, label: 'Cinix' });
        renderPage();

        expect(await screen.findByRole('heading', { name: 'You don\'t have access to Town "Cinix".' })).toBeInTheDocument();
        expect(screen.getByText('Requires one of: knk.admin.world.')).toBeInTheDocument();
        expect(screen.queryByText(/^Error:/)).not.toBeInTheDocument();
        expect(lookupClient.get).toHaveBeenCalledWith('Town', 4);
    });

    it('says a missing record or display page in words, and offers a retry only for a failed load', () => {
        mockDataError = { status: 404, message: 'Town 4 not found.' };
        const { unmount } = renderPage();
        expect(screen.getByRole('heading', { name: "This Town (#4) doesn't exist." })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
        unmount();

        mockDataError = null;
        mockConfigError = { status: 404 };
        const second = renderPage();
        expect(screen.getByRole('heading', { name: 'There is no detail page set up for Town yet.' })).toBeInTheDocument();
        second.unmount();

        mockConfigError = new Error('promise timeout');
        renderPage();
        expect(screen.getByText(/Check your connection and try again/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    });
});
