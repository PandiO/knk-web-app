import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FormWizard } from '../FormWizard';
import { formConfigClient } from '../../../apiClients/formConfigClient';
import { formSubmissionClient } from '../../../apiClients/formSubmissionClient';
import { fieldValidationRuleClient } from '../../../apiClients/fieldValidationRuleClient';
import { worldTaskClient } from '../../../apiClients/worldTaskClient';
import { FormConfigurationDto, FormFieldDto, FormStepDto } from '../../../types/dtos/forms/FormModels';
import { FieldType, FormSubmissionStatus } from '../../../utils/enums';

/**
 * PandiO/knk-workspace#180 (DESIGN §8.7, decisions Q19/Q18): the first world task of a form saves the draft silently and
 * is created for that draft; a resumed draft reattaches its fields' tasks and applies a result that completed while the
 * form was closed; leaving the form cancels its open tasks.
 */

jest.mock('../../../apiClients/formConfigClient', () => ({
    formConfigClient: { getByEntityTypeName: jest.fn(), getById: jest.fn() }
}));
jest.mock('../../../apiClients/metadataClient', () => ({
    metadataClient: {
        getEntityMetadata: jest.fn().mockResolvedValue({ entityName: 'Town', displayName: 'Town', fields: [] })
    }
}));
jest.mock('../../../apiClients/formSubmissionClient', () => ({
    formSubmissionClient: { getById: jest.fn(), create: jest.fn(), update: jest.fn(), getWorldTasks: jest.fn() }
}));
jest.mock('../../../apiClients/fieldValidationRuleClient', () => ({
    fieldValidationRuleClient: { getByFormConfigurationId: jest.fn(), validateField: jest.fn(), resolvePlaceholders: jest.fn() }
}));
jest.mock('../../../apiClients/worldTaskClient', () => ({
    worldTaskClient: { create: jest.fn(), getById: jest.fn(), cancel: jest.fn(), markApplied: jest.fn() }
}));
jest.mock('../../../apiClients/workflowClient', () => ({
    workflowClient: { getProgress: jest.fn().mockResolvedValue([]), completeStep: jest.fn() }
}));
jest.mock('../../../hooks/useEnrichedFormContext', () => ({
    useEnrichedFormContext: () => ({
        values: {}, fieldMetadata: new Map(), entityMetadata: new Map(), resolvedDependencies: new Map(),
        isLoading: false, error: null
    })
}));
jest.mock('../../../utils/entityApiMapping', () => ({
    getFetchByIdFunctionForEntity: jest.fn(),
    getCreateFunctionForEntity: jest.fn(),
    getUpdateFunctionForEntity: jest.fn()
}));

const field = (fieldName: string, overrides: Partial<FormFieldDto> = {}): FormFieldDto => ({
    id: `${fieldName.length}`,
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

const step = (fields: FormFieldDto[]): FormStepDto => ({
    id: '0',
    stepName: 'General',
    description: '',
    order: 0,
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
    steps: [step([
        field('Name'),
        field('WgRegionId', { settingsJson: JSON.stringify({ worldTask: { enabled: true, taskType: 'WgRegionId' } }) }),
    ])]
};

const pendingTask = { id: 41, workflowSessionId: 7, fieldName: 'WgRegionId', taskType: 'WgRegionId', status: 'Pending', linkCode: 'AB12CD', createdAt: '' };

describe('FormWizard: world tasks anchored to the draft (#180)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (formConfigClient.getByEntityTypeName as jest.Mock).mockResolvedValue(config);
        (formConfigClient.getById as jest.Mock).mockResolvedValue(config);
        (fieldValidationRuleClient.getByFormConfigurationId as jest.Mock).mockResolvedValue([]);
        (formSubmissionClient.create as jest.Mock).mockImplementation(async (dto: Record<string, unknown>) => ({ ...dto, id: '55' }));
        (formSubmissionClient.update as jest.Mock).mockImplementation(async (dto: Record<string, unknown>) => dto);
        (formSubmissionClient.getWorldTasks as jest.Mock).mockResolvedValue([]);
        (worldTaskClient.create as jest.Mock).mockResolvedValue(pendingTask);
        (worldTaskClient.getById as jest.Mock).mockResolvedValue(pendingTask);
        (worldTaskClient.cancel as jest.Mock).mockResolvedValue({ ...pendingTask, status: 'Cancelled' });
        (worldTaskClient.markApplied as jest.Mock).mockImplementation(async (id: number) => ({ id, fieldName: 'WgRegionId', status: 'Completed', appliedAt: 'now' }));
    });

    it('saves the draft silently before the first task and creates the task for it; leaving cancels the open task', async () => {
        const { unmount } = render(<FormWizard entityName="town" workflowSessionId={7} />);

        fireEvent.click(await screen.findByRole('button', { name: /Send to Minecraft/i }));

        await waitFor(() => expect(worldTaskClient.create).toHaveBeenCalled());
        expect(formSubmissionClient.create).toHaveBeenCalledTimes(1);
        expect(formSubmissionClient.create).toHaveBeenCalledWith(expect.objectContaining({
            status: FormSubmissionStatus.InProgress, workflowSessionId: 7
        }));
        expect(worldTaskClient.create).toHaveBeenCalledWith(expect.objectContaining({
            workflowSessionId: 7, formSubmissionProgressId: 55, fieldName: 'WgRegionId'
        }));
        expect(await screen.findByText('/knk task AB12CD')).toBeInTheDocument();

        unmount();

        await waitFor(() => expect(worldTaskClient.cancel).toHaveBeenCalledWith(41, expect.objectContaining({ reason: expect.any(String) })));
    });

    it('a resumed draft fills a field whose task completed while the form was closed, saves the draft and marks it applied', async () => {
        (formSubmissionClient.getById as jest.Mock).mockResolvedValue({
            id: '40', formConfigurationId: '7', entityTypeName: 'Town', currentStepIndex: 0,
            currentStepDataJson: '{}', allStepsDataJson: '{}', status: FormSubmissionStatus.Paused, workflowSessionId: 7
        });
        (formSubmissionClient.getWorldTasks as jest.Mock).mockResolvedValue([{
            ...pendingTask, status: 'Completed', outputJson: JSON.stringify({ regionId: 'tempregion_worldtask_41' })
        }]);

        render(<FormWizard entityName="town" existingProgressId="40" workflowSessionId={7} />);

        expect(await screen.findByText(/Task completed!/)).toBeInTheDocument();
        expect(screen.getByDisplayValue('tempregion_worldtask_41')).toBeInTheDocument();
        await waitFor(() => expect(worldTaskClient.markApplied).toHaveBeenCalledWith(41));
        const savedBeforeApplied = (formSubmissionClient.update as jest.Mock).mock.calls.map(call => call[0]);
        expect(savedBeforeApplied.some(dto => String(dto.allStepsDataJson).includes('tempregion_worldtask_41'))).toBe(true);
        expect(formSubmissionClient.create).not.toHaveBeenCalled();
    });
});
