import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FormWizard } from '../FormWizard';
import { formConfigClient } from '../../../apiClients/formConfigClient';
import { formSubmissionClient } from '../../../apiClients/formSubmissionClient';
import { fieldValidationRuleClient } from '../../../apiClients/fieldValidationRuleClient';
import { getFetchByIdFunctionForEntity } from '../../../utils/entityApiMapping';
import { FormConfigurationDto, FormFieldDto, FormStepDto } from '../../../types/dtos/forms/FormModels';
import { ValidationResultDto } from '../../../types/dtos/forms/FieldValidationRuleDtos';
import { FieldType } from '../../../utils/enums';

// KNG-269: Next validates a step's rule-bearing fields in one request that names what the form is
// about (the entity in edit mode, else the saved draft), so the API can answer from its log of the
// last run. A result answered that way shows when the rule really ran and offers a Re-check, which
// runs the rule for real (force).

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
        validateFields: jest.fn(),
        resolvePlaceholders: jest.fn()
    }
}));

jest.mock('../../../utils/entityApiMapping', () => ({
    getFetchByIdFunctionForEntity: jest.fn(),
    getCreateFunctionForEntity: jest.fn(),
    getUpdateFunctionForEntity: jest.fn()
}));

const NAME_FIELD_ID = 101;

const field = (id: string, name: string, overrides: Partial<FormFieldDto> = {}): FormFieldDto => ({
    id,
    fieldGuid: `guid-${id}`,
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

const step = (id: string, name: string, fields: FormFieldDto[]): FormStepDto => ({
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
    conditions: [],
    fields
});

const config: FormConfigurationDto = {
    id: '7',
    entityTypeName: 'District',
    configurationName: 'District',
    description: '',
    isDefault: true,
    steps: [
        step('0', 'Basics', [field(String(NAME_FIELD_ID), 'Name', { label: 'Name' })]),
        step('1', 'Details', [field('102', 'Notes', { label: 'Notes' })])
    ]
};

const nameRule = {
    id: 1, formFieldId: NAME_FIELD_ID, validationType: 'ConditionalRequired', configJson: '{}',
    errorMessage: 'Name is taken', isBlocking: true, requiresDependencyFilled: false
};

const twoHoursAgo = () => new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

const cachedFailure = (): ValidationResultDto => ({
    isValid: false,
    isBlocking: true,
    message: 'Name is taken',
    metadata: { validationType: 'ConditionalRequired', executedAt: twoHoursAgo(), fromCache: true }
});

const batchAnswer = (result: ValidationResultDto) => ({ results: { [String(NAME_FIELD_ID)]: result } });

const clickNext = () => fireEvent.click(screen.getByRole('button', { name: /^next$/i }));
const onDetailsStep = () => waitFor(() => expect(screen.getByRole('button', { name: /^submit$/i })).toBeInTheDocument());

const resumedDraft = () => {
    (formConfigClient.getById as jest.Mock).mockResolvedValue(config);
    (formSubmissionClient.getById as jest.Mock).mockResolvedValue({
        id: '55',
        formConfigurationId: '7',
        userId: '1',
        entityTypeName: 'District',
        currentStepIndex: 0,
        currentStepDataJson: JSON.stringify({ Name: 'Old Quarter' }),
        allStepsDataJson: JSON.stringify({ 0: { Name: 'Old Quarter' } }),
        status: 'Paused',
        childProgresses: []
    });
};

describe('FormWizard validation result log (KNG-269)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (fieldValidationRuleClient.getByFormConfigurationId as jest.Mock).mockResolvedValue([nameRule]);
        (formSubmissionClient.create as jest.Mock).mockImplementation(async (dto: Record<string, unknown>) => ({ ...dto, id: '55' }));
        (formSubmissionClient.update as jest.Mock).mockImplementation(async (dto: Record<string, unknown>) => dto);
        (fieldValidationRuleClient.validateField as jest.Mock).mockResolvedValue({ isValid: true, isBlocking: false, message: 'ok' });
    });

    it('Next validates the step in one request naming the draft, and a result answered from the log says when it really ran', async () => {
        resumedDraft();
        (fieldValidationRuleClient.validateFields as jest.Mock).mockResolvedValue(batchAnswer(cachedFailure()));

        render(<FormWizard entityName="District" userId="1" existingProgressId="55" />);
        await screen.findByDisplayValue('Old Quarter');

        clickNext();

        await waitFor(() => expect(fieldValidationRuleClient.validateFields).toHaveBeenCalledTimes(1));
        expect(fieldValidationRuleClient.validateFields).toHaveBeenCalledWith(expect.objectContaining({
            fields: [{ fieldId: NAME_FIELD_ID, fieldValue: 'Old Quarter' }],
            subjectType: 'FormSubmissionProgress',
            subjectId: 55
        }));
        expect(fieldValidationRuleClient.validateField).not.toHaveBeenCalled();

        expect(await screen.findByText(/checked 2 h ago/)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /^submit$/i })).not.toBeInTheDocument();
    });

    it('Re-check runs the rule for real: force, same subject', async () => {
        resumedDraft();
        (fieldValidationRuleClient.validateFields as jest.Mock).mockResolvedValue(batchAnswer(cachedFailure()));

        render(<FormWizard entityName="District" userId="1" existingProgressId="55" />);
        await screen.findByDisplayValue('Old Quarter');
        clickNext();
        const recheck = await screen.findByRole('button', { name: /^re-check$/i });

        fireEvent.click(recheck);

        await waitFor(() => expect(fieldValidationRuleClient.validateField).toHaveBeenCalledWith(expect.objectContaining({
            fieldId: NAME_FIELD_ID,
            fieldValue: 'Old Quarter',
            subjectType: 'FormSubmissionProgress',
            subjectId: 55,
            force: true
        })));
    });

    it('a result that was really run offers the plain re-run and no age', async () => {
        resumedDraft();
        (fieldValidationRuleClient.validateFields as jest.Mock).mockResolvedValue(batchAnswer({
            isValid: false, isBlocking: true, message: 'Name is taken',
            metadata: { validationType: 'ConditionalRequired', executedAt: new Date().toISOString(), fromCache: false }
        }));

        render(<FormWizard entityName="District" userId="1" existingProgressId="55" />);
        await screen.findByDisplayValue('Old Quarter');
        clickNext();

        expect(await screen.findByRole('button', { name: /^re-run validation$/i })).toBeInTheDocument();
        expect(screen.queryByText(/checked .* ago/)).not.toBeInTheDocument();
    });

    it('a passing batch answer lets Next move on', async () => {
        resumedDraft();
        (fieldValidationRuleClient.validateFields as jest.Mock).mockResolvedValue(batchAnswer({ isValid: true, isBlocking: false, message: 'ok' }));

        render(<FormWizard entityName="District" userId="1" existingProgressId="55" />);
        await screen.findByDisplayValue('Old Quarter');
        clickNext();

        await onDetailsStep();
    });

    it('in edit mode the subject is the entity', async () => {
        (formConfigClient.getByEntityTypeName as jest.Mock).mockResolvedValue(config);
        (getFetchByIdFunctionForEntity as jest.Mock).mockReturnValue(async () => ({ id: 17, Name: 'Old Quarter' }));
        (fieldValidationRuleClient.validateFields as jest.Mock).mockResolvedValue(batchAnswer({ isValid: true, isBlocking: false, message: 'ok' }));

        render(<FormWizard entityName="District" entityId="17" userId="1" />);
        await screen.findByDisplayValue('Old Quarter');
        clickNext();

        await waitFor(() => expect(fieldValidationRuleClient.validateFields).toHaveBeenCalledWith(expect.objectContaining({
            subjectType: 'District',
            subjectId: 17
        })));
        await onDetailsStep();
    });

    it('a failed batch request marks every field as not validated instead of letting Next through', async () => {
        resumedDraft();
        (fieldValidationRuleClient.validateFields as jest.Mock).mockRejectedValue(new Error('offline'));

        render(<FormWizard entityName="District" userId="1" existingProgressId="55" />);
        await screen.findByDisplayValue('Old Quarter');
        clickNext();

        expect((await screen.findAllByText('Validation failed to execute.')).length).toBeGreaterThan(0);
        expect(screen.queryByRole('button', { name: /^submit$/i })).not.toBeInTheDocument();
    });
});
