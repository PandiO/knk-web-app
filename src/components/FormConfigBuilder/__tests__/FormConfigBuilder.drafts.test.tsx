import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { FormConfigBuilder } from '../FormConfigBuilder';
import { formConfigClient } from '../../../apiClients/formConfigClient';
import { metadataClient } from '../../../apiClients/metadataClient';
import { toast } from '../../../utils/toast';
import { FormConfigurationBuilderState, FormConfigurationDto } from '../../../types/dtos/forms/FormModels';
import { FieldType } from '../../../utils/enums';

/** PandiO/knk-workspace#71: save in place (a draft), Save and close, Publish with what changes, leave guard, access. */

const mockNavigate = jest.fn();
let mockParams: { id?: string } = { id: '7' };
jest.mock('react-router-dom', () => ({
    useNavigate: () => mockNavigate,
    useParams: () => mockParams,
}), { virtual: true });
jest.mock('../../../apiClients/formConfigClient', () => ({
    formConfigClient: {
        getReusableSteps: jest.fn(), getReusableFields: jest.fn(), getBuilderState: jest.fn(), saveDraft: jest.fn(),
        createDraft: jest.fn(), publish: jest.fn(), discardDraft: jest.fn(), duplicate: jest.fn(), getByEntityTypeName: jest.fn(),
    },
}));
jest.mock('../../../apiClients/metadataClient', () => ({ metadataClient: { getAllEntityMetadata: jest.fn() } }));
let mockHeld = new Set<string>(['knk.admin.content']);
jest.mock('../../../hooks/useStaffAccess', () => ({
    CONTENT_PERMISSION_NODE: 'knk.admin.content',
    usePermissions: (nodes: string[]) => Object.fromEntries(nodes.map(node => [node, mockHeld.has(node) ? 'allowed' : 'denied'])),
    usePermission: () => ({ allowed: true, isChecking: false, status: 'allowed', retry: jest.fn() }),
}));
jest.mock('../../../utils/toast', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock('../ConfigurationHealthPanel', () => ({ ConfigurationHealthPanel: () => null }));
jest.mock('../StepEditor', () => ({ StepEditor: ({ step }: { step: { stepName: string } }) => <div>Editing {step.stepName}</div> }));

const client = formConfigClient as jest.Mocked<typeof formConfigClient>;

const town = {
    entityName: 'Town', displayName: 'Town',
    fields: [
        { fieldName: 'Id', fieldType: 'Integer', isNullable: false, isRelatedEntity: false, hasDefaultValue: false },
        { fieldName: 'Name', fieldType: 'String', isNullable: false, isRelatedEntity: false, hasDefaultValue: false },
        { fieldName: 'Description', fieldType: 'String', isNullable: true, isRelatedEntity: false, hasDefaultValue: false },
    ],
};

const published: FormConfigurationDto = {
    id: '7', entityTypeName: 'Town', configurationName: 'Town form', description: 'For towns', isDefault: true,
    steps: [{
        id: '1', stepGuid: 'g1', stepName: 'General', order: 0, isReusable: false, isLinkedToSource: false, hasCompatibilityIssues: false,
        isManyToManyRelationship: false, childFormSteps: [], conditions: [],
        fields: [{ id: '10', fieldGuid: 'f10', fieldName: 'Name', label: 'Name', fieldType: FieldType.String, isRequired: true, isReadOnly: false,
            order: 0, isReusable: false, isLinkedToSource: false, hasCompatibilityIssues: false, validations: [] }],
    }],
};

const state = (overrides: Partial<FormConfigurationBuilderState> = {}): FormConfigurationBuilderState => ({
    configuration: published, published, isPublished: true, hasUnpublishedChanges: false, openDraftCount: 0, ...overrides,
});

const renderBuilder = async () => {
    render(<FormConfigBuilder />);
    await screen.findByTestId('builder-toolbar');
};

beforeEach(() => {
    jest.clearAllMocks();
    mockParams = { id: '7' };
    mockHeld = new Set(['knk.admin.content']);
    window.history.pushState({}, '', '/admin/form-configurations/edit/7');
    client.getReusableSteps.mockResolvedValue([]);
    client.getReusableFields.mockResolvedValue([]);
    client.getBuilderState.mockResolvedValue(state());
    client.getByEntityTypeName.mockRejectedValue(new Error('none'));
    (metadataClient.getAllEntityMetadata as jest.Mock).mockResolvedValue([town]);
});

it('opens the working copy as published, with nothing to save or publish', async () => {
    await renderBuilder();
    expect(screen.getByTestId('builder-status')).toHaveTextContent('Published');
    expect(screen.getByText('No unsaved changes.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Publish/ })).toBeDisabled();
    expect(screen.getByTestId('action-hint')).toHaveTextContent('Publish: Nothing to publish');
    expect(client.getBuilderState).toHaveBeenCalledWith('7');
});

it('Save stores a draft and stays in the builder', async () => {
    client.saveDraft.mockResolvedValue(state({ hasUnpublishedChanges: true, draftSavedAt: '2026-11-09T10:00:00Z' }));
    await renderBuilder();

    const name = screen.getByLabelText(/Configuration Name/);
    await userEvent.clear(name);
    await userEvent.type(name, 'Town form v2');
    expect(screen.getByText('Unsaved changes.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(client.saveDraft).toHaveBeenCalledTimes(1));
    const [id, body] = client.saveDraft.mock.calls[0];
    expect(id).toBe('7');
    expect(body.configurationName).toBe('Town form v2');
    expect(JSON.parse(body.stepOrderJson!)).toEqual(['g1']);
    expect(toast.success).toHaveBeenCalledWith('Draft saved. Staff keep the published version until you publish.');
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(await screen.findByText('No unsaved changes.')).toBeInTheDocument();
    expect(screen.getByTestId('builder-status')).toHaveTextContent('Published · changes not published');
});

it('Save and close saves, then goes back to Entity setup', async () => {
    client.saveDraft.mockResolvedValue(state({ hasUnpublishedChanges: true }));
    await renderBuilder();
    await userEvent.type(screen.getByLabelText('Description'), ' and more');

    await userEvent.click(screen.getByRole('button', { name: 'Save and close' }));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/forms/Town'));
    expect(client.saveDraft).toHaveBeenCalled();
});

it('Publish asks with what changes for staff, then publishes the saved copy', async () => {
    const working = { ...published, steps: [{ ...published.steps[0], stepName: 'Basics' }] };
    client.getBuilderState.mockResolvedValueOnce(state({ configuration: working, hasUnpublishedChanges: true, openDraftCount: 2 }));
    client.publish.mockResolvedValue({ ...working, hasUnpublishedChanges: false });
    client.getBuilderState.mockResolvedValueOnce(state({ configuration: working, published: working }));
    await renderBuilder();

    await userEvent.click(screen.getByRole('button', { name: /Publish/ }));

    const dialog = await screen.findByRole('alertdialog', { name: 'Publish the changes to "Town form"?' });
    expect(within(dialog).getByTestId('publish-summary')).toHaveTextContent('1 step changed: "Basics".');
    expect(within(dialog).getByText(/2 saved drafts continue on the new version/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Publish' }));

    await waitFor(() => expect(client.publish).toHaveBeenCalledWith('7'));
    expect(client.saveDraft).not.toHaveBeenCalled(); // nothing unsaved: the saved copy is published
    expect(toast.success).toHaveBeenCalledWith('"Town form" is published: staff get it from now on.');
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(client.getBuilderState).toHaveBeenCalledTimes(2);
});

it('a refused Publish keeps the dialog open with the reason', async () => {
    client.getBuilderState.mockResolvedValue(state({ hasUnpublishedChanges: true }));
    client.publish.mockRejectedValue({ status: 400, response: "Can't publish: Field 'Ghost' is not a property of Town." });
    await renderBuilder();

    await userEvent.click(screen.getByRole('button', { name: /Publish/ }));
    const dialog = await screen.findByRole('alertdialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Publish' }));

    expect(await within(dialog).findByRole('alert')).toBeInTheDocument();
    expect(toast.success).not.toHaveBeenCalled();
});

it('a new form is created as a draft on the first Save and the route moves to it', async () => {
    mockParams = {};
    window.history.pushState({}, '', '/admin/form-configurations/new?entity=Town');
    client.createDraft.mockResolvedValue(state({
        configuration: { ...published, id: '9', configurationName: 'Town Template 1' }, published: null, isPublished: false, hasUnpublishedChanges: true,
    }));
    render(<FormConfigBuilder />);
    await screen.findByTestId('builder-toolbar');
    expect(screen.getByTestId('builder-status')).toHaveTextContent('New');
    await waitFor(() => expect(screen.getByLabelText(/Configuration Name/)).toHaveValue('Town Template 1'));

    await userEvent.click(screen.getByRole('button', { name: 'Add new step' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(client.createDraft).toHaveBeenCalledTimes(1));
    expect(client.createDraft.mock.calls[0][0]).toMatchObject({ entityTypeName: 'Town', configurationName: 'Town Template 1' });
    expect(mockNavigate).toHaveBeenCalledWith('/admin/form-configurations/edit/9', { replace: true });
    expect(toast.success).toHaveBeenCalledWith('Draft saved. Publish it when it is ready.');
});

it('Close with unsaved changes asks "Leave without saving?"', async () => {
    await renderBuilder();
    await userEvent.type(screen.getByLabelText('Description'), '!');

    await userEvent.click(screen.getByRole('button', { name: 'Close the form builder' }));
    const question = await screen.findByRole('alertdialog', { name: 'Leave without saving?' });
    await userEvent.click(within(question).getByRole('button', { name: 'Stay' }));
    expect(mockNavigate).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Close the form builder' }));
    await userEvent.click(within(await screen.findByRole('alertdialog', { name: 'Leave without saving?' })).getByRole('button', { name: 'Leave' }));
    expect(mockNavigate).toHaveBeenCalledWith('/forms/Town');
});

it('without knk.admin.content Save and Publish are disabled with "Requires knk.admin.content"', async () => {
    mockHeld = new Set();
    client.getBuilderState.mockResolvedValue(state({ hasUnpublishedChanges: true }));
    await renderBuilder();
    await userEvent.type(screen.getByLabelText('Description'), '!');

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Publish/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save and close' })).toBeDisabled();
    expect(screen.getByTestId('action-hint')).toHaveTextContent('Save, Publish and Duplicate: Requires knk.admin.content');
});

it('Generate from metadata adds a step with the chosen properties', async () => {
    await renderBuilder();
    await userEvent.click(screen.getByRole('button', { name: 'More' }));
    await userEvent.click(screen.getByRole('menuitem', { name: /Generate from metadata/ }));

    const dialog = await screen.findByRole('dialog', { name: 'Generate from Town' });
    // Name is already in the form; only Description is offered.
    expect(within(dialog).queryByRole('checkbox', { name: 'Add Name' })).not.toBeInTheDocument();
    expect(within(dialog).getByRole('checkbox', { name: 'Add Description' })).toBeChecked();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add 1 field' }));

    expect(await screen.findByText('Editing General')).toBeInTheDocument();
    expect(screen.getByText('Unsaved changes.')).toBeInTheDocument();
    expect(toast.success).toHaveBeenCalledWith('Added 1 step with 1 field. Save to keep them.');
});

it('Duplicate copies the published version and opens the copy', async () => {
    client.duplicate.mockResolvedValue(state({ configuration: { ...published, id: '12', configurationName: 'Town form (copy)' }, isPublished: false, published: null }));
    await renderBuilder();
    await userEvent.click(screen.getByRole('button', { name: 'More' }));
    await userEvent.click(screen.getByRole('menuitem', { name: /Duplicate/ }));

    const dialog = await screen.findByRole('dialog', { name: 'Duplicate "Town form"' });
    expect(within(dialog).getByLabelText(/Name of the new form/)).toHaveValue('Town form (copy)');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Duplicate' }));

    await waitFor(() => expect(client.duplicate).toHaveBeenCalledWith('7', 'Town form (copy)'));
    expect(mockNavigate).toHaveBeenCalledWith('/admin/form-configurations/edit/12');
});

it('the preview shows the working copy as the wizard draws it', async () => {
    await renderBuilder();
    await userEvent.click(screen.getByRole('button', { name: 'Preview' }));

    const preview = screen.getByTestId('form-preview');
    expect(within(preview).getByRole('heading', { name: 'General' })).toBeInTheDocument();
    expect(within(preview).getByDisplayValue('Sample Name')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Preview' })).toHaveAttribute('aria-pressed', 'true');
});
