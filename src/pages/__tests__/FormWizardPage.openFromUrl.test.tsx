import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FormWizardPage } from '../FormWizardPage';
import { formConfigClient } from '../../apiClients/formConfigClient';
import { formSubmissionClient } from '../../apiClients/formSubmissionClient';
import { logging } from '../../utils';

/**
 * #177 follow-up: the dashboard's "New with: {config}" (?configId=) and "Drafts (n)" (?resume=)
 * open that configuration or draft on the Entity setup page.
 */

const mockNavigate = jest.fn();
let mockSearch = '';
// virtual: CRA's Jest resolver can't resolve react-router-dom's package exports
jest.mock('react-router-dom', () => ({
    useNavigate: () => mockNavigate,
    useParams: () => ({ entityName: 'category' }),
    useSearchParams: () => [new URLSearchParams(mockSearch)]
}), { virtual: true });
jest.mock('../../apiClients/formConfigClient', () => ({
    formConfigClient: { getByEntityTypeName: jest.fn() }
}));
jest.mock('../../apiClients/formSubmissionClient', () => ({
    formSubmissionClient: { getByEntityTypeName: jest.fn(), getById: jest.fn() }
}));
jest.mock('../../apiClients/displayConfigClient', () => ({
    displayConfigClient: { getAll: jest.fn(), getByEntityTypeName: jest.fn() }
}));
jest.mock('../../apiClients/workflowClient', () => ({
    workflowClient: { createSession: jest.fn(), completeStep: jest.fn() }
}));
// One object for every render (a fresh array each time re-runs the page's column effect forever).
const mockEntityMetadata = {
    allMergedMetadata: [],
    baseMetadata: [{ entityName: 'Category', displayName: 'Category', fields: [] }],
    configurations: [],
    loading: false,
    createConfiguration: () => undefined,
    updateConfiguration: () => undefined,
    refresh: () => undefined
};
jest.mock('../../hooks/useEntityMetadata', () => ({
    useEntityMetadata: () => mockEntityMetadata
}));
jest.mock('../../utils/entityApiMapping', () => ({
    getCreateFunctionForEntity: jest.fn(() => jest.fn()),
    getUpdateFunctionForEntity: jest.fn(),
    getFetchByIdFunctionForEntity: jest.fn()
}));
jest.mock('../../components/ObjectTypeExplorer', () => () => <div data-testid="explorer" />);
jest.mock('../../components/FormWizard/FormWizard', () => ({
    FormWizard: ({ formConfigurationId, existingProgressId }: { formConfigurationId?: string; existingProgressId?: string }) => (
        <div data-testid="wizard">config {formConfigurationId} progress {existingProgressId ?? 'none'}</div>
    )
}));

const configs = [
    { id: '7', entityTypeName: 'Category', configurationName: 'Default', isDefault: true, steps: [] },
    { id: '9', entityTypeName: 'Category', configurationName: 'Quick', isDefault: false, steps: [] },
];

describe('FormWizardPage opens a configuration or draft from the URL (#177 follow-up)', () => {
    let errors: jest.Mock;
    let subscription: { unsubscribe: () => void };

    beforeEach(() => {
        jest.clearAllMocks();
        mockSearch = '';
        (formConfigClient.getByEntityTypeName as jest.Mock).mockResolvedValue(configs);
        (formSubmissionClient.getByEntityTypeName as jest.Mock).mockResolvedValue([]);
        (formSubmissionClient.getById as jest.Mock).mockResolvedValue({ id: 'd1', formConfigurationId: '9', currentStepIndex: 1, status: 'Paused' });
        const { displayConfigClient } = jest.requireMock('../../apiClients/displayConfigClient');
        displayConfigClient.getAll.mockResolvedValue([]);
        const { workflowClient } = jest.requireMock('../../apiClients/workflowClient');
        workflowClient.createSession.mockResolvedValue({ id: 1 });
        jest.spyOn(console, 'log').mockImplementation(() => undefined);
        errors = jest.fn();
        subscription = logging.errorHandler.subscribe(errors);
    });

    afterEach(() => {
        (console.log as jest.Mock).mockRestore();
        subscription.unsubscribe();
        document.title = '';
    });

    it('opens the configuration named by configId (not the default)', async () => {
        mockSearch = 'configId=9&returnTo=%2Fdashboard%2FCategory';
        render(<FormWizardPage entityTypeName="" objectTypes={[]} />);
        expect(await screen.findByTestId('wizard')).toHaveTextContent('config 9 progress none');
        expect(screen.queryByTestId('explorer')).not.toBeInTheDocument();
    });

    it('resumes the draft named by resume with its own configuration', async () => {
        mockSearch = 'resume=d1&returnTo=%2Fdashboard%2FCategory';
        render(<FormWizardPage entityTypeName="" objectTypes={[]} />);
        expect(await screen.findByTestId('wizard')).toHaveTextContent('config 9 progress d1');
        // Not a call count: with #180 the page also reads the draft for its workflow session.
        expect(formSubmissionClient.getById).toHaveBeenCalledWith('d1');
        expect((formSubmissionClient.getById as jest.Mock).mock.calls.every(([id]) => id === 'd1')).toBe(true);
    });

    it('#71: lists the configurations with drafts, but never opens a draft from the URL', async () => {
        (formConfigClient.getByEntityTypeName as jest.Mock).mockResolvedValue([
            ...configs, { id: '11', entityTypeName: 'Category', configurationName: 'Unfinished', isDefault: false, isDraft: true, steps: [] },
        ]);
        mockSearch = 'configId=11';
        render(<FormWizardPage entityTypeName="" objectTypes={[]} />);
        await waitFor(() => expect(errors).toHaveBeenCalledWith('That form configuration was not found. Pick one from the list below.'));
        expect(formConfigClient.getByEntityTypeName).toHaveBeenCalledWith('category', false, true);
        expect(screen.queryByTestId('wizard')).not.toBeInTheDocument();
        expect(screen.getByText('Unfinished')).toBeInTheDocument();
        expect(screen.getByText('Draft')).toBeInTheDocument();
    });

    it('stays on the configuration lists with an error for an unknown configuration', async () => {
        mockSearch = 'configId=404';
        render(<FormWizardPage entityTypeName="" objectTypes={[]} />);
        await waitFor(() => expect(errors).toHaveBeenCalledWith('That form configuration was not found. Pick one from the list below.'));
        expect(screen.queryByTestId('wizard')).not.toBeInTheDocument();
        expect(screen.getByTestId('explorer')).toBeInTheDocument();
    });

    it('opens nothing without either parameter', async () => {
        render(<FormWizardPage entityTypeName="" objectTypes={[]} />);
        await waitFor(() => expect(formConfigClient.getByEntityTypeName).toHaveBeenCalled());
        await waitFor(() => expect(formSubmissionClient.getByEntityTypeName).toHaveBeenCalled());
        expect(screen.queryByTestId('wizard')).not.toBeInTheDocument();
        expect(formSubmissionClient.getById).not.toHaveBeenCalled();
    });
});
