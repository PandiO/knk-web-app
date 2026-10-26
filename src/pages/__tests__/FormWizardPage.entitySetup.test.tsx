import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FormWizardPage } from '../FormWizardPage';
import { formConfigClient } from '../../apiClients/formConfigClient';
import { getFetchByIdFunctionForEntity } from '../../utils/entityApiMapping';

/**
 * #177 link 2: an open form hides the explorer and shows a breadcrumb back to where it was
 * opened; the page is "Entity setup"; "New" on a type without a default form says so.
 */

const mockNavigate = jest.fn();
let mockParams: { entityName?: string; entityId?: string } = { entityName: 'category', entityId: '4' };
let mockSearch = 'returnTo=%2Fdashboard%2FCategory';
// virtual: CRA's Jest resolver can't resolve react-router-dom's package exports
jest.mock('react-router-dom', () => ({
    useNavigate: () => mockNavigate,
    useParams: () => mockParams,
    useSearchParams: () => [new URLSearchParams(mockSearch)]
}), { virtual: true });
jest.mock('../../apiClients/formConfigClient', () => ({
    formConfigClient: { getByEntityTypeName: jest.fn() }
}));
jest.mock('../../apiClients/formSubmissionClient', () => ({
    formSubmissionClient: { getByEntityTypeName: jest.fn().mockResolvedValue([]) }
}));
jest.mock('../../apiClients/displayConfigClient', () => ({
    displayConfigClient: { getAll: jest.fn().mockResolvedValue([]), getByEntityTypeName: jest.fn().mockResolvedValue([]) }
}));
jest.mock('../../apiClients/workflowClient', () => ({
    workflowClient: { createSession: jest.fn().mockResolvedValue({ id: 1 }), completeStep: jest.fn() }
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
jest.mock('../../components/FormWizard/FormCancelAction', () => ({
    FormCancelAction: ({ onLeave }: { onLeave: () => void }) => (
        <button type="button" onClick={onLeave}>Cancel form</button>
    )
}));
jest.mock('../../components/FormWizard/FormWizard', () => ({
    FormWizard: () => <div>wizard</div>
}));

const breadcrumb = () => screen.getByRole('navigation', { name: 'Breadcrumb' });
const crumbs = () => within(breadcrumb()).getAllByRole('listitem').map(item => item.textContent);

describe('FormWizardPage as Entity setup (#177 link 2)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockParams = { entityName: 'category', entityId: '4' };
        mockSearch = 'returnTo=%2Fdashboard%2FCategory';
        (formConfigClient.getByEntityTypeName as jest.Mock).mockResolvedValue([{ id: '7', entityTypeName: 'Category', isDefault: true, steps: [] }]);
        (getFetchByIdFunctionForEntity as jest.Mock).mockReturnValue(jest.fn().mockResolvedValue({ id: 4, name: 'Riverside' }));
        jest.spyOn(console, 'log').mockImplementation(() => undefined);
    });

    afterEach(() => {
        (console.log as jest.Mock).mockRestore();
        document.title = '';
    });

    it('hides the explorer while a form is open and shows the way back as a breadcrumb', async () => {
        render(<FormWizardPage entityTypeName="" objectTypes={[]} />);
        await screen.findByText('wizard');

        expect(screen.queryByTestId('explorer')).not.toBeInTheDocument();
        await waitFor(() => expect(crumbs()).toEqual(['Dashboard', 'Category', 'Edit Riverside']));
        expect(within(breadcrumb()).getByText('Edit Riverside')).toHaveAttribute('aria-current', 'page');
        expect(document.title).toBe('Entity setup · Knights & Kings');

        fireEvent.click(within(breadcrumb()).getByRole('link', { name: 'Category' }));
        expect(mockNavigate).toHaveBeenCalledWith('/dashboard/Category');
        expect(screen.queryByText('wizard')).not.toBeInTheDocument();
    });

    it('shows "Edit #id" until the entity name loaded, and "New {Type}" for a new one', async () => {
        (getFetchByIdFunctionForEntity as jest.Mock).mockReturnValue(jest.fn().mockRejectedValue(new Error('offline')));
        const { unmount } = render(<FormWizardPage entityTypeName="" objectTypes={[]} />);
        await screen.findByText('wizard');
        expect(crumbs()).toEqual(['Dashboard', 'Category', 'Edit #4']);
        unmount();

        mockParams = { entityName: 'category' };
        mockSearch = 'autoOpen=true&returnTo=%2Fdashboard%2FCategory';
        render(<FormWizardPage entityTypeName="" objectTypes={[]} />);
        await screen.findByText('wizard');
        expect(crumbs()).toEqual(['Dashboard', 'Category', 'New Category']);
    });

    it('keeps the explorer on the configuration lists', async () => {
        mockParams = { entityName: 'category' };
        mockSearch = '';
        render(<FormWizardPage entityTypeName="" objectTypes={[]} />);

        await waitFor(() => expect(formConfigClient.getByEntityTypeName).toHaveBeenCalled());
        expect(screen.getByTestId('explorer')).toBeInTheDocument();
        expect(screen.queryByRole('navigation', { name: 'Breadcrumb' })).not.toBeInTheDocument();
    });

    it('says "New" needs a default form configuration when the type has none (decision 3)', async () => {
        mockParams = { entityName: 'category' };
        mockSearch = 'autoOpen=true&returnTo=%2Fdashboard%2FCategory';
        (formConfigClient.getByEntityTypeName as jest.Mock).mockResolvedValue([{ id: '7', entityTypeName: 'Category', isDefault: false, steps: [] }]);

        render(<FormWizardPage entityTypeName="" objectTypes={[]} />);

        expect(await screen.findByText(/To create a new Category, this type needs a default form configuration: set one below as default\./)).toBeInTheDocument();
        expect(screen.queryByText('wizard')).not.toBeInTheDocument();
    });
});
