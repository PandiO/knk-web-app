import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FormWizardPage } from '../FormWizardPage';
import { formConfigClient } from '../../apiClients/formConfigClient';
import { formSubmissionClient } from '../../apiClients/formSubmissionClient';
import { displayConfigClient } from '../../apiClients/displayConfigClient';
import { createdEntityDeleteDeps } from '../../utils/forms/createdEntityDeleteDeps';

/**
 * KNG-162: deleting a draft from Saved Progress offers the same keep/delete prompt when the draft
 * recorded entities its child forms created; a draft without a record gets a plain confirm modal.
 */

// virtual: CRA's Jest resolver can't resolve react-router-dom's package exports
jest.mock('react-router-dom', () => ({
    useNavigate: () => jest.fn(),
    useParams: () => ({ entityName: 'gatestructure' }),
    useSearchParams: () => [new URLSearchParams()]
}), { virtual: true });
jest.mock('../../apiClients/formConfigClient', () => ({
    formConfigClient: { getByEntityTypeName: jest.fn(), getById: jest.fn(), update: jest.fn(), delete: jest.fn() }
}));
jest.mock('../../apiClients/formSubmissionClient', () => ({
    formSubmissionClient: { getByEntityTypeName: jest.fn(), getById: jest.fn(), delete: jest.fn(), getEntityReferences: jest.fn() }
}));
jest.mock('../../apiClients/displayConfigClient', () => ({
    displayConfigClient: { getAll: jest.fn().mockResolvedValue([]) }
}));
jest.mock('../../apiClients/workflowClient', () => ({
    workflowClient: { createSession: jest.fn(), completeStep: jest.fn() }
}));
jest.mock('../../hooks/useEntityMetadata', () => ({
    useEntityMetadata: () => ({
        allMergedMetadata: [],
        baseMetadata: [],
        configurations: [],
        loading: false,
        createConfiguration: jest.fn(),
        updateConfiguration: jest.fn(),
        refresh: jest.fn()
    })
}));
jest.mock('../../components/ObjectTypeExplorer', () => () => null);
jest.mock('../../components/FormWizard/FormWizard', () => ({ FormWizard: () => <div>wizard</div> }));
jest.mock('../../utils/forms/createdEntityDeleteDeps', () => ({
    createdEntityDeleteDeps: { checkReferences: jest.fn(), getDeleteFunction: jest.fn() }
}));

const draft = (id: string, createdEntitiesJson?: string) => ({
    id,
    formConfigurationId: '20',
    formConfigurationName: 'GateStructure - Default',
    entityTypeName: 'GateStructure',
    currentStepIndex: 0,
    status: 'Paused',
    createdAt: '2026-10-12T08:00:00Z',
    updatedAt: '2026-10-12T08:00:00Z',
    createdEntitiesJson
});

const RECORDED = JSON.stringify([
    { entityTypeName: 'District', id: 501, display: { name: 'Oostwijk' }, origin: { formPath: ['gatestructure', 'Street'], fieldName: 'Districts' }, sequence: 1 },
    { entityTypeName: 'Street', id: 77, display: { name: 'Gatestraat' }, origin: { formPath: ['gatestructure'], fieldName: 'StreetId' }, sequence: 2 }
]);

const renderPage = () => render(<FormWizardPage entityTypeName="" objectTypes={[]} />);

describe('FormWizardPage: delete a draft that recorded created entities (KNG-162)', () => {
    let deleted: string[];

    beforeEach(() => {
        jest.clearAllMocks();
        deleted = [];
        (displayConfigClient.getAll as jest.Mock).mockResolvedValue([]);
        (formConfigClient.getByEntityTypeName as jest.Mock).mockResolvedValue([
            { id: '20', entityTypeName: 'GateStructure', configurationName: 'GateStructure - Default', isDefault: true, steps: [] }
        ]);
        (formSubmissionClient.getByEntityTypeName as jest.Mock).mockResolvedValue([draft('9', RECORDED), draft('10')]);
        (formSubmissionClient.delete as jest.Mock).mockResolvedValue(undefined);
        (createdEntityDeleteDeps.checkReferences as jest.Mock).mockImplementation(async (type: string, id: number) => ({
            entityTypeName: type, id: String(id), inUse: false, references: []
        }));
        (createdEntityDeleteDeps.getDeleteFunction as jest.Mock).mockImplementation((type: string) => async (id: number) => {
            deleted.push(`${type}:${id}`);
        });
    });

    const deleteButtons = async () => screen.findAllByRole('button', { name: 'Delete saved progress' });

    it('offers Keep (draft only) or Delete (entities newest first, then the draft)', async () => {
        renderPage();
        fireEvent.click((await deleteButtons())[0]);

        const dialog = await screen.findByRole('dialog', { name: 'Delete this saved progress?' });
        expect(within(dialog).getByText("District 'Oostwijk'")).toBeInTheDocument();
        expect(within(dialog).getByText("Street 'Gatestraat'")).toBeInTheDocument();

        fireEvent.click(within(dialog).getByRole('button', { name: 'Delete draft and them' }));
        expect(await within(dialog).findByText('Deleted 2 of 2.')).toBeInTheDocument();
        expect(deleted).toEqual(['Street:77', 'District:501']);
        expect(formSubmissionClient.delete).toHaveBeenCalledWith('9');

        fireEvent.click(within(dialog).getByRole('button', { name: 'Done' }));
        await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Delete this saved progress?' })).not.toBeInTheDocument());
        expect(await deleteButtons()).toHaveLength(1);
    });

    it('Keep deletes only the draft', async () => {
        renderPage();
        fireEvent.click((await deleteButtons())[0]);
        const dialog = await screen.findByRole('dialog', { name: 'Delete this saved progress?' });

        fireEvent.click(within(dialog).getByRole('button', { name: 'Delete draft, keep them' }));

        await waitFor(() => expect(formSubmissionClient.delete).toHaveBeenCalledWith('9'));
        expect(deleted).toEqual([]);
        expect(createdEntityDeleteDeps.checkReferences).not.toHaveBeenCalled();
    });

    it('closing the prompt deletes nothing', async () => {
        renderPage();
        fireEvent.click((await deleteButtons())[0]);
        const dialog = await screen.findByRole('dialog', { name: 'Delete this saved progress?' });

        fireEvent.click(within(dialog).getByRole('button', { name: 'Close dialog' }));

        expect(formSubmissionClient.delete).not.toHaveBeenCalled();
        expect(screen.queryByRole('dialog', { name: 'Delete this saved progress?' })).not.toBeInTheDocument();
    });

    it('a draft without a record asks a plain confirm in a modal, not the browser', async () => {
        const confirm = jest.spyOn(window, 'confirm');
        renderPage();
        fireEvent.click((await deleteButtons())[1]);

        const dialog = await screen.findByRole('dialog', { name: 'Delete this saved progress?' });
        expect(within(dialog).queryByText("District 'Oostwijk'")).not.toBeInTheDocument();
        fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

        await waitFor(() => expect(formSubmissionClient.delete).toHaveBeenCalledWith('10'));
        expect(confirm).not.toHaveBeenCalled();
        confirm.mockRestore();
    });

    it('closing the plain confirm deletes nothing', async () => {
        renderPage();
        fireEvent.click((await deleteButtons())[1]);

        const dialog = await screen.findByRole('dialog', { name: 'Delete this saved progress?' });
        fireEvent.click(within(dialog).getByRole('button', { name: 'Close dialog' }));

        await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Delete this saved progress?' })).not.toBeInTheDocument());
        expect(formSubmissionClient.delete).not.toHaveBeenCalled();
    });
});
