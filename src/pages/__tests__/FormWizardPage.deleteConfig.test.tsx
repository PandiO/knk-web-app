import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FormWizardPage } from '../FormWizardPage';
import { formConfigClient } from '../../apiClients/formConfigClient';
import { formSubmissionClient } from '../../apiClients/formSubmissionClient';
import { displayConfigClient } from '../../apiClients/displayConfigClient';

/**
 * KNG-172: the delete confirm of a form configuration says how many saved drafts go with it,
 * counted from the configuration's entity references; when they can't be counted it asks without
 * that sentence.
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

const renderPage = () => render(<FormWizardPage entityTypeName="" objectTypes={[]} />);

const references = (draftCount: number) => ({
    entityTypeName: 'FormConfiguration',
    id: '20',
    inUse: true,
    references: [
        { referencedBy: 'FormStep.FormConfigurationId', count: 3 },
        ...(draftCount > 0 ? [{ referencedBy: 'FormSubmissionProgress.FormConfigurationId', count: draftCount }] : [])
    ]
});

describe('FormWizardPage: delete a form configuration (KNG-172)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (displayConfigClient.getAll as jest.Mock).mockResolvedValue([]);
        (formConfigClient.getByEntityTypeName as jest.Mock).mockResolvedValue([
            { id: '20', entityTypeName: 'GateStructure', configurationName: 'GateStructure - Default', isDefault: false, steps: [] }
        ]);
        (formConfigClient.delete as jest.Mock).mockResolvedValue(undefined);
        (formSubmissionClient.getByEntityTypeName as jest.Mock).mockResolvedValue([]);
    });

    const askToDelete = async () => {
        fireEvent.click(await screen.findByRole('button', { name: 'More actions for GateStructure - Default' }));
        fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
        return screen.findByRole('dialog', { name: 'Delete this form configuration?' });
    };

    it('says the saved drafts are deleted too', async () => {
        (formSubmissionClient.getEntityReferences as jest.Mock).mockResolvedValue(references(2));
        renderPage();

        const dialog = await askToDelete();
        expect(formSubmissionClient.getEntityReferences).toHaveBeenCalledWith('FormConfiguration', '20');
        expect(within(dialog).getByText('Are you sure you want to delete "GateStructure - Default"? Its 2 saved drafts are deleted too.'))
            .toBeInTheDocument();

        fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
        await waitFor(() => expect(formConfigClient.delete).toHaveBeenCalledWith('20'));
    });

    it('asks without the sentence when there are no drafts or they cannot be counted', async () => {
        (formSubmissionClient.getEntityReferences as jest.Mock).mockRejectedValue(new Error('HTTP 500: Internal Server Error'));
        renderPage();

        const dialog = await askToDelete();
        expect(within(dialog).getByText('Are you sure you want to delete "GateStructure - Default"?')).toBeInTheDocument();

        fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
        await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Delete this form configuration?' })).not.toBeInTheDocument());
        expect(formConfigClient.delete).not.toHaveBeenCalled();
    });
});
