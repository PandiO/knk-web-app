import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FormWizard } from '../FormWizard';
import { formConfigClient } from '../../../apiClients/formConfigClient';
import { workflowClient } from '../../../apiClients/workflowClient';
import { formSubmissionClient } from '../../../apiClients/formSubmissionClient';
import { fieldValidationRuleClient } from '../../../apiClients/fieldValidationRuleClient';
import { metadataClient } from '../../../apiClients/metadataClient';
import { displayConfigClient } from '../../../apiClients/displayConfigClient';
import {
    getCreateFunctionForEntity,
    getFetchByIdFunctionForEntity,
    getUpdateFunctionForEntity
} from '../../../utils/entityApiMapping';

/**
 * KNG-130: renaming a Town's Location in the child form handed the Town form a Location whose id
 * was the nested wizard's entityId string ("83"). The API's LocationDto could not read it, so the
 * Town's Location boundary check failed ("outside the boundaries") and blocked the Town form.
 */

jest.mock('../../../apiClients/formConfigClient', () => ({
    formConfigClient: { getByEntityTypeName: jest.fn(), getById: jest.fn() }
}));
jest.mock('../../../apiClients/workflowClient', () => ({
    workflowClient: { createSession: jest.fn(), getProgress: jest.fn(), completeStep: jest.fn() }
}));
jest.mock('../../../apiClients/metadataClient', () => ({
    metadataClient: {
        getEntityMetadata: jest.fn().mockResolvedValue({ entityName: '', displayName: '', fields: [] }),
        getAllEntityMetadata: jest.fn().mockResolvedValue([])
    }
}));
jest.mock('../../../apiClients/formSubmissionClient', () => ({
    formSubmissionClient: {
        getById: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        getByEntityTypeNameFiltered: jest.fn()
    }
}));
jest.mock('../../../apiClients/fieldValidationRuleClient', () => ({
    fieldValidationRuleClient: {
        getByFormConfigurationId: jest.fn(),
        validateField: jest.fn(),
        validateFields: jest.fn(),
        resolvePlaceholders: jest.fn(),
        resolveDependencies: jest.fn()
    }
}));
jest.mock('../../../apiClients/displayConfigClient', () => ({
    displayConfigClient: { getDefaultByEntityType: jest.fn().mockRejectedValue(new Error('none')) }
}));
jest.mock('../../../apiClients/worldTaskClient', () => ({
    worldTaskClient: { create: jest.fn(), getById: jest.fn(), getBySession: jest.fn() }
}));
jest.mock('../../../hooks/useEntityMetadata', () => ({
    useEntityMetadata: () => ({ baseMetadata: [], allMergedMetadata: [], configurations: [] })
}));
jest.mock('../../../utils/entityApiMapping', () => ({
    getFetchByIdFunctionForEntity: jest.fn(),
    getCreateFunctionForEntity: jest.fn(),
    getUpdateFunctionForEntity: jest.fn(),
    getSearchFunctionForEntity: jest.fn(),
    getDeleteFunctionForEntity: jest.fn()
}));

const field = (overrides: Record<string, unknown>) => ({
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

const config = (id: string, entityTypeName: string, fields: Record<string, unknown>[]) => ({
    id,
    entityTypeName,
    configurationName: `${entityTypeName} - Default`,
    description: '',
    isDefault: true,
    steps: [{
        id: `${id}0`,
        stepName: 'Main',
        description: '',
        order: 0,
        isReusable: false,
        isLinkedToSource: false,
        hasCompatibilityIssues: false,
        isManyToManyRelationship: false,
        childFormSteps: [],
        conditions: [],
        fields: fields.map((f, i) => field({ id: `${id}${i + 1}`, order: i, ...f }))
    }]
});

const CONFIGS: Record<string, unknown> = {
    town: config('10', 'Town', [
        { fieldName: 'WgRegionId', label: 'Region', fieldType: 'String' },
        { fieldName: 'Location', label: 'Location', fieldType: 'Object', objectType: 'Location' }
    ]),
    location: config('20', 'Location', [
        { fieldName: 'Name', label: 'Location name', fieldType: 'String' },
        { fieldName: 'X', label: 'X', fieldType: 'Decimal' },
        { fieldName: 'Y', label: 'Y', fieldType: 'Decimal' },
        { fieldName: 'Z', label: 'Z', fieldType: 'Decimal' },
        { fieldName: 'World', label: 'World', fieldType: 'String' }
    ])
};

const LOCATION = { id: 83, name: 'Kardenna spawn', x: 120.5, y: 64, z: -30, yaw: 0, pitch: 0, world: 'world' };
const ENTITIES: Record<string, Record<string, unknown>> = {
    town: { id: 19, name: 'Kardenna', wgRegionId: 'town_kardenna', locationId: 83, location: LOCATION },
    location: LOCATION
};

describe('Town form: editing its Location in the child form (KNG-130)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (metadataClient.getEntityMetadata as jest.Mock).mockResolvedValue({ entityName: '', displayName: '', fields: [] });
        (metadataClient.getAllEntityMetadata as jest.Mock).mockResolvedValue([]);
        (displayConfigClient.getDefaultByEntityType as jest.Mock).mockRejectedValue(new Error('none'));
        // The Town's Location field (102) must be inside the region of its WgRegionId field (101).
        (fieldValidationRuleClient.getByFormConfigurationId as jest.Mock).mockImplementation(async (configId: number) =>
            configId === 10
                ? [{
                    id: 18, formFieldId: 102, validationType: 'LocationInsideRegion', dependsOnFieldId: 101,
                    dependsOnField: { id: 101, fieldName: 'WgRegionId', label: 'Region' },
                    configJson: '{"regionPropertyPath":"WgRegionId"}', errorMessage: 'outside', isBlocking: true,
                    requiresDependencyFilled: true
                }]
                : []);
        (fieldValidationRuleClient.validateField as jest.Mock).mockResolvedValue({ isValid: true, isBlocking: true, message: 'ok' });
        (fieldValidationRuleClient.validateFields as jest.Mock).mockImplementation(async (request: { fields: Array<{ fieldId: number; fieldValue: unknown }>; formContextData?: Record<string, unknown> }) => {
            const results: Record<string, unknown> = {};
            for (const item of request.fields) {
                results[String(item.fieldId)] = await fieldValidationRuleClient.validateField({ ...item, formContextData: request.formContextData });
            }
            return { results };
        });
        (formSubmissionClient.getByEntityTypeNameFiltered as jest.Mock).mockResolvedValue([]);
        (formSubmissionClient.create as jest.Mock).mockImplementation(async (p: Record<string, unknown>) => ({ ...p, id: 'progress-1' }));
        (formSubmissionClient.update as jest.Mock).mockImplementation(async (p: Record<string, unknown>) => p);
        (formConfigClient.getByEntityTypeName as jest.Mock).mockImplementation(async (name: string) => CONFIGS[name.toLowerCase()]);
        (workflowClient.getProgress as jest.Mock).mockResolvedValue([]);
        (workflowClient.createSession as jest.Mock).mockResolvedValue({ id: 700 });
        (getFetchByIdFunctionForEntity as jest.Mock).mockImplementation((type: string) => async () => ENTITIES[type.toLowerCase()]);
        (getCreateFunctionForEntity as jest.Mock).mockImplementation(() => jest.fn());
        (getUpdateFunctionForEntity as jest.Mock).mockImplementation(() => jest.fn());
    });

    it('keeps the Location id a number, so the boundary check and the Town save can read it', async () => {
        render(<FormWizard entityName="town" entityId="19" userId="1" onComplete={() => {}} />);

        const editButtons = await screen.findAllByRole('button', { name: /edit instance/i });
        fireEvent.click(editButtons[0]);

        // Only the child Location form has an input holding the Location's name.
        const nameInput = await screen.findByDisplayValue('Kardenna spawn');
        fireEvent.change(nameInput, { target: { value: 'Kardenna gate' } });
        // The modal renders after the Town form, so its Submit is the last one.
        const submitButtons = screen.getAllByRole('button', { name: /submit/i });
        fireEvent.click(submitButtons[submitButtons.length - 1]);

        await waitFor(() => expect(screen.queryByText('Edit Location')).not.toBeInTheDocument());

        // The Town's Location rule re-runs on the edited value; its id is the number the API can read.
        await waitFor(() => expect(fieldValidationRuleClient.validateField).toHaveBeenCalledWith(expect.objectContaining({
            fieldId: 102,
            fieldValue: expect.objectContaining({ id: 83, Name: 'Kardenna gate' })
        })));
        const locationCalls = (fieldValidationRuleClient.validateField as jest.Mock).mock.calls
            .map(([request]) => request)
            .filter(request => request.fieldId === 102);
        locationCalls.forEach(request => expect(typeof request.fieldValue.id).toBe('number'));
    });
});
