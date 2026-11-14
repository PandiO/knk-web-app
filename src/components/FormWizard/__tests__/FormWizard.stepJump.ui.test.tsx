import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { FormWizard } from '../FormWizard';
import { formConfigClient } from '../../../apiClients/formConfigClient';
import { formSubmissionClient } from '../../../apiClients/formSubmissionClient';
import { fieldValidationRuleClient } from '../../../apiClients/fieldValidationRuleClient';
import { logging } from '../../../utils';
import { FormConfigurationDto, FormFieldDto, FormStepDto, StepConditionDto } from '../../../types/dtos/forms/FormModels';
import { ValidationResultDto } from '../../../types/dtos/forms/FieldValidationRuleDtos';
import { ConditionOperator, FieldType } from '../../../utils/enums';

// PandiO/knk-workspace#68: a step in the progress strip can be clicked. Back always works; forward checks
// the current step and every step up to the clicked one like Next does, and a dialog names the first
// step that fails. PandiO/knk-workspace#88: the wizard enforces Entry conditions, on Next and on a jump.

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

const ALLOW_MESSAGE = 'Allow entry before you continue.';
const ENTRY_MESSAGE = 'Give the district a name first.';

const mustAllowEntry: StepConditionDto = {
    id: '9',
    conditionType: 'Completion',
    conditionJson: JSON.stringify({ conditions: [{ fieldName: 'AllowEntry', operator: ConditionOperator.Equals, value: true }], logic: 'AND' }),
    errorMessage: ALLOW_MESSAGE,
    isActive: true
};

const nameFromEarlierStep: StepConditionDto = {
    id: '10',
    conditionType: 'Entry',
    conditionJson: JSON.stringify({ conditions: [{ fieldName: 'Name', operator: ConditionOperator.IsNotEmpty, fromPreviousStep: true }], logic: 'AND' }),
    errorMessage: ENTRY_MESSAGE,
    isActive: true
};

const buildConfig = (options: {
    nameRequired?: boolean;
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
        step('0', 'Basics', [field(NAME_ID, 'Name', { isRequired: options.nameRequired ?? true })]),
        step('1', 'Region', [
            field(REGION_ID, 'Region', { isRequired: options.regionRequired ?? false }),
            field(202, 'AllowEntry', { label: 'Allow entry', fieldType: FieldType.Boolean })
        ], options.regionConditions ?? []),
        step('2', 'Details', [field(301, 'Notes')], options.detailsConditions ?? [])
    ]
});

const rule = (id: number, formFieldId: number, isBlocking = true) => ({
    id, formFieldId, validationType: 'RegionContainment', configJson: '{}',
    errorMessage: 'failed', isBlocking, requiresDependencyFilled: false
});

const useConfig = (config: FormConfigurationDto) =>
    (formConfigClient.getByEntityTypeName as jest.Mock).mockResolvedValue(config);

/** Answers validateFields per field id; a field without an entry passes. */
const answerRules = (results: Record<number, ValidationResultDto>) =>
    (fieldValidationRuleClient.validateFields as jest.Mock).mockImplementation(async (request: { fields: { fieldId: number }[] }) => ({
        results: Object.fromEntries(request.fields.map(f => [String(f.fieldId), results[f.fieldId] ?? { isValid: true, isBlocking: true }]))
    }));

const stepButton = (label: string) => screen.getByRole('button', { name: label });
const onStep = (name: string) => waitFor(() => expect(screen.getByRole('heading', { level: 2, name })).toBeInTheDocument());
const typeName = async (value: string) => fireEvent.change(await screen.findByLabelText(/^name/i), { target: { value } });
const jumpDialog = () => screen.getByTestId('wizard-jump-feedback');

describe('FormWizard step jump (#68) and Entry conditions (#88)', () => {
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

    it('the steps are buttons; the current one is marked', async () => {
        useConfig(buildConfig());
        render(<FormWizard entityName="District" />);
        await onStep('Basics');

        expect(stepButton('Step 1: Basics')).toHaveAttribute('aria-current', 'step');
        expect(stepButton('Step 3: Details')).not.toHaveAttribute('aria-current');
        expect(stepButton('Step 3: Details')).toBeEnabled();
    });

    it('jumps forward over a step when nothing fails, and saves the progress like Next', async () => {
        useConfig(buildConfig());
        render(<FormWizard entityName="District" />);
        await typeName('Old Quarter');

        fireEvent.click(stepButton('Step 3: Details'));

        await onStep('Details');
        expect(screen.queryByTestId('wizard-jump-feedback')).not.toBeInTheDocument();
        expect(formSubmissionClient.create).toHaveBeenCalledTimes(1);
        expect(stepButton('Step 3: Details')).toHaveAttribute('aria-current', 'step');
    });

    it('going back is always allowed, also with the current step unfinished', async () => {
        useConfig(buildConfig({ regionConditions: [mustAllowEntry] }));
        render(<FormWizard entityName="District" />);
        await typeName('Old Quarter');
        fireEvent.click(stepButton('Step 2: Region'));
        await onStep('Region');

        fireEvent.click(stepButton('Step 1: Basics'));

        await onStep('Basics');
        expect(screen.getByLabelText(/^name/i)).toHaveValue('Old Quarter');
        expect(screen.queryByTestId('wizard-jump-feedback')).not.toBeInTheDocument();
    });

    it('stops on the current step and says which field is missing', async () => {
        useConfig(buildConfig());
        render(<FormWizard entityName="District" />);
        await onStep('Basics');

        fireEvent.click(stepButton('Step 3: Details'));

        expect(await screen.findByText('Can\'t go to "Details" yet')).toBeInTheDocument();
        expect(screen.getByText('Finish "Basics" first:')).toBeInTheDocument();
        expect(within(jumpDialog()).getByText('Name is required')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /^go to/i })).not.toBeInTheDocument();
        expect(screen.getByRole('heading', { level: 2, name: 'Basics' })).toBeInTheDocument();
        expect(formSubmissionClient.create).not.toHaveBeenCalled();
    });

    it('stops at the first step in between that fails and offers to go there', async () => {
        useConfig(buildConfig({ regionConditions: [mustAllowEntry] }));
        render(<FormWizard entityName="District" />);
        await typeName('Old Quarter');

        fireEvent.click(stepButton('Step 3: Details'));

        expect(await screen.findByText('"Region" needs your attention first:')).toBeInTheDocument();
        expect(within(jumpDialog()).getByText(ALLOW_MESSAGE)).toBeInTheDocument();
        expect(screen.getByRole('heading', { level: 2, name: 'Basics' })).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Go to Region' }));

        await onStep('Region');
        // The reason stays on the step, above the Next button.
        expect(screen.getByTestId('wizard-condition-error')).toHaveTextContent(ALLOW_MESSAGE);
        await waitFor(() => expect(screen.queryByTestId('wizard-jump-feedback')).not.toBeInTheDocument());
    });

    it('a blocking rule on a step in between stops the jump with the rule\'s message', async () => {
        (fieldValidationRuleClient.getByFormConfigurationId as jest.Mock).mockResolvedValue([rule(1, REGION_ID)]);
        answerRules({ [REGION_ID]: { isValid: false, isBlocking: true, message: 'The region is outside the town.' } });
        useConfig(buildConfig());
        render(<FormWizard entityName="District" />);
        await typeName('Old Quarter');

        fireEvent.click(stepButton('Step 3: Details'));

        expect(await screen.findByText('"Region" needs your attention first:')).toBeInTheDocument();
        expect(within(jumpDialog()).getByText('Region: The region is outside the town.')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Go to Region' }));
        await onStep('Region');
        // On its field too, with the summary.
        expect(screen.getAllByText('The region is outside the town.').length).toBeGreaterThan(0);
    });

    it('a warning never stops the jump and is listed as information', async () => {
        (fieldValidationRuleClient.getByFormConfigurationId as jest.Mock).mockResolvedValue([rule(1, REGION_ID, false)]);
        answerRules({ [REGION_ID]: { isValid: false, isBlocking: false, message: 'The region is small.' } });
        useConfig(buildConfig());
        render(<FormWizard entityName="District" />);
        await typeName('Old Quarter');

        fireEvent.click(stepButton('Step 3: Details'));

        await onStep('Details');
        expect(await screen.findByText('Now on "Details"')).toBeInTheDocument();
        expect(within(jumpDialog()).getByText(/these don't stop you\)/i)).toBeInTheDocument();
        expect(within(jumpDialog()).getByText('Region: Region: The region is small.')).toBeInTheDocument();
    });

    it('a rule that could not run (game server unreachable) is a notice, not a stop', async () => {
        (fieldValidationRuleClient.getByFormConfigurationId as jest.Mock).mockResolvedValue([rule(1, REGION_ID)]);
        answerRules({ [REGION_ID]: {
            isValid: false,
            isBlocking: true,
            message: 'Cannot verify this rule right now: plugin offline',
            metadata: { validationType: 'RegionContainment', executedAt: new Date().toISOString(), failureReason: 'PluginUnreachable' }
        } });
        useConfig(buildConfig());
        render(<FormWizard entityName="District" />);
        await typeName('Old Quarter');

        fireEvent.click(stepButton('Step 3: Details'));

        await onStep('Details');
        expect(await screen.findByText(/game server could not be reached/i)).toBeInTheDocument();
        expect(within(jumpDialog()).getByText(/Cannot verify this rule right now/)).toBeInTheDocument();
    });

    it('checks the Entry conditions of every step it would enter', async () => {
        useConfig(buildConfig({ nameRequired: false, detailsConditions: [nameFromEarlierStep] }));
        render(<FormWizard entityName="District" />);
        await onStep('Basics');

        fireEvent.click(stepButton('Step 3: Details'));

        expect(await screen.findByText('"Region" needs your attention first:')).toBeInTheDocument();
        expect(within(jumpDialog()).getByText(`"Details" can't be opened yet: ${ENTRY_MESSAGE}`)).toBeInTheDocument();
    });

    it('Next: an Entry condition on step 3 ("Name is not empty, from an earlier step") stops Next on step 2', async () => {
        useConfig(buildConfig({ nameRequired: false, detailsConditions: [nameFromEarlierStep] }));
        render(<FormWizard entityName="District" />);
        await onStep('Basics');
        fireEvent.click(screen.getByRole('button', { name: /^next$/i }));
        await onStep('Region');

        fireEvent.click(screen.getByRole('button', { name: /^next$/i }));

        await waitFor(() => expect(toasts).toHaveBeenCalledWith(ENTRY_MESSAGE));
        expect(screen.getByTestId('wizard-condition-error')).toHaveTextContent(ENTRY_MESSAGE);
        expect(screen.getByRole('heading', { level: 2, name: 'Region' })).toBeInTheDocument();

        // With a name it opens.
        fireEvent.click(stepButton('Step 1: Basics'));
        await typeName('Old Quarter');
        fireEvent.click(stepButton('Step 3: Details'));
        await onStep('Details');
        expect(screen.queryByTestId('wizard-condition-error')).not.toBeInTheDocument();
    });

    it('Next: a failed Completion condition is shown above the button as well as in the toast', async () => {
        useConfig(buildConfig({ regionConditions: [mustAllowEntry] }));
        render(<FormWizard entityName="District" />);
        await typeName('Old Quarter');
        fireEvent.click(screen.getByRole('button', { name: /^next$/i }));
        await onStep('Region');

        fireEvent.click(screen.getByRole('button', { name: /^next$/i }));
        await waitFor(() => expect(toasts).toHaveBeenCalledWith(ALLOW_MESSAGE));
        expect(screen.getByTestId('wizard-condition-error')).toHaveTextContent(ALLOW_MESSAGE);

        fireEvent.click(screen.getByRole('checkbox'));
        fireEvent.click(screen.getByRole('button', { name: /^next$/i }));
        await onStep('Details');
        expect(screen.queryByTestId('wizard-condition-error')).not.toBeInTheDocument();
    });

    it('a resumed draft runs the rules of every step once when it has loaded', async () => {
        (fieldValidationRuleClient.getByFormConfigurationId as jest.Mock).mockResolvedValue([rule(1, NAME_ID), rule(2, REGION_ID)]);
        answerRules({ [REGION_ID]: { isValid: false, isBlocking: true, message: 'The region is outside the town.' } });
        (formConfigClient.getById as jest.Mock).mockResolvedValue(buildConfig());
        (formSubmissionClient.getById as jest.Mock).mockResolvedValue({
            id: '55',
            formConfigurationId: '7',
            userId: '1',
            entityTypeName: 'District',
            currentStepIndex: 0,
            currentStepDataJson: JSON.stringify({ Name: 'Old Quarter' }),
            allStepsDataJson: JSON.stringify({ 0: { Name: 'Old Quarter' }, 1: { Region: 'district_3' } }),
            status: 'Paused',
            childProgresses: []
        });

        render(<FormWizard entityName="District" existingProgressId="55" />);
        await onStep('Basics');

        await waitFor(() => expect(fieldValidationRuleClient.validateFields).toHaveBeenCalledTimes(2));
        const calls = (fieldValidationRuleClient.validateFields as jest.Mock).mock.calls.map(c => c[0].fields);
        expect(calls[0]).toEqual([{ fieldId: NAME_ID, fieldValue: 'Old Quarter' }]);
        expect(calls[1]).toEqual([{ fieldId: REGION_ID, fieldValue: 'district_3' }]);
        // The form is not touched: no message on the step on screen, nothing saved.
        expect(screen.queryByText('The region is outside the town.')).not.toBeInTheDocument();
        expect(formSubmissionClient.update).not.toHaveBeenCalled();

        // The step that failed shows what its rule said as soon as it is opened.
        fireEvent.click(stepButton('Step 2: Region'));
        await onStep('Region');
        expect(await screen.findByText('The region is outside the town.')).toBeInTheDocument();
    });

    it('a new, empty form runs no rules when it loads', async () => {
        (fieldValidationRuleClient.getByFormConfigurationId as jest.Mock).mockResolvedValue([rule(1, NAME_ID)]);
        useConfig(buildConfig());
        render(<FormWizard entityName="District" />);
        await onStep('Basics');
        await waitFor(() => expect(fieldValidationRuleClient.getByFormConfigurationId).toHaveBeenCalled());
        expect(fieldValidationRuleClient.validateFields).not.toHaveBeenCalled();
    });
});

// PandiO/knk-workspace#413: the jump dialog's ×, Close and "Go to" kept working only while the save behind
// "Go to" answered quickly: the dialog disables its buttons while its action runs, and "Go to" waited for the
// save. Smoke test: New District, step 1 filled, step 2's Region empty, click step 3.
describe('FormWizard step jump dialog with a slow or failing save (#413)', () => {
    let toasts: jest.SpyInstance;
    let consoleError: jest.SpyInstance;

    beforeEach(() => {
        jest.clearAllMocks();
        toasts = jest.spyOn(logging.errorHandler, 'next').mockImplementation(() => undefined);
        consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
        (fieldValidationRuleClient.getByFormConfigurationId as jest.Mock).mockResolvedValue([]);
        answerRules({});
    });

    afterEach(() => {
        toasts.mockRestore();
        consoleError.mockRestore();
    });

    const never = () => new Promise<never>(() => undefined);

    const openJumpDialog = async () => {
        fireEvent.click(stepButton('Step 3: Details'));
        expect(await screen.findByText('"Region" needs your attention first:')).toBeInTheDocument();
        return screen.getByRole('alertdialog');
    };

    const startOnBasics = async () => {
        useConfig(buildConfig({ regionRequired: true }));
        render(<FormWizard entityName="District" />);
        await typeName('Old Quarter');
    };

    it.each([
        ['the ×', 'Close dialog'],
        ['Close', 'Close']
    ])('%s closes the dialog, and it opens again on the next click', async (_label, buttonName) => {
        (formSubmissionClient.create as jest.Mock).mockImplementation(never);
        await startOnBasics();

        let dialog = await openJumpDialog();
        expect(within(dialog).getByRole('button', { name: buttonName })).toBeEnabled();
        fireEvent.click(within(dialog).getByRole('button', { name: buttonName }));
        await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
        expect(screen.getByRole('heading', { level: 2, name: 'Basics' })).toBeInTheDocument();

        dialog = await openJumpDialog();
        expect(within(dialog).getByRole('button', { name: 'Go to Region' })).toBeEnabled();
    });

    it.each([
        ['never answers', () => never()],
        ['fails', () => Promise.reject(new Error('API down'))],
        ['answers slowly', () => new Promise(resolve => setTimeout(() => resolve({ id: '55' }), 50))]
    ])('Go to lands on the step with its issue shown when the save %s', async (_label, save) => {
        (formSubmissionClient.create as jest.Mock).mockImplementation(save);
        await startOnBasics();

        const dialog = await openJumpDialog();
        fireEvent.click(within(dialog).getByRole('button', { name: 'Go to Region' }));

        await onStep('Region');
        await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
        // The field that stopped the jump is marked, with the summary.
        expect(screen.getAllByText('Region is required').length).toBeGreaterThan(0);
        expect(screen.getByText('Fix this field to continue')).toBeInTheDocument();
        expect(formSubmissionClient.create).toHaveBeenCalledTimes(1);
    });

    it('a failed save behind Go to says so in the banner, and the next Next saves again', async () => {
        (formSubmissionClient.create as jest.Mock).mockRejectedValueOnce(new Error('API down'));
        await startOnBasics();

        const dialog = await openJumpDialog();
        fireEvent.click(within(dialog).getByRole('button', { name: 'Go to Region' }));
        await onStep('Region');
        expect(await screen.findByText('Failed to save your progress. Please try again.')).toBeInTheDocument();

        (formSubmissionClient.create as jest.Mock).mockImplementation(async (dto: Record<string, unknown>) => ({ ...dto, id: '55' }));
        fireEvent.change(screen.getByLabelText(/^region/i), { target: { value: 'district_3' } });
        fireEvent.click(screen.getByRole('button', { name: /^next$/i }));
        await onStep('Details');
        expect(formSubmissionClient.create).toHaveBeenCalledTimes(2);
    });
});

// PandiO/knk-workspace#414: a failed step condition marks the fields it reads, in red with its message, like a
// field rule does; the mark goes away as soon as the condition holds.
describe('FormWizard: a failed step condition marks its fields (#414)', () => {
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

    const MESSAGE = 'Pick a region or allow entry.';
    const completion = (rows: object[], logic: 'AND' | 'OR' = 'AND'): StepConditionDto => ({
        id: '20',
        conditionType: 'Completion',
        conditionJson: JSON.stringify({ conditions: rows, logic }),
        errorMessage: MESSAGE,
        isActive: true
    });
    const regionSet = { fieldName: 'Region', operator: ConditionOperator.IsNotEmpty };
    const entryAllowed = { fieldName: 'AllowEntry', operator: ConditionOperator.Equals, value: true };

    const box = (fieldName: string) => document.getElementById(`wizard-field-${fieldName}`)!;
    const expectMarked = (fieldName: string, message: string) => {
        expect(within(box(fieldName)).getByText(message)).toBeInTheDocument();
        expect(box(fieldName)).toHaveClass('border-danger-line');
    };
    const expectNotMarked = (fieldName: string, message: string) => {
        expect(within(box(fieldName)).queryByText(message)).not.toBeInTheDocument();
        expect(box(fieldName)).not.toHaveClass('border-danger-line');
    };
    const next = () => fireEvent.click(screen.getByRole('button', { name: /^next$/i }));

    const openRegionStep = async (conditions: StepConditionDto[]) => {
        useConfig(buildConfig({ regionConditions: conditions }));
        render(<FormWizard entityName="District" />);
        await typeName('Old Quarter');
        next();
        await onStep('Region');
    };

    it('one rule: Next marks its field, and the mark goes when the condition holds', async () => {
        await openRegionStep([mustAllowEntry]);
        expectNotMarked('AllowEntry', ALLOW_MESSAGE);

        next();

        await waitFor(() => expectMarked('AllowEntry', ALLOW_MESSAGE));
        expectNotMarked('Region', ALLOW_MESSAGE);
        // The step-level message stays above the button as before.
        expect(screen.getByTestId('wizard-condition-error')).toHaveTextContent(ALLOW_MESSAGE);

        fireEvent.click(screen.getByRole('checkbox'));
        expectNotMarked('AllowEntry', ALLOW_MESSAGE);
    });

    it('all rules (AND): only the rules that fail mark their field', async () => {
        await openRegionStep([completion([regionSet, entryAllowed], 'AND')]);
        fireEvent.click(screen.getByRole('checkbox'));

        next();

        await waitFor(() => expectMarked('Region', MESSAGE));
        expectNotMarked('AllowEntry', MESSAGE);

        fireEvent.change(screen.getByLabelText(/^region/i), { target: { value: 'district_3' } });
        expectNotMarked('Region', MESSAGE);
    });

    it('any rule (OR): every field is marked, and both marks go when one rule holds', async () => {
        await openRegionStep([completion([regionSet, entryAllowed], 'OR')]);

        next();

        await waitFor(() => expectMarked('Region', MESSAGE));
        expectMarked('AllowEntry', MESSAGE);

        fireEvent.click(screen.getByRole('checkbox'));
        expectNotMarked('Region', MESSAGE);
        expectNotMarked('AllowEntry', MESSAGE);
    });

    it('an Entry condition of the next step marks the field of this step it reads', async () => {
        const regionFromEarlierStep: StepConditionDto = {
            id: '21',
            conditionType: 'Entry',
            conditionJson: JSON.stringify({ conditions: [{ ...regionSet, fromPreviousStep: true }], logic: 'AND' }),
            errorMessage: 'Pick the region first.',
            isActive: true
        };
        useConfig(buildConfig({ detailsConditions: [regionFromEarlierStep] }));
        render(<FormWizard entityName="District" />);
        await typeName('Old Quarter');
        next();
        await onStep('Region');

        next();

        await waitFor(() => expectMarked('Region', 'Pick the region first.'));
        fireEvent.change(screen.getByLabelText(/^region/i), { target: { value: 'district_3' } });
        expectNotMarked('Region', 'Pick the region first.');
    });

    it('a jump stopped by a condition: Go to lands with the field marked', async () => {
        useConfig(buildConfig({ regionConditions: [mustAllowEntry] }));
        render(<FormWizard entityName="District" />);
        await typeName('Old Quarter');

        fireEvent.click(stepButton('Step 3: Details'));
        fireEvent.click(await screen.findByRole('button', { name: 'Go to Region' }));

        await onStep('Region');
        expectMarked('AllowEntry', ALLOW_MESSAGE);
        fireEvent.click(screen.getByRole('checkbox'));
        expectNotMarked('AllowEntry', ALLOW_MESSAGE);
    });

    it('a jump stopped on the current step marks the field there; going back clears the marks', async () => {
        await openRegionStep([mustAllowEntry]);

        fireEvent.click(stepButton('Step 3: Details'));

        expect(await screen.findByText('Finish "Region" first:')).toBeInTheDocument();
        expectMarked('AllowEntry', ALLOW_MESSAGE);
        fireEvent.click(screen.getByRole('button', { name: 'Close' }));

        fireEvent.click(stepButton('Step 1: Basics'));
        await onStep('Basics');
        fireEvent.click(stepButton('Step 2: Region'));
        await onStep('Region');
        expectNotMarked('AllowEntry', ALLOW_MESSAGE);
    });
});
