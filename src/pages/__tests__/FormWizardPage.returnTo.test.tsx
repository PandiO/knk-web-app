import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FormWizardPage } from '../FormWizardPage';
import { formConfigClient } from '../../apiClients/formConfigClient';
import { getUpdateFunctionForEntity } from '../../utils/entityApiMapping';
import { toast } from '../../utils/toast';

/**
 * #177 link 1 (#58): a form opened from the dashboard with ?returnTo= goes back there on Submit
 * (with a success toast, no modal) and on Cancel; a refused save keeps the form open.
 */

const mockNavigate = jest.fn();
let mockSearch = 'returnTo=%2Fdashboard%2FCategory';
// virtual: CRA's Jest resolver can't resolve react-router-dom's package exports
jest.mock('react-router-dom', () => ({
    useNavigate: () => mockNavigate,
    useParams: () => ({ entityName: 'category', entityId: '4' }),
    useSearchParams: () => [new URLSearchParams(mockSearch)]
}), { virtual: true });
jest.mock('../../apiClients/formConfigClient', () => ({
    formConfigClient: { getByEntityTypeName: jest.fn() }
}));
jest.mock('../../apiClients/formSubmissionClient', () => ({
    formSubmissionClient: { getByEntityTypeName: jest.fn().mockResolvedValue([]) }
}));
jest.mock('../../apiClients/displayConfigClient', () => ({
    displayConfigClient: { getAll: jest.fn().mockResolvedValue([]) }
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
jest.mock('../../utils/toast', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock('../../components/ObjectTypeExplorer', () => () => null);
jest.mock('../../components/FormWizard/FormCancelAction', () => ({
    FormCancelAction: ({ onLeave, disabled, dirty }: { onLeave: () => void; disabled?: boolean; dirty?: boolean }) => (
        <button type="button" onClick={onLeave} disabled={disabled} data-dirty={String(dirty)}>Cancel form</button>
    )
}));

// The wizard as the page sees it: its callbacks, driven by the test.
let wizardProps: Record<string, any> = {};
jest.mock('../../components/FormWizard/FormWizard', () => ({
    FormWizard: (props: Record<string, any>) => {
        wizardProps = props;
        return <div>wizard{props.footerStart}</div>;
    }
}));

const progress = { id: '55', formConfigurationId: '7', userId: '1', entityTypeName: 'category', entityId: '4', currentStepIndex: 0 };

const openForm = async () => {
    render(<FormWizardPage entityTypeName="" objectTypes={[]} />);
    await screen.findByText('wizard');
};

describe('FormWizardPage returnTo (#177 link 1)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockSearch = 'returnTo=%2Fdashboard%2FCategory';
        wizardProps = {};
        (formConfigClient.getByEntityTypeName as jest.Mock).mockResolvedValue([{ id: '7', entityTypeName: 'Category', isDefault: true, steps: [] }]);
        jest.spyOn(console, 'log').mockImplementation(() => undefined);
    });

    afterEach(() => {
        (console.log as jest.Mock).mockRestore();
    });

    it('saves the entity, and once the draft is Completed goes back to returnTo with a toast', async () => {
        const update = jest.fn().mockResolvedValue(undefined);
        (getUpdateFunctionForEntity as jest.Mock).mockReturnValue(update);
        await openForm();

        let saved: boolean | undefined;
        await act(async () => { saved = await wizardProps.onComplete({ name: 'Riverside' }, progress); });

        expect(saved).toBe(true);
        expect(update).toHaveBeenCalledWith({ name: 'Riverside', id: '4' });
        expect(mockNavigate).not.toHaveBeenCalled();

        act(() => wizardProps.onCompleted());

        expect(toast.success).toHaveBeenCalledWith('Category updated.');
        expect(mockNavigate).toHaveBeenCalledWith('/dashboard/Category');
        expect(screen.queryByText('Form completed')).not.toBeInTheDocument();
    });

    it('falls back to the dashboard on this type without a returnTo, and ignores an unsafe one', async () => {
        (getUpdateFunctionForEntity as jest.Mock).mockReturnValue(jest.fn().mockResolvedValue(undefined));
        mockSearch = 'returnTo=https%3A%2F%2Fevil.example';
        await openForm();

        await act(async () => { await wizardProps.onComplete({}, progress); });
        act(() => wizardProps.onCompleted());

        expect(mockNavigate).toHaveBeenCalledWith('/dashboard/Category');
    });

    it('keeps the form open and reports false when the API refuses the save', async () => {
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
        (getUpdateFunctionForEntity as jest.Mock).mockReturnValue(jest.fn().mockRejectedValue(new Error('Name is taken')));
        await openForm();

        let saved: boolean | undefined;
        await act(async () => { saved = await wizardProps.onComplete({}, progress); });

        expect(saved).toBe(false);
        expect(await screen.findByText('Submit failed')).toBeInTheDocument();
        expect(screen.getByText('wizard')).toBeInTheDocument();
        expect(mockNavigate).not.toHaveBeenCalled();
        consoleError.mockRestore();
    });

    it('goes back to returnTo on Cancel, and disables Cancel while submitting', async () => {
        await openForm();

        act(() => wizardProps.onSubmittingChange(true));
        expect(screen.getByRole('button', { name: 'Cancel form' })).toBeDisabled();
        act(() => wizardProps.onSubmittingChange(false));

        // Nothing changed: Cancel leaves without asking (#109).
        fireEvent.click(screen.getByRole('button', { name: 'Cancel form' }));
        await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/dashboard/Category'));
    });

    it('gives Cancel the dirty flag, and a breadcrumb asks before it leaves a changed form (#109)', async () => {
        await openForm();
        const cancel = () => screen.getByRole('button', { name: 'Cancel form' });
        expect(cancel()).toHaveAttribute('data-dirty', 'false');

        act(() => wizardProps.onDirtyChange(true));
        expect(cancel()).toHaveAttribute('data-dirty', 'true');

        const breadcrumb = screen.getByRole('navigation', { name: 'Breadcrumb' });
        fireEvent.click(within(breadcrumb).getAllByRole('link')[0]);
        const dialog = await screen.findByRole('dialog', { name: 'Leave this form?' });
        expect(mockNavigate).not.toHaveBeenCalled();
        fireEvent.click(within(dialog).getByRole('button', { name: 'Stay' }));
        expect(screen.getByText('wizard')).toBeInTheDocument();

        fireEvent.click(within(screen.getByRole('navigation', { name: 'Breadcrumb' })).getAllByRole('link')[0]);
        fireEvent.click(within(await screen.findByRole('dialog', { name: 'Leave this form?' })).getByRole('button', { name: 'Leave form' }));
        // The first crumb: the dashboard.
        await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/dashboard'));
    });
});
