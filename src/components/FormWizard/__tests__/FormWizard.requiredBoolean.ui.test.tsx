import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FormWizard } from '../FormWizard';
import { formConfigClient } from '../../../apiClients/formConfigClient';
import { formSubmissionClient } from '../../../apiClients/formSubmissionClient';
import { fieldValidationRuleClient } from '../../../apiClients/fieldValidationRuleClient';
import { getFetchByIdFunctionForEntity } from '../../../utils/entityApiMapping';
import { FormConfigurationDto, FormFieldDto, FormStepDto } from '../../../types/dtos/forms/FormModels';
import { ConditionOperator, DisplayConditionLogic, DisplayConditionTargetType, FieldType } from '../../../utils/enums';

// KNG-53: a required Boolean the admin never touches is a present `false`, so it must not block
// Next and must reach the saved progress and the submitted payload as `false` - on every path
// that seeds step data, not only on a fresh create form.

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

const KIND_GUID = 'guid-kind';
const PREMIUM_GUID = 'guid-premium';

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

// Required Boolean with no authored default, the shape FieldEditor produces for a non-nullable bool.
const premiumField = (overrides: Partial<FormFieldDto> = {}) =>
    field(PREMIUM_GUID, 'IsPremiumTier', {
        label: 'Premium tier',
        fieldType: FieldType.Boolean,
        isRequired: true,
        defaultValue: undefined,
        ...overrides
    });

const buildConfig = (premium: FormFieldDto = premiumField()): FormConfigurationDto => ({
    id: '7',
    entityTypeName: 'PermissionGroup',
    configurationName: 'Permission group',
    description: '',
    isDefault: true,
    isActive: true,
    steps: [
        step('0', 'General', [field(KIND_GUID, 'Kind', { label: 'Kind', order: 0 }), { ...premium, order: 1 }]),
        step('1', 'Details', [field('guid-notes', 'Notes', { label: 'Notes' })])
    ]
});

// Premium tier only shows once Kind is "paid".
const conditionalPremium = () => premiumField({
    displayConditionGroups: [{
        targetType: DisplayConditionTargetType.FormField,
        innerLogic: DisplayConditionLogic.And,
        combineWithPreviousLogic: DisplayConditionLogic.Or,
        order: 0,
        isActive: true,
        conditions: [{
            sourceFieldGuid: KIND_GUID,
            operator: ConditionOperator.Equals,
            valueJson: '"paid"',
            order: 0
        }]
    }]
});

const lastSavedSteps = (): Record<string, Record<string, unknown>> => {
    const create = formSubmissionClient.create as jest.Mock;
    const update = formSubmissionClient.update as jest.Mock;
    const calls = [...create.mock.calls, ...update.mock.calls];
    expect(calls.length).toBeGreaterThan(0);
    return JSON.parse(calls[calls.length - 1][0].allStepsDataJson);
};

const clickNext = () => fireEvent.click(screen.getByRole('button', { name: /^next$/i }));
const clickSubmit = () => fireEvent.click(screen.getByRole('button', { name: /^submit$/i }));

const expectAdvancedToDetails = async () => {
    await waitFor(() => expect(screen.getByRole('button', { name: /^submit$/i })).toBeInTheDocument());
    expect(screen.queryByText(/premium tier is required/i)).not.toBeInTheDocument();
};

describe('FormWizard required Boolean left untouched (KNG-53)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (fieldValidationRuleClient.getByFormConfigurationId as jest.Mock).mockResolvedValue([]);
        (formSubmissionClient.create as jest.Mock).mockImplementation(async (dto: Record<string, unknown>) => ({ ...dto, id: '55' }));
        (formSubmissionClient.update as jest.Mock).mockImplementation(async (dto: Record<string, unknown>) => dto);
    });

    it('new form: Next passes and false is saved and submitted', async () => {
        (formConfigClient.getByEntityTypeName as jest.Mock).mockResolvedValue(buildConfig());
        const onComplete = jest.fn();

        render(<FormWizard entityName="PermissionGroup" userId="1" onComplete={onComplete} />);
        await screen.findByRole('checkbox');
        expect(screen.getByRole('checkbox')).not.toBeChecked();

        clickNext();
        await expectAdvancedToDetails();
        expect(lastSavedSteps()['0'].IsPremiumTier).toBe(false);

        clickSubmit();
        await waitFor(() => expect(onComplete).toHaveBeenCalled());
        expect(onComplete.mock.calls[0][0].IsPremiumTier).toBe(false);
    });

    it('checked: Next passes and true is submitted', async () => {
        (formConfigClient.getByEntityTypeName as jest.Mock).mockResolvedValue(buildConfig());
        const onComplete = jest.fn();

        render(<FormWizard entityName="PermissionGroup" userId="1" onComplete={onComplete} />);
        fireEvent.click(await screen.findByRole('checkbox'));

        clickNext();
        await expectAdvancedToDetails();
        clickSubmit();
        await waitFor(() => expect(onComplete).toHaveBeenCalled());
        expect(onComplete.mock.calls[0][0].IsPremiumTier).toBe(true);
    });

    it('resumed submission saved with null (before the KNG-26 fix): Next passes and false is saved', async () => {
        const config = buildConfig();
        (formConfigClient.getById as jest.Mock).mockResolvedValue(config);
        (formSubmissionClient.getById as jest.Mock).mockResolvedValue({
            id: '55',
            formConfigurationId: '7',
            userId: '1',
            entityTypeName: 'PermissionGroup',
            currentStepIndex: 0,
            currentStepDataJson: JSON.stringify({ Kind: 'free', IsPremiumTier: null }),
            allStepsDataJson: JSON.stringify({ 0: { Kind: 'free', IsPremiumTier: null } }),
            status: 'Paused',
            childProgresses: []
        });

        render(<FormWizard entityName="PermissionGroup" userId="1" existingProgressId="55" />);
        await screen.findByRole('checkbox');

        clickNext();
        await expectAdvancedToDetails();
        expect(lastSavedSteps()['0'].IsPremiumTier).toBe(false);
    });

    it('edit form whose entity has no value for the Boolean: Next passes and false is saved', async () => {
        (formConfigClient.getByEntityTypeName as jest.Mock).mockResolvedValue(buildConfig());
        (getFetchByIdFunctionForEntity as jest.Mock).mockReturnValue(async () => ({ id: 3, Kind: 'free', IsPremiumTier: null }));
        const onComplete = jest.fn();

        render(<FormWizard entityName="PermissionGroup" entityId="3" userId="1" onComplete={onComplete} />);
        await screen.findByRole('checkbox');

        clickNext();
        await expectAdvancedToDetails();
        expect(lastSavedSteps()['0'].IsPremiumTier).toBe(false);

        clickSubmit();
        await waitFor(() => expect(onComplete).toHaveBeenCalled());
        expect(onComplete.mock.calls[0][0].IsPremiumTier).toBe(false);
    });

    it('edit form preserves an explicit false from the entity', async () => {
        (formConfigClient.getByEntityTypeName as jest.Mock).mockResolvedValue(buildConfig(premiumField({ defaultValue: 'true' })));
        (getFetchByIdFunctionForEntity as jest.Mock).mockReturnValue(async () => ({ id: 3, Kind: 'free', isPremiumTier: false }));

        render(<FormWizard entityName="PermissionGroup" entityId="3" userId="1" />);
        expect(await screen.findByRole('checkbox')).not.toBeChecked();

        clickNext();
        await expectAdvancedToDetails();
        expect(lastSavedSteps()['0'].IsPremiumTier).toBe(false);
    });

    it('child/join form opened with prefilled values: Next passes and false is saved', async () => {
        (formConfigClient.getByEntityTypeName as jest.Mock).mockResolvedValue(buildConfig());

        render(
            <FormWizard
                entityName="PermissionGroup"
                userId="1"
                parentProgressId="12"
                initialFieldValues={{ Kind: 'free', IsPremiumTier: null }}
            />
        );
        await screen.findByRole('checkbox');

        clickNext();
        await expectAdvancedToDetails();
        expect(lastSavedSteps()['0'].IsPremiumTier).toBe(false);
    });

    it('child/join form keeps a prefilled false over a "true" default', async () => {
        (formConfigClient.getByEntityTypeName as jest.Mock).mockResolvedValue(buildConfig(premiumField({ defaultValue: 'true' })));

        render(
            <FormWizard
                entityName="PermissionGroup"
                userId="1"
                parentProgressId="12"
                initialFieldValues={{ Kind: 'free', IsPremiumTier: false }}
            />
        );
        expect(await screen.findByRole('checkbox')).not.toBeChecked();

        clickNext();
        await expectAdvancedToDetails();
        expect(lastSavedSteps()['0'].IsPremiumTier).toBe(false);
    });

    it('child/join form takes a prefilled true over the seeded false', async () => {
        (formConfigClient.getByEntityTypeName as jest.Mock).mockResolvedValue(buildConfig());

        render(
            <FormWizard
                entityName="PermissionGroup"
                userId="1"
                parentProgressId="12"
                initialFieldValues={{ Kind: 'free', IsPremiumTier: true }}
            />
        );
        expect(await screen.findByRole('checkbox')).toBeChecked();
    });

    it('field that becomes visible conditionally: Next passes and false is saved', async () => {
        (formConfigClient.getByEntityTypeName as jest.Mock).mockResolvedValue(buildConfig(conditionalPremium()));

        render(<FormWizard entityName="PermissionGroup" userId="1" />);
        const kind = await screen.findByRole('textbox');
        expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();

        fireEvent.change(kind, { target: { value: 'paid' } });
        expect(await screen.findByRole('checkbox')).not.toBeChecked();

        clickNext();
        await expectAdvancedToDetails();
        expect(lastSavedSteps()['0'].IsPremiumTier).toBe(false);
    });

    it('hide/show does not turn an unchecked Boolean back into a missing value', async () => {
        (formConfigClient.getByEntityTypeName as jest.Mock).mockResolvedValue(buildConfig(conditionalPremium()));

        render(<FormWizard entityName="PermissionGroup" userId="1" />);
        const kind = await screen.findByRole('textbox');

        fireEvent.change(kind, { target: { value: 'paid' } });
        await screen.findByRole('checkbox');
        fireEvent.change(kind, { target: { value: 'free' } });
        await waitFor(() => expect(screen.queryByRole('checkbox')).not.toBeInTheDocument());
        fireEvent.change(kind, { target: { value: 'paid' } });
        expect(await screen.findByRole('checkbox')).not.toBeChecked();

        clickNext();
        await expectAdvancedToDetails();
        expect(lastSavedSteps()['0'].IsPremiumTier).toBe(false);
    });

    it('returning to the previous step keeps the explicit false', async () => {
        (formConfigClient.getByEntityTypeName as jest.Mock).mockResolvedValue(buildConfig());

        render(<FormWizard entityName="PermissionGroup" userId="1" />);
        await screen.findByRole('checkbox');

        clickNext();
        await expectAdvancedToDetails();
        fireEvent.click(screen.getByRole('button', { name: /previous/i }));
        expect(await screen.findByRole('checkbox')).not.toBeChecked();

        clickNext();
        await expectAdvancedToDetails();
        expect(lastSavedSteps()['0'].IsPremiumTier).toBe(false);
    });
});
