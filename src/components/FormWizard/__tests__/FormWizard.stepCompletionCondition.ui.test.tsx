import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FormWizard } from '../FormWizard';
import { formConfigClient } from '../../../apiClients/formConfigClient';
import { formSubmissionClient } from '../../../apiClients/formSubmissionClient';
import { fieldValidationRuleClient } from '../../../apiClients/fieldValidationRuleClient';
import { logging } from '../../../utils';
import { FormConfigurationDto, FormFieldDto, FormStepDto, StepConditionDto } from '../../../types/dtos/forms/FormModels';
import { ConditionOperator, FieldType } from '../../../utils/enums';

// KNG-186: a step's Completion condition must stop Next while it fails. Until 2026-10-23 the API sent
// isActive: false for every condition (the DTO had the flag, the model didn't), and handleNext only
// ran a condition when isActive was true, so no completion condition ever ran. Now the API sends the
// stored value (true unless an admin switched the condition off) and the wizard treats a condition as
// active unless it is explicitly false.

jest.mock('../../../apiClients/formConfigClient', () => ({
    formConfigClient: {
        getByEntityTypeName: jest.fn(),
        getById: jest.fn()
    }
}));

jest.mock('../../../apiClients/metadataClient', () => ({
    metadataClient: {
        getEntityMetadata: jest.fn().mockResolvedValue({ entityName: '', displayName: '', fields: [] })
    }
}));

jest.mock('../../../apiClients/formSubmissionClient', () => ({
    formSubmissionClient: {
        getById: jest.fn(),
        create: jest.fn(),
        update: jest.fn()
    }
}));

jest.mock('../../../apiClients/fieldValidationRuleClient', () => ({
    fieldValidationRuleClient: {
        getByFormConfigurationId: jest.fn(),
        validateField: jest.fn(),
        resolvePlaceholders: jest.fn()
    }
}));

jest.mock('../../../utils/entityApiMapping', () => ({
    getFetchByIdFunctionForEntity: jest.fn(),
    getCreateFunctionForEntity: jest.fn(),
    getUpdateFunctionForEntity: jest.fn()
}));

const AGREED_GUID = 'guid-agreed';
const MESSAGE = 'You must agree to the terms before continuing.';

const field = (guid: string, name: string, overrides: Partial<FormFieldDto> = {}): FormFieldDto => ({
    id: guid,
    fieldGuid: guid,
    fieldName: name,
    label: name,
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

const step = (id: string, name: string, fields: FormFieldDto[], conditions: StepConditionDto[] = []): FormStepDto => ({
    id,
    stepName: name,
    description: '',
    order: Number(id),
    fieldOrderJson: JSON.stringify(fields.map(f => f.fieldGuid)),
    isReusable: false,
    isLinkedToSource: false,
    hasCompatibilityIssues: false,
    isManyToManyRelationship: false,
    childFormSteps: [],
    conditions,
    fields
});

// "AgreedToTerms must be true", as StepEditor stores it (ParsedStepCondition).
const mustAgree = (overrides: Partial<StepConditionDto> = {}): StepConditionDto => ({
    id: '9',
    formStepId: '0',
    conditionType: 'Completion',
    conditionJson: JSON.stringify({ conditions: [{ fieldName: 'AgreedToTerms', operator: ConditionOperator.Equals, value: true }] }),
    errorMessage: MESSAGE,
    isActive: true,
    ...overrides
});

const buildConfig = (conditions: StepConditionDto[]): FormConfigurationDto => ({
    id: '7',
    entityTypeName: 'PermissionGroup',
    configurationName: 'Permission group',
    description: '',
    isDefault: true,
    steps: [
        step('0', 'Terms', [field(AGREED_GUID, 'AgreedToTerms', { label: 'Agreed to terms', fieldType: FieldType.Boolean })], conditions),
        step('1', 'Details', [field('guid-notes', 'Notes', { label: 'Notes' })])
    ]
});

const clickNext = () => fireEvent.click(screen.getByRole('button', { name: /^next$/i }));
const onDetailsStep = () => waitFor(() => expect(screen.getByRole('button', { name: /^submit$/i })).toBeInTheDocument());

describe('FormWizard step completion condition (KNG-186)', () => {
    let errors: jest.SpyInstance;

    beforeEach(() => {
        jest.clearAllMocks();
        errors = jest.spyOn(logging.errorHandler, 'next').mockImplementation(() => undefined);
        (fieldValidationRuleClient.getByFormConfigurationId as jest.Mock).mockResolvedValue([]);
        (formSubmissionClient.create as jest.Mock).mockImplementation(async (dto: Record<string, unknown>) => ({ ...dto, id: '55' }));
        (formSubmissionClient.update as jest.Mock).mockImplementation(async (dto: Record<string, unknown>) => dto);
    });

    afterEach(() => errors.mockRestore());

    it('a failing completion condition stops Next and shows its message', async () => {
        (formConfigClient.getByEntityTypeName as jest.Mock).mockResolvedValue(buildConfig([mustAgree()]));

        render(<FormWizard entityName="PermissionGroup" userId="1" />);
        expect(await screen.findByRole('checkbox')).not.toBeChecked();

        clickNext();

        await waitFor(() => expect(errors).toHaveBeenCalledWith(MESSAGE));
        expect(screen.getByRole('checkbox')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /^submit$/i })).not.toBeInTheDocument();
        expect(formSubmissionClient.create).not.toHaveBeenCalled();
    });

    it('once the condition holds, Next moves on', async () => {
        (formConfigClient.getByEntityTypeName as jest.Mock).mockResolvedValue(buildConfig([mustAgree()]));

        render(<FormWizard entityName="PermissionGroup" userId="1" />);
        fireEvent.click(await screen.findByRole('checkbox'));

        clickNext();

        await onDetailsStep();
        expect(errors).not.toHaveBeenCalledWith(MESSAGE);
    });

    it('a condition the admin switched off (isActive: false) does not stop Next', async () => {
        (formConfigClient.getByEntityTypeName as jest.Mock).mockResolvedValue(buildConfig([mustAgree({ isActive: false })]));

        render(<FormWizard entityName="PermissionGroup" userId="1" />);
        expect(await screen.findByRole('checkbox')).not.toBeChecked();

        clickNext();

        await onDetailsStep();
        expect(errors).not.toHaveBeenCalledWith(MESSAGE);
    });

    it('a condition without the flag counts as active', async () => {
        const { isActive, ...withoutFlag } = mustAgree();
        (formConfigClient.getByEntityTypeName as jest.Mock).mockResolvedValue(buildConfig([withoutFlag as StepConditionDto]));

        render(<FormWizard entityName="PermissionGroup" userId="1" />);
        expect(await screen.findByRole('checkbox')).not.toBeChecked();

        clickNext();

        await waitFor(() => expect(errors).toHaveBeenCalledWith(MESSAGE));
        expect(screen.queryByRole('button', { name: /^submit$/i })).not.toBeInTheDocument();
    });

    it('an Entry condition is not checked on Next', async () => {
        (formConfigClient.getByEntityTypeName as jest.Mock).mockResolvedValue(buildConfig([mustAgree({ conditionType: 'Entry' })]));

        render(<FormWizard entityName="PermissionGroup" userId="1" />);
        expect(await screen.findByRole('checkbox')).not.toBeChecked();

        clickNext();

        await onDetailsStep();
        expect(errors).not.toHaveBeenCalledWith(MESSAGE);
    });
});
