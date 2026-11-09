import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ChildFormModal } from '../ChildFormModal';
import { formConfigClient } from '../../../apiClients/formConfigClient';
import { workflowClient } from '../../../apiClients/workflowClient';
import { fieldValidationRuleClient } from '../../../apiClients/fieldValidationRuleClient';
import { FormConfigurationDto, FormFieldDto, FormStepDto } from '../../../types/dtos/forms/FormModels';
import { FieldType } from '../../../utils/enums';

// #33, LW2-2 (developer's decision 2026-11-06): Escape and the × on a child form ask "Leave this
// form?" first when the child form has unsaved changes (the wizard's value snapshot), like the
// parent form's leave guard; without changes they close at once.

jest.mock('../../../apiClients/formConfigClient', () => ({
    formConfigClient: { getByEntityTypeName: jest.fn(), getById: jest.fn() }
}));
jest.mock('../../../apiClients/workflowClient', () => ({
    workflowClient: { createSession: jest.fn() }
}));
jest.mock('../../../apiClients/metadataClient', () => ({
    metadataClient: {
        getEntityMetadata: jest.fn().mockResolvedValue({ entityName: 'Street', displayName: 'Street', fields: [] })
    }
}));
jest.mock('../../../apiClients/formSubmissionClient', () => ({
    formSubmissionClient: { getById: jest.fn(), create: jest.fn(), update: jest.fn() }
}));
jest.mock('../../../apiClients/fieldValidationRuleClient', () => ({
    fieldValidationRuleClient: { getByFormConfigurationId: jest.fn(), validateField: jest.fn(), resolvePlaceholders: jest.fn() }
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
    id: '9',
    entityTypeName: 'Street',
    configurationName: 'Street',
    description: '',
    isDefault: true,
    steps: [step('0', 'General', [field('Name'), field('Description')])]
};

const renderChildForm = () => {
    const onClose = jest.fn();
    render(
        <ChildFormModal
            open
            entityTypeName="Street"
            fieldName="StreetId"
            currentStepIndex={0}
            onComplete={jest.fn()}
            onClose={onClose}
        />
    );
    return { onClose };
};

const childForm = () => screen.getByRole('dialog', { name: 'Create New Street' });
const leaveQuestion = () => screen.queryByRole('alertdialog', { name: 'Leave this form?' });
const pressEscape = () => fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });

describe('ChildFormModal asks before closing a child form with unsaved changes (LW2-2)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (formConfigClient.getByEntityTypeName as jest.Mock).mockResolvedValue(config);
        (fieldValidationRuleClient.getByFormConfigurationId as jest.Mock).mockResolvedValue([]);
        (workflowClient.createSession as jest.Mock).mockResolvedValue({ id: 77 });
    });

    it('closes at once on Escape when nothing changed', async () => {
        const { onClose } = renderChildForm();
        await screen.findByLabelText(/^Name/);

        pressEscape();

        expect(onClose).toHaveBeenCalledTimes(1);
        expect(leaveQuestion()).not.toBeInTheDocument();
    });

    it('closes at once on the × when nothing changed', async () => {
        const { onClose } = renderChildForm();
        await screen.findByLabelText(/^Name/);

        fireEvent.click(within(childForm()).getByRole('button', { name: 'Close' }));

        expect(onClose).toHaveBeenCalledTimes(1);
        expect(leaveQuestion()).not.toBeInTheDocument();
    });

    it('asks on Escape after a change; Stay keeps the form and its values, Leave form closes it', async () => {
        const { onClose } = renderChildForm();
        const name = await screen.findByLabelText(/^Name/);
        fireEvent.change(name, { target: { value: 'Main street' } });

        pressEscape();

        const question = await screen.findByRole('alertdialog', { name: 'Leave this form?' });
        expect(question).toHaveTextContent("Changes you haven't saved are lost.");
        // A danger question: focus starts on Stay, as on the parent form (LW2-4).
        await waitFor(() => expect(within(question).getByRole('button', { name: 'Stay' })).toHaveFocus());
        expect(onClose).not.toHaveBeenCalled();

        fireEvent.click(within(question).getByRole('button', { name: 'Stay' }));
        await waitFor(() => expect(leaveQuestion()).not.toBeInTheDocument());
        expect(onClose).not.toHaveBeenCalled();
        expect(childForm()).toBeInTheDocument();
        expect(screen.getByLabelText(/^Name/)).toHaveValue('Main street');

        pressEscape();
        fireEvent.click(within(await screen.findByRole('alertdialog', { name: 'Leave this form?' }))
            .getByRole('button', { name: 'Leave form' }));
        await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    });

    it('asks on the × after a change', async () => {
        const { onClose } = renderChildForm();
        fireEvent.change(await screen.findByLabelText(/^Name/), { target: { value: 'Main street' } });

        fireEvent.click(within(childForm()).getByRole('button', { name: 'Close' }));

        const question = await screen.findByRole('alertdialog', { name: 'Leave this form?' });
        expect(onClose).not.toHaveBeenCalled();
        fireEvent.click(within(question).getByRole('button', { name: 'Leave form' }));
        await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    });

    it('Escape on the question answers Stay (only the topmost dialog reacts)', async () => {
        const { onClose } = renderChildForm();
        fireEvent.change(await screen.findByLabelText(/^Name/), { target: { value: 'Main street' } });

        pressEscape();
        await screen.findByRole('alertdialog', { name: 'Leave this form?' });
        pressEscape();

        await waitFor(() => expect(leaveQuestion()).not.toBeInTheDocument());
        expect(onClose).not.toHaveBeenCalled();
        expect(childForm()).toBeInTheDocument();
    });

    it('typed and cleared again is no change: Escape closes at once', async () => {
        const { onClose } = renderChildForm();
        const name = await screen.findByLabelText(/^Name/);
        fireEvent.change(name, { target: { value: 'Main street' } });
        fireEvent.change(name, { target: { value: '' } });

        pressEscape();

        expect(onClose).toHaveBeenCalledTimes(1);
        expect(leaveQuestion()).not.toBeInTheDocument();
    });
});
