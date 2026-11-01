import React, { useState } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { createMemoryRouter, Link, RouterProvider } from 'react-router-dom';
import { FormWizard } from '../FormWizard';
import { FormCancelAction } from '../FormCancelAction';
import { useLeaveGuard } from '../../../hooks/useLeaveGuard';
import { formConfigClient } from '../../../apiClients/formConfigClient';
import { formSubmissionClient } from '../../../apiClients/formSubmissionClient';
import { fieldValidationRuleClient } from '../../../apiClients/fieldValidationRuleClient';
import { getFetchByIdFunctionForEntity } from '../../../utils/entityApiMapping';
import { FormConfigurationDto, FormFieldDto, FormStepDto } from '../../../types/dtos/forms/FormModels';
import { FieldType } from '../../../utils/enums';

// Jest 27 can't read react-router-dom v7's exports map; react-router has the same router and hooks.
jest.mock('react-router-dom', () => jest.requireActual('react-router'), { virtual: true });

// #109, link 5 fix round (developer's live test 2026-10-27, smoke test 4.3a/4.3b): leaving asks only
// when the values differ from the ones the form was opened with, on any step; the progress save
// behind Next doesn't count as saved, Save Draft and a successful submit do.

jest.mock('../../../apiClients/formConfigClient', () => ({
    formConfigClient: { getByEntityTypeName: jest.fn(), getById: jest.fn() }
}));
jest.mock('../../../apiClients/metadataClient', () => ({
    metadataClient: {
        getEntityMetadata: jest.fn().mockResolvedValue({ entityName: 'Town', displayName: 'Town', fields: [] })
    }
}));
jest.mock('../../../apiClients/formSubmissionClient', () => ({
    formSubmissionClient: { getById: jest.fn(), create: jest.fn(), update: jest.fn() }
}));
jest.mock('../../../apiClients/fieldValidationRuleClient', () => ({
    fieldValidationRuleClient: { getByFormConfigurationId: jest.fn(), validateField: jest.fn(), resolvePlaceholders: jest.fn() }
}));
jest.mock('../../../utils/entityApiMapping', () => ({
    getFetchByIdFunctionForEntity: jest.fn(),
    getCreateFunctionForEntity: jest.fn(),
    getUpdateFunctionForEntity: jest.fn()
}));

const field = (fieldName: string, overrides: Partial<FormFieldDto> = {}): FormFieldDto => ({
    id: `guid-${fieldName}`,
    fieldGuid: `guid-${fieldName}`,
    fieldName,
    label: fieldName,
    fieldType: FieldType.String,
    isRequired: false,
    isReadOnly: false,
    order: 0,
    isReusable: false,
    isLinkedToSource: false,
    hasCompatibilityIssues: false,
    validations: [],
    displayConditionGroups: [],
    ...overrides
});

const step = (id: string, stepName: string, fields: FormFieldDto[]): FormStepDto => ({
    id,
    stepName,
    description: '',
    order: Number(id),
    fieldOrderJson: JSON.stringify(fields.map(f => f.fieldGuid)),
    isReusable: false,
    isLinkedToSource: false,
    hasCompatibilityIssues: false,
    isManyToManyRelationship: false,
    childFormSteps: [],
    conditions: [],
    fields
});

const config: FormConfigurationDto = {
    id: '7',
    entityTypeName: 'Town',
    configurationName: 'Town',
    description: '',
    isDefault: true,
    steps: [
        step('0', 'General', [field('Name', { isRequired: true }), field('Description')]),
        step('1', 'Details', [field('Motto')])
    ]
};

const create = formSubmissionClient.create as jest.Mock;
const update = formSubmissionClient.update as jest.Mock;

// The form page in small: the leave guard on the wizard's dirty state, a nav link, a breadcrumb and
// the page's Cancel in the footer, as FormWizardPage wires them.
const FormPage: React.FC<{ entityId?: string; onClosed: () => void }> = ({ entityId, onClosed }) => {
    const [dirty, setDirty] = useState(false);
    const guard = useLeaveGuard(dirty);
    const leave = () => {
        guard.allowLeave();
        onClosed();
    };
    return (
        <div>
            {guard.element}
            <Link to="/dashboard">Dashboard</Link>
            <button type="button" onClick={() => guard.confirmLeave(onClosed)}>Town (breadcrumb)</button>
            <FormWizard
                entityName="town"
                entityId={entityId}
                onDirtyChange={setDirty}
                footerStart={<FormCancelAction onLeave={leave} dirty={dirty} />}
            />
        </div>
    );
};

const renderForm = (entityId?: string) => {
    const onClosed = jest.fn();
    const router = createMemoryRouter([
        { path: '/forms/town', element: <FormPage entityId={entityId} onClosed={onClosed} /> },
        { path: '/dashboard', element: <p>dashboard page</p> }
    ], { initialEntries: ['/forms/town'] });
    render(<RouterProvider router={router} />);
    return { router, onClosed };
};

const footer = () => screen.getByTestId('wizard-footer');
const leaveDialog = () => screen.queryByRole('dialog', { name: 'Leave this form?' });
const stay = async () =>
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Leave this form?' })).getByRole('button', { name: 'Stay' }));

describe('FormWizard leave guard compares values (#109 fix round)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (formConfigClient.getByEntityTypeName as jest.Mock).mockResolvedValue(config);
        (fieldValidationRuleClient.getByFormConfigurationId as jest.Mock).mockResolvedValue([]);
        create.mockImplementation(async (dto: Record<string, unknown>) => ({ ...dto, id: '55' }));
        update.mockImplementation(async (dto: Record<string, unknown>) => dto);
    });

    it('4.3a: typing and clearing again is no change: the nav link and Cancel leave at once', async () => {
        const { onClosed } = renderForm();
        const name = await screen.findByLabelText(/^Name/);

        fireEvent.change(name, { target: { value: 'Cinix' } });
        fireEvent.change(name, { target: { value: '' } });

        fireEvent.click(within(footer()).getByRole('button', { name: /cancel form/i }));
        expect(onClosed).toHaveBeenCalledTimes(1);
        expect(leaveDialog()).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('link', { name: 'Dashboard' }));
        expect(await screen.findByText('dashboard page')).toBeInTheDocument();
        expect(leaveDialog()).not.toBeInTheDocument();
    });

    it('4.3b: after Next the values of step 1 still count: nav link, breadcrumb and Cancel ask', async () => {
        const { router, onClosed } = renderForm();
        fireEvent.change(await screen.findByLabelText(/^Name/), { target: { value: 'Cinix' } });

        fireEvent.click(within(footer()).getByRole('button', { name: /^next$/i }));
        await screen.findByLabelText('Motto');
        // Next saved the progress (InProgress), which is not a Save Draft.
        expect(create).toHaveBeenCalledTimes(1);

        fireEvent.click(screen.getByRole('link', { name: 'Dashboard' }));
        await stay();
        expect(router.state.location.pathname).toBe('/forms/town');

        fireEvent.click(screen.getByRole('button', { name: 'Town (breadcrumb)' }));
        await stay();

        fireEvent.click(within(footer()).getByRole('button', { name: /cancel form/i }));
        await stay();
        expect(onClosed).not.toHaveBeenCalled();
        expect(screen.getByLabelText('Motto')).toBeInTheDocument();
    });

    it('compares across steps: back on step 1 with the name cleared, nothing asks', async () => {
        renderForm();
        fireEvent.change(await screen.findByLabelText(/^Name/), { target: { value: 'Cinix' } });
        fireEvent.click(within(footer()).getByRole('button', { name: /^next$/i }));
        await screen.findByLabelText('Motto');

        fireEvent.click(within(footer()).getByRole('button', { name: /previous/i }));
        const name = await screen.findByLabelText(/^Name/);
        expect(name).toHaveValue('Cinix');
        fireEvent.change(name, { target: { value: '' } });

        fireEvent.click(screen.getByRole('link', { name: 'Dashboard' }));
        expect(await screen.findByText('dashboard page')).toBeInTheDocument();
    });

    it('4.7: no question right after Save Draft; one more change brings it back (also from a later step)', async () => {
        renderForm();
        fireEvent.change(await screen.findByLabelText(/^Name/), { target: { value: 'Cinix' } });
        fireEvent.click(within(footer()).getByRole('button', { name: /^next$/i }));
        const motto = await screen.findByLabelText('Motto');
        fireEvent.change(motto, { target: { value: 'Onward' } });

        fireEvent.click(within(footer()).getByRole('button', { name: /save draft/i }));
        await screen.findByText('Progress saved');
        expect(update).toHaveBeenCalled();

        fireEvent.change(motto, { target: { value: 'Onward!' } });
        fireEvent.click(screen.getByRole('link', { name: 'Dashboard' }));
        await stay();

        // Back to the saved value: no question.
        fireEvent.change(motto, { target: { value: 'Onward' } });
        fireEvent.click(screen.getByRole('link', { name: 'Dashboard' }));
        expect(await screen.findByText('dashboard page')).toBeInTheDocument();
    });

    it('edit mode: the loaded values are the baseline, typing and reverting is no change', async () => {
        (getFetchByIdFunctionForEntity as jest.Mock).mockReturnValue(
            jest.fn().mockResolvedValue({ id: 4, name: 'Cinix', description: null, motto: 'Onward' })
        );
        const { onClosed } = renderForm('4');
        const name = await screen.findByLabelText(/^Name/);
        await waitFor(() => expect(name).toHaveValue('Cinix'));

        fireEvent.change(name, { target: { value: 'Cinix Hold' } });
        fireEvent.click(within(footer()).getByRole('button', { name: /cancel form/i }));
        await stay();

        fireEvent.change(name, { target: { value: 'Cinix' } });
        // An empty description typed and cleared again is no change either.
        fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'x' } });
        fireEvent.change(screen.getByLabelText('Description'), { target: { value: '' } });

        fireEvent.click(within(footer()).getByRole('button', { name: /cancel form/i }));
        expect(onClosed).toHaveBeenCalledTimes(1);
        expect(leaveDialog()).not.toBeInTheDocument();
    });
});

describe('FormWizard footer keeps the field focused on a button press (#109 fix round)', () => {
    beforeEach(() => {
        (formConfigClient.getByEntityTypeName as jest.Mock).mockResolvedValue(config);
        (fieldValidationRuleClient.getByFormConfigurationId as jest.Mock).mockResolvedValue([]);
    });

    it('a mousedown on a footer button does not blur the field, so its message cannot move the button away', async () => {
        renderForm();
        const name = await screen.findByLabelText(/^Name/);
        name.focus();

        const cancel = within(footer()).getByRole('button', { name: /cancel form/i });
        const pressed = fireEvent.mouseDown(cancel);
        expect(pressed).toBe(false); // default prevented: the browser keeps the focus where it is
        expect(screen.queryByText('Name is required')).not.toBeInTheDocument();
    });
});
