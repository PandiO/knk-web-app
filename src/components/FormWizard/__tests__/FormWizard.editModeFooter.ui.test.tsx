import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FormWizard } from '../FormWizard';
import { formConfigClient } from '../../../apiClients/formConfigClient';
import { formSubmissionClient } from '../../../apiClients/formSubmissionClient';
import { fieldValidationRuleClient } from '../../../apiClients/fieldValidationRuleClient';
import { getFetchByIdFunctionForEntity } from '../../../utils/entityApiMapping';
import { FormConfigurationDto, FormFieldDto, FormStepDto } from '../../../types/dtos/forms/FormModels';
import { FieldType, ValidationType } from '../../../utils/enums';

// #109: sticky footer (with the page's Cancel), dirty flag, blur validation + error summary, Save on
// any step in edit mode, single-line String input.

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
        step('0', 'General', [
            field('Name', { isRequired: true }),
            field('Description'),
            field('Code', { validations: [{ validationType: ValidationType.MinLength, parametersJson: '{"min":3}', isActive: true }] })
        ]),
        step('1', 'Details', [field('Motto', { isRequired: true })])
    ]
};

const create = formSubmissionClient.create as jest.Mock;
const update = formSubmissionClient.update as jest.Mock;

const footer = () => screen.getByTestId('wizard-footer');

describe('FormWizard footer, dirty flag and validation (#109)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (formConfigClient.getByEntityTypeName as jest.Mock).mockResolvedValue(config);
        (fieldValidationRuleClient.getByFormConfigurationId as jest.Mock).mockResolvedValue([]);
        create.mockImplementation(async (dto: Record<string, unknown>) => ({ ...dto, id: '55' }));
        update.mockImplementation(async (dto: Record<string, unknown>) => dto);
    });

    it('keeps the actions and the page Cancel in the footer', async () => {
        render(<FormWizard entityName="town" footerStart={<button type="button">Cancel form</button>} />);
        await screen.findByLabelText(/^Name/);

        for (const name of [/cancel form/i, /previous/i, /save draft/i, /^next$/i]) {
            expect(within(footer()).getByRole('button', { name })).toBeInTheDocument();
        }
        // Save on any step is for edit mode only.
        expect(screen.queryByRole('button', { name: /save changes/i })).not.toBeInTheDocument();
    });

    it('renders a single-line String as an input tied to its label, a description as a text area', async () => {
        render(<FormWizard entityName="town" />);

        const name = await screen.findByLabelText(/^Name/);
        expect(name.tagName).toBe('INPUT');
        expect(screen.getByLabelText('Description').tagName).toBe('TEXTAREA');
    });

    it('validates a field when it loses the focus and clears the message once fixed', async () => {
        render(<FormWizard entityName="town" />);
        const name = await screen.findByLabelText(/^Name/);

        fireEvent.blur(name);
        expect(await screen.findByText('Name is required')).toBeInTheDocument();

        fireEvent.change(name, { target: { value: 'Cinix' } });
        fireEvent.blur(name);
        await waitFor(() => expect(screen.queryByText('Name is required')).not.toBeInTheDocument());

        // The field's own validations run too (they were a placeholder).
        const code = screen.getByLabelText('Code');
        fireEvent.change(code, { target: { value: 'ab' } });
        fireEvent.blur(code);
        expect(await screen.findByText('Code needs at least 3 characters')).toBeInTheDocument();
    });

    it('a refused Next shows an error summary whose links focus the field', async () => {
        render(<FormWizard entityName="town" />);
        await screen.findByLabelText(/^Name/);

        fireEvent.click(within(footer()).getByRole('button', { name: /^next$/i }));

        const summary = await screen.findByRole('alert');
        expect(within(summary).getByText('Fix this field to continue')).toBeInTheDocument();
        await waitFor(() => expect(summary).toHaveFocus());
        fireEvent.click(within(summary).getByRole('link', { name: 'Name is required' }));
        expect(screen.getByLabelText(/^Name/)).toHaveFocus();
        expect(create).not.toHaveBeenCalled();
    });

    it('reports unsaved changes until they are saved', async () => {
        const onDirtyChange = jest.fn();
        render(<FormWizard entityName="town" onDirtyChange={onDirtyChange} />);
        const name = await screen.findByLabelText(/^Name/);
        expect(onDirtyChange).toHaveBeenLastCalledWith(false);

        fireEvent.change(name, { target: { value: 'Cinix' } });
        expect(onDirtyChange).toHaveBeenLastCalledWith(true);

        fireEvent.click(within(footer()).getByRole('button', { name: /save draft/i }));
        await waitFor(() => expect(create).toHaveBeenCalled());
        await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(false));
    });

    describe('edit mode', () => {
        const entity = { id: 4, name: 'Cinix', description: 'Old town', code: 'CNX', motto: 'Onward' };

        beforeEach(() => {
            (getFetchByIdFunctionForEntity as jest.Mock).mockReturnValue(jest.fn().mockResolvedValue(entity));
        });

        it('saves from the first step with the values of every step', async () => {
            const onComplete = jest.fn().mockResolvedValue(true);
            const onCompleted = jest.fn();
            render(<FormWizard entityName="town" entityId="4" onComplete={onComplete} onCompleted={onCompleted} />);
            await waitFor(() => expect(screen.getByLabelText(/^Name/)).toHaveValue('Cinix'));

            fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: 'Cinix Hold' } });
            fireEvent.click(within(footer()).getByRole('button', { name: /save changes/i }));

            await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
            expect(onComplete.mock.calls[0][0]).toEqual(expect.objectContaining({ id: '4', Name: 'Cinix Hold', Motto: 'Onward' }));
            await waitFor(() => expect(onCompleted).toHaveBeenCalled());
        });

        it('shows the step that would refuse the save instead of saving', async () => {
            (getFetchByIdFunctionForEntity as jest.Mock).mockReturnValue(jest.fn().mockResolvedValue({ ...entity, motto: '' }));
            const onComplete = jest.fn();
            render(<FormWizard entityName="town" entityId="4" onComplete={onComplete} />);
            await waitFor(() => expect(screen.getByLabelText(/^Name/)).toHaveValue('Cinix'));

            fireEvent.click(within(footer()).getByRole('button', { name: /save changes/i }));

            const summary = await screen.findByRole('alert');
            expect(within(summary).getByRole('link', { name: 'Motto is required' })).toBeInTheDocument();
            expect(screen.getByLabelText(/^Motto/)).toBeInTheDocument();
            expect(screen.getByText('Fix "Details" before saving.')).toBeInTheDocument();
            await act(async () => undefined);
            expect(onComplete).not.toHaveBeenCalled();
            // The last step submits as before: no extra Save button there.
            expect(screen.queryByRole('button', { name: /save changes/i })).not.toBeInTheDocument();
        });
    });
});
