import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { FormWizard } from '../FormWizard';
import { formConfigClient } from '../../../apiClients/formConfigClient';
import { formSubmissionClient } from '../../../apiClients/formSubmissionClient';
import { fieldValidationRuleClient } from '../../../apiClients/fieldValidationRuleClient';
import { logging } from '../../../utils';
import { FormConfigurationDto, FormFieldDto, FormStepDto, StepConditionDto } from '../../../types/dtos/forms/FormModels';
import { ValidationResultDto } from '../../../types/dtos/forms/FieldValidationRuleDtos';
import { ConditionOperator, FieldType, ValidationType } from '../../../utils/enums';

// PandiO/knk-workspace#488: one set of places for every kind of failure on Next, Submit or a stopped jump: each
// problem once in the summary at the top (linked to its field, or text when it has no field on this step), once
// on its field (under it, in the same style), one toast on Next/Submit, and nothing above the Next button.

jest.mock('../ManyToManyRelationshipEditor', () => ({
    ManyToManyRelationshipEditor: ({ value, onChange }: {
        value: Record<string, unknown>[];
        onChange: (value: Record<string, unknown>[]) => void;
    }) => (
        <div>
            <button type="button" onClick={() => onChange([{ relatedEntityId: 1, relatedEntity: { id: 1, name: 'Sharpness' } }])}>
                Add Sharpness
            </button>
            <button type="button" onClick={() => onChange(value.map(entry => ({ ...entry, Level: 3 })))}>
                Set level
            </button>
        </div>
    )
}));

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
        update: jest.fn(),
        getWorldTasks: jest.fn().mockResolvedValue([])
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

const NAME_ID = 101;
const REGION_ID = 201;

const field = (id: number, name: string, overrides: Partial<FormFieldDto> = {}): FormFieldDto => ({
    id: String(id),
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

const rule = (id: number, formFieldId: number, isBlocking = true) => ({
    id, formFieldId, validationType: 'RegionContainment', configJson: '{}',
    errorMessage: 'failed', isBlocking, requiresDependencyFilled: false
});

const useConfig = (config: FormConfigurationDto) =>
    (formConfigClient.getByEntityTypeName as jest.Mock).mockResolvedValue(config);

const answerRules = (results: Record<number, ValidationResultDto>) =>
    (fieldValidationRuleClient.validateFields as jest.Mock).mockImplementation(async (request: { fields: { fieldId: number }[] }) => ({
        results: Object.fromEntries(request.fields.map(f => [String(f.fieldId), results[f.fieldId] ?? { isValid: true, isBlocking: true }]))
    }));

const onStep = (name: string) => waitFor(() => expect(screen.getByRole('heading', { level: 2, name })).toBeInTheDocument());
const typeName = async (value: string) => fireEvent.change(await screen.findByLabelText(/^name/i), { target: { value } });
const next = () => fireEvent.click(screen.getByRole('button', { name: /^next$/i }));
const summary = () => screen.getByRole('alert', { name: /^fix (this problem|these \d+ problems) to continue$/i });
const summaryTexts = () => within(summary()).getAllByRole('listitem').map(item => item.textContent);
const box = (fieldName: string) => document.getElementById(`wizard-field-${fieldName}`)!;
/** The field's one message: under the field, in the field-error style, and its box red. */
const expectFieldMessage = (fieldName: string, message: string) => {
    const messages = within(box(fieldName)).getAllByText(message);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toHaveClass('field-error');
    expect(box(fieldName)).toHaveClass('border-danger-line');
};
const expectNoFooterMessage = () => {
    expect(screen.queryByTestId('wizard-condition-error')).not.toBeInTheDocument();
    expect(within(screen.getByTestId('wizard-footer')).queryByRole('alert')).not.toBeInTheDocument();
};

const condition = (type: 'Completion' | 'Entry', rows: object[], message: string, logic: 'AND' | 'OR' = 'AND'): StepConditionDto => ({
    id: `${type}-${message}`,
    conditionType: type,
    conditionJson: JSON.stringify({ conditions: rows, logic }),
    errorMessage: message,
    isActive: true
});
const regionSet = { fieldName: 'Region', operator: ConditionOperator.IsNotEmpty };
const entryAllowed = { fieldName: 'AllowEntry', operator: ConditionOperator.Equals, value: true };

const config = (options: {
    nameField?: Partial<FormFieldDto>;
    regionRequired?: boolean;
    regionConditions?: StepConditionDto[];
    detailsConditions?: StepConditionDto[];
} = {}): FormConfigurationDto => ({
    id: '7',
    entityTypeName: 'District',
    configurationName: 'District',
    description: '',
    isDefault: true,
    steps: [
        step('0', 'Basics', [field(NAME_ID, 'Name', { isRequired: true, ...options.nameField })]),
        step('1', 'Region', [
            field(REGION_ID, 'Region', { isRequired: options.regionRequired ?? false }),
            field(202, 'AllowEntry', { label: 'Allow entry', fieldType: FieldType.Boolean })
        ], options.regionConditions ?? []),
        step('2', 'Details', [field(301, 'Notes')], options.detailsConditions ?? [])
    ]
});

describe('FormWizard: one set of validation messages for every kind of failure (#488)', () => {
    let toasts: jest.SpyInstance;

    beforeEach(() => {
        jest.clearAllMocks();
        toasts = jest.spyOn(logging.errorHandler, 'next').mockImplementation(() => undefined);
        (fieldValidationRuleClient.getByFormConfigurationId as jest.Mock).mockResolvedValue([]);
        (formSubmissionClient.create as jest.Mock).mockImplementation(async (dto: Record<string, unknown>) => ({ ...dto, id: '55' }));
        (formSubmissionClient.update as jest.Mock).mockImplementation(async (dto: Record<string, unknown>) => dto);
        answerRules({});
    });

    afterEach(() => toasts.mockRestore());

    const toRegionStep = async (options: Parameters<typeof config>[0] = {}) => {
        useConfig(config(options));
        render(<FormWizard entityName="District" />);
        await typeName('Old Quarter');
        next();
        await onStep('Region');
        toasts.mockClear();
    };

    it('a required field: summary link, field message, one toast, nothing above Next', async () => {
        useConfig(config());
        render(<FormWizard entityName="District" />);
        await onStep('Basics');

        next();

        await waitFor(() => expect(summaryTexts()).toEqual(['Name is required']));
        expect(within(summary()).getByRole('link', { name: 'Name is required' })).toBeInTheDocument();
        expectFieldMessage('Name', 'Name is required');
        expect(toasts).toHaveBeenCalledTimes(1);
        expect(toasts).toHaveBeenCalledWith('Name is required');
        expectNoFooterMessage();
    });

    it('a field validation (minimum length): the same three places', async () => {
        useConfig(config({ nameField: { validations: [{ validationType: ValidationType.MinLength, parametersJson: '{"min":3}', isActive: true } as never] } }));
        render(<FormWizard entityName="District" />);
        await typeName('ab');

        next();

        await waitFor(() => expect(summaryTexts()).toHaveLength(1));
        const message = summaryTexts()[0]!;
        expect(message).toMatch(/3/);
        expectFieldMessage('Name', message);
        expect(toasts).toHaveBeenCalledTimes(1);
        expect(toasts).toHaveBeenCalledWith(message);
        expectNoFooterMessage();
    });

    it('a blocking rule: its message once in the summary and once on the field (not again under it), one toast', async () => {
        (fieldValidationRuleClient.getByFormConfigurationId as jest.Mock).mockResolvedValue([rule(1, REGION_ID)]);
        await toRegionStep();
        answerRules({ [REGION_ID]: { isValid: false, isBlocking: true, message: 'The region is outside the town.' } });
        fireEvent.change(screen.getByLabelText(/^region/i), { target: { value: 'district_9' } });

        next();

        await waitFor(() => expect(summaryTexts()).toEqual(['The region is outside the town.']));
        expectFieldMessage('Region', 'The region is outside the town.');
        expect(screen.getAllByText('The region is outside the town.')).toHaveLength(2);
        // The toast names the field, since it is read away from the form.
        await waitFor(() => expect(toasts).toHaveBeenCalledWith('Region: The region is outside the town.'));
        expect(toasts).toHaveBeenCalledTimes(1);
        expect(screen.queryByText('Please resolve validation errors before continuing.')).not.toBeInTheDocument();
        expectNoFooterMessage();
    });

    it('a rule that could not be checked: the same places, the message said once on the field', async () => {
        const message = 'Cannot verify this rule right now: plugin offline';
        (fieldValidationRuleClient.getByFormConfigurationId as jest.Mock).mockResolvedValue([rule(1, REGION_ID)]);
        await toRegionStep();
        answerRules({ [REGION_ID]: {
            isValid: false,
            isBlocking: true,
            message,
            metadata: { validationType: 'RegionContainment', executedAt: new Date().toISOString(), failureReason: 'PluginUnreachable' }
        } });
        fireEvent.change(screen.getByLabelText(/^region/i), { target: { value: 'district_9' } });

        next();

        await waitFor(() => expect(summaryTexts()).toEqual([message]));
        expectFieldMessage('Region', message);
        expect(screen.queryByText('Validation could not be completed')).not.toBeInTheDocument();
        // Its Re-check stays.
        expect(within(box('Region')).getByRole('button', { name: /re-run validation|re-check/i })).toBeInTheDocument();
        expect(toasts).toHaveBeenCalledTimes(1);
        expectNoFooterMessage();
    });

    it('a warning keeps its own line and is not in the summary', async () => {
        (fieldValidationRuleClient.getByFormConfigurationId as jest.Mock).mockResolvedValue([rule(1, REGION_ID, false)]);
        await toRegionStep({ regionConditions: [condition('Completion', [entryAllowed], 'Allow entry before you continue.')] });
        answerRules({ [REGION_ID]: { isValid: false, isBlocking: false, message: 'The region is small.' } });
        (fieldValidationRuleClient.validateField as jest.Mock).mockResolvedValue({ isValid: false, isBlocking: false, message: 'The region is small.' });
        fireEvent.change(screen.getByLabelText(/^region/i), { target: { value: 'district_9' } });
        fireEvent.blur(screen.getByLabelText(/^region/i));
        expect(await within(box('Region')).findByText(/The region is small\./)).toBeInTheDocument();

        next();

        await waitFor(() => expect(summaryTexts()).toEqual(['Allow entry before you continue.']));
        expect(within(box('Region')).getByText(/The region is small\./)).not.toHaveClass('field-error');
    });

    it('the screenshot case: Region required and a failed condition are both in the summary, each on its field, one toast', async () => {
        await toRegionStep({ regionRequired: true, regionConditions: [condition('Completion', [entryAllowed], 'Allow entry before you continue.')] });

        next();

        await waitFor(() => expect(summaryTexts()).toEqual(['Region is required', 'Allow entry before you continue.']));
        expect(within(summary()).getByRole('heading', { name: 'Fix these 2 problems to continue' })).toBeInTheDocument();
        expect(within(summary()).getByRole('link', { name: 'Allow entry before you continue.' })).toBeInTheDocument();
        expectFieldMessage('Region', 'Region is required');
        expectFieldMessage('AllowEntry', 'Allow entry before you continue.');
        // The checkbox's message is under it, like every other field's (it was next to the label).
        const allowMessage = within(box('AllowEntry')).getByText('Allow entry before you continue.');
        expect(allowMessage.parentElement).not.toHaveClass('flex');
        expect(toasts).toHaveBeenCalledTimes(1);
        expect(toasts).toHaveBeenCalledWith('Fix the 2 problems on this step to continue.');
        expectNoFooterMessage();

        // Each goes when it holds.
        fireEvent.click(screen.getByRole('checkbox'));
        expect(summaryTexts()).toEqual(['Region is required']);
    });

    it.each([
        ['one rule', [entryAllowed], 'AND', ['AllowEntry']],
        ['all rules (AND), the failing one marked', [regionSet, entryAllowed], 'AND', ['Region', 'AllowEntry']],
        ['any rule (OR), every field marked', [regionSet, entryAllowed], 'OR', ['Region', 'AllowEntry']]
    ] as const)('a "before leaving" condition, %s: once in the summary, on the fields it reads', async (_label, rows, logic, marked) => {
        const message = 'Pick a region and allow entry.';
        await toRegionStep({ regionConditions: [condition('Completion', [...rows], message, logic)] });

        next();

        await waitFor(() => expect(summaryTexts()).toEqual([message]));
        expect(within(summary()).getByRole('link', { name: message })).toBeInTheDocument();
        marked.forEach(fieldName => expectFieldMessage(fieldName, message));
        expect(toasts).toHaveBeenCalledTimes(1);
        expect(toasts).toHaveBeenCalledWith(message);
        expectNoFooterMessage();
    });

    it('a condition that reads a field of an earlier step: in the summary only, as text', async () => {
        const message = 'The district needs a name.';
        useConfig(config({
            nameField: { isRequired: false },
            regionConditions: [condition('Completion', [{ fieldName: 'Name', operator: ConditionOperator.IsNotEmpty, fromPreviousStep: true }], message)]
        }));
        render(<FormWizard entityName="District" />);
        await onStep('Basics');
        next();
        await onStep('Region');
        toasts.mockClear();

        next();

        await waitFor(() => expect(summaryTexts()).toEqual([message]));
        expect(within(summary()).queryByRole('link')).not.toBeInTheDocument();
        expect(box('Region')).not.toHaveClass('border-danger-line');
        expect(toasts).toHaveBeenCalledWith(message);
        expectNoFooterMessage();
    });

    it('a "before entering" condition of the next step: in the summary, on the field of this step it reads', async () => {
        const message = 'Pick the region first.';
        await toRegionStep({ detailsConditions: [condition('Entry', [{ ...regionSet, fromPreviousStep: true }], message)] });

        next();

        await waitFor(() => expect(summaryTexts()).toEqual([message]));
        expectFieldMessage('Region', message);
        expect(toasts).toHaveBeenCalledTimes(1);
        expectNoFooterMessage();
    });

    it('a many-to-many step: an entry missing a required value is in the summary (linked to the entries) and blocks Next', async () => {
        const enchantments: FormStepDto = {
            ...step('1', 'Enchantments', []),
            isManyToManyRelationship: true,
            relatedEntityPropertyName: 'Enchantments',
            childFormSteps: [step('10', 'Entry', [field(501, 'Level', { isRequired: true })])]
        };
        useConfig({ ...config(), steps: [config().steps[0], enchantments, config().steps[2]] });
        render(<FormWizard entityName="District" />);
        await typeName('Old Quarter');
        next();
        await onStep('Enchantments');
        toasts.mockClear();
        fireEvent.click(screen.getByRole('button', { name: 'Add Sharpness' }));

        next();

        await waitFor(() => expect(summaryTexts()).toEqual(['Sharpness: Level: Level is required']));
        expect(within(summary()).getByRole('link')).toHaveAttribute('href', '#wizard-field-Enchantments');
        expect(toasts).toHaveBeenCalledTimes(1);
        expect(screen.getByRole('heading', { level: 2, name: 'Enchantments' })).toBeInTheDocument();
        expectNoFooterMessage();

        fireEvent.click(screen.getByRole('button', { name: 'Set level' }));
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        next();
        await onStep('Details');
    });

    it('a step-jump stop: after Go to, the same summary and field marks as after Next, without a toast', async () => {
        useConfig(config({ regionRequired: true, regionConditions: [condition('Completion', [entryAllowed], 'Allow entry before you continue.')] }));
        render(<FormWizard entityName="District" />);
        await typeName('Old Quarter');

        fireEvent.click(screen.getByRole('button', { name: 'Step 3: Details' }));
        const dialog = await screen.findByRole('alertdialog');
        // The dialog keeps its own short list.
        expect(within(screen.getByTestId('wizard-jump-feedback')).getAllByRole('listitem')).toHaveLength(2);
        fireEvent.click(within(dialog).getByRole('button', { name: 'Go to Region' }));
        await onStep('Region');

        expect(summaryTexts()).toEqual(['Region is required', 'Allow entry before you continue.']);
        expectFieldMessage('Region', 'Region is required');
        expectFieldMessage('AllowEntry', 'Allow entry before you continue.');
        expect(toasts).not.toHaveBeenCalled();
        expectNoFooterMessage();
    });
});
