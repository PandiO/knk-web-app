import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { DisplayConfigBuilder } from '../DisplayConfigBuilder';
import { displayConfigClient } from '../../../apiClients/displayConfigClient';
import { metadataClient } from '../../../apiClients/metadataClient';
import { toast } from '../../../utils/toast';
import { DisplayConfigurationBuilderState, DisplayConfigurationDto } from '../../../types/dtos/displayConfig/DisplayModels';

/** PandiO/knk-workspace#71: the display builder saves drafts in place and publishes with what changes. */

const mockNavigate = jest.fn();
let mockParams: { id?: string } = { id: '3' };
jest.mock('react-router-dom', () => ({
    useNavigate: () => mockNavigate,
    useParams: () => mockParams,
}), { virtual: true });
jest.mock('../../../apiClients/displayConfigClient', () => ({
    displayConfigClient: {
        getAllReusableSections: jest.fn(), getAllReusableFields: jest.fn(), getBuilderState: jest.fn(), saveDraft: jest.fn(),
        createDraft: jest.fn(), publish: jest.fn(), discardDraft: jest.fn(), duplicate: jest.fn(), getDefaultByEntityType: jest.fn(),
    },
}));
jest.mock('../../../apiClients/metadataClient', () => ({ metadataClient: { getAllEntityMetadata: jest.fn(), getEntityMetadata: jest.fn() } }));
jest.mock('../../../hooks/useStaffAccess', () => ({
    CONTENT_PERMISSION_NODE: 'knk.admin.content',
    usePermissions: (nodes: string[]) => Object.fromEntries(nodes.map(node => [node, 'allowed'])),
    usePermission: () => ({ allowed: true, isChecking: false, status: 'allowed', retry: jest.fn() }),
}));
jest.mock('../../../utils/toast', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock('../SectionEditor', () => ({ SectionEditor: ({ section }: { section: { sectionName: string } }) => <div>Editing {section.sectionName}</div> }));

const client = displayConfigClient as jest.Mocked<typeof displayConfigClient>;

const published: DisplayConfigurationDto = {
    id: '3', name: 'Town page', entityTypeName: 'Town', isDefault: true, isDraft: false, sectionOrderJson: '["s1"]',
    sections: [{
        id: '1', sectionGuid: 's1', sectionName: 'General', isReusable: false, isLinkedToSource: false, isCollection: false, subSections: [],
        fields: [{ id: '5', fieldGuid: 'f5', fieldName: 'Name', label: 'Name', isReusable: false, isLinkedToSource: false }],
    }],
};
const state = (overrides: Partial<DisplayConfigurationBuilderState> = {}): DisplayConfigurationBuilderState => ({
    configuration: published, published, isPublished: true, hasUnpublishedChanges: false, ...overrides,
});

beforeEach(() => {
    jest.clearAllMocks();
    mockParams = { id: '3' };
    window.history.pushState({}, '', '/admin/display-configurations/edit/3');
    client.getAllReusableSections.mockResolvedValue([]);
    client.getAllReusableFields.mockResolvedValue([]);
    client.getBuilderState.mockResolvedValue(state());
    (metadataClient.getAllEntityMetadata as jest.Mock).mockResolvedValue([{ entityName: 'Town', displayName: 'Town', fields: [] }]);
});

it('Save keeps the builder open; detail pages keep the published version', async () => {
    client.saveDraft.mockResolvedValue(state({ hasUnpublishedChanges: true }));
    render(<DisplayConfigBuilder />);
    await screen.findByTestId('builder-toolbar');

    await userEvent.type(screen.getByLabelText('Description'), 'Shown to staff');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(client.saveDraft).toHaveBeenCalledWith('3', expect.objectContaining({ description: 'Shown to staff', sectionOrderJson: '["s1"]' })));
    expect(toast.success).toHaveBeenCalledWith('Draft saved. Detail pages keep the published version until you publish.');
    expect(mockNavigate).not.toHaveBeenCalled();
});

it('Publish names the default it replaces and publishes', async () => {
    const working = { ...published, isDefault: true };
    client.getBuilderState.mockResolvedValueOnce(state({
        configuration: working, published: { ...published, isDefault: false }, hasUnpublishedChanges: true, currentDefaultName: 'Old page',
    }));
    client.getBuilderState.mockResolvedValueOnce(state());
    client.publish.mockResolvedValue(published);
    render(<DisplayConfigBuilder />);
    await screen.findByTestId('builder-toolbar');

    await userEvent.click(screen.getByRole('button', { name: /Publish/ }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('It becomes the default display for Town, replacing "Old page".');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Publish' }));

    await waitFor(() => expect(client.publish).toHaveBeenCalledWith(3));
    expect(toast.success).toHaveBeenCalledWith('"Town page" is published: detail pages show it from now on.');
});

it('Discard goes back to the published version after a danger question', async () => {
    client.getBuilderState.mockResolvedValue(state({ hasUnpublishedChanges: true }));
    client.discardDraft.mockResolvedValue(state());
    render(<DisplayConfigBuilder />);
    await screen.findByTestId('builder-toolbar');

    await userEvent.click(screen.getByRole('button', { name: 'More' }));
    await userEvent.click(screen.getByRole('menuitem', { name: /Discard unpublished changes/ }));
    await userEvent.click(within(await screen.findByRole('alertdialog', { name: 'Discard the unpublished changes?' })).getByRole('button', { name: 'Discard' }));

    await waitFor(() => expect(client.discardDraft).toHaveBeenCalledWith('3'));
    expect(toast.success).toHaveBeenCalledWith('Back to the published version.');
});

it('the preview shows the page with sample values and no working buttons', async () => {
    render(<DisplayConfigBuilder />);
    await screen.findByTestId('builder-toolbar');
    await userEvent.click(screen.getByRole('button', { name: 'Preview' }));

    const preview = screen.getByTestId('display-preview');
    expect(within(preview).getByRole('heading', { name: 'Town page' })).toBeInTheDocument();
    expect(within(preview).getByText('Sample Name')).toBeInTheDocument();
});

it('a never-published display can\'t be duplicated or discarded yet, and says why', async () => {
    client.getBuilderState.mockResolvedValue(state({ isPublished: false, published: null, hasUnpublishedChanges: true }));
    render(<DisplayConfigBuilder />);
    await screen.findByTestId('builder-toolbar');
    expect(screen.getByTestId('builder-status')).toHaveTextContent('Draft');

    await userEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(screen.getByRole('menuitem', { name: /Duplicate/ })).toBeDisabled();
    expect(screen.getByRole('menuitem', { name: /Duplicate/ })).toHaveTextContent('Publish it first');
    expect(screen.getByRole('menuitem', { name: /Discard/ })).toBeDisabled();
});
