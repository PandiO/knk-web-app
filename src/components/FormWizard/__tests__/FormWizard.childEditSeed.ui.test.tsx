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

import { worldTaskClient } from '../../../apiClients/worldTaskClient';

/**
 * KNG-134: "Edit instance" seeds the child form from the value the parent holds - a Location
 * captured in Minecraft (no id), and a saved Location edited earlier in the same session - and a
 * world task inherited by a child Location form fills its fields instead of its first field.
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
jest.mock('../../../hooks/useEnrichedFormContext', () => ({
    useEnrichedFormContext: () => ({
        values: {},
        fieldMetadata: new Map(),
        entityMetadata: new Map(),
        resolvedDependencies: new Map(),
        isLoading: false,
        error: null
    })
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


const CAPTURED = { name: 'Gate spawn', x: 10.5, y: 64, z: -3, yaw: 90, pitch: 0, World: 'world' };

const submitChildForm = () => {
    // The modal renders after the parent form, so its Submit is the last one.
    const submitButtons = screen.getAllByRole('button', { name: /submit/i });
    fireEvent.click(submitButtons[submitButtons.length - 1]);
};

describe('Edit instance seeds the child form from what the parent holds (KNG-134)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (metadataClient.getEntityMetadata as jest.Mock).mockResolvedValue({ entityName: '', displayName: '', fields: [] });
        (metadataClient.getAllEntityMetadata as jest.Mock).mockResolvedValue([]);
        (displayConfigClient.getDefaultByEntityType as jest.Mock).mockRejectedValue(new Error('none'));
        (fieldValidationRuleClient.getByFormConfigurationId as jest.Mock).mockResolvedValue([]);
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

    it('opens a captured Location (no id) as "Edit Location" with its values, and keeps the edit', async () => {
        render(<FormWizard entityName="town" userId="1" initialFieldValues={{ Location: CAPTURED }} onComplete={() => {}} />);

        fireEvent.click((await screen.findAllByRole('button', { name: /edit instance/i }))[0]);

        expect(await screen.findByText('Edit Location')).toBeInTheDocument();
        const nameInput = await screen.findByDisplayValue('Gate spawn');
        expect(screen.getByDisplayValue('10.5')).toBeInTheDocument();
        expect(screen.getByDisplayValue('-3')).toBeInTheDocument();
        expect(screen.getByDisplayValue('world')).toBeInTheDocument();

        fireEvent.change(nameInput, { target: { value: 'Gate square' } });
        submitChildForm();
        await waitFor(() => expect(screen.queryByText('Edit Location')).not.toBeInTheDocument());

        // An embedded Location is not saved on its own; it rides along with the Town.
        expect(getCreateFunctionForEntity).not.toHaveBeenCalledWith('Location');

        // Edit it again: the first edit is there, the coordinates too.
        fireEvent.click((await screen.findAllByRole('button', { name: /edit instance/i }))[0]);
        expect(await screen.findByDisplayValue('Gate square')).toBeInTheDocument();
        expect(screen.getByDisplayValue('10.5')).toBeInTheDocument();
    });

    it('shows the first edit of a saved Location when it is edited a second time, and keeps its id', async () => {
        render(<FormWizard entityName="town" entityId="19" userId="1" onComplete={() => {}} />);

        fireEvent.click((await screen.findAllByRole('button', { name: /edit instance/i }))[0]);
        fireEvent.change(await screen.findByDisplayValue('Kardenna spawn'), { target: { value: 'Kardenna gate' } });
        fireEvent.change(screen.getByDisplayValue('120.5'), { target: { value: '125' } });
        submitChildForm();
        await waitFor(() => expect(screen.queryByText('Edit Location')).not.toBeInTheDocument());

        fireEvent.click((await screen.findAllByRole('button', { name: /edit instance/i }))[0]);
        expect(await screen.findByText('Edit Location')).toBeInTheDocument();
        // The database still says "Kardenna spawn" / 120.5; the form shows what the Town holds.
        expect(await screen.findByDisplayValue('Kardenna gate')).toBeInTheDocument();
        expect(screen.getByDisplayValue('125')).toBeInTheDocument();
        expect(screen.queryByDisplayValue('Kardenna spawn')).not.toBeInTheDocument();
    });
});

describe('A world task inherited by a child Location form (KNG-134, spec §2.3)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (metadataClient.getEntityMetadata as jest.Mock).mockResolvedValue({ entityName: '', displayName: '', fields: [] });
        (fieldValidationRuleClient.getByFormConfigurationId as jest.Mock).mockResolvedValue([]);
        (fieldValidationRuleClient.resolvePlaceholders as jest.Mock).mockResolvedValue({});
        (formConfigClient.getByEntityTypeName as jest.Mock).mockImplementation(async (name: string) => CONFIGS[name.toLowerCase()]);
        (workflowClient.getProgress as jest.Mock).mockResolvedValue([]);
        (worldTaskClient.create as jest.Mock).mockResolvedValue({ id: 5, status: 'Pending', linkCode: 'ABC123', taskType: 'LocationSelection' });
        (worldTaskClient.getById as jest.Mock).mockResolvedValue({
            id: 5,
            status: 'Completed',
            taskType: 'LocationSelection',
            outputJson: JSON.stringify(CAPTURED)
        });
    });

    it('fills Name, X, Y, Z and World from the capture instead of writing it all into Name', async () => {
        render(
            <FormWizard
                entityName="location"
                userId="1"
                fieldName="Location"
                worldTaskHint="LocationSelection"
                workflowSessionId={700}
                onComplete={() => {}}
            />
        );

        await screen.findByText('Location name');
        await waitFor(() => expect(document.getElementById('worldtask-action-0-Name')).not.toBeNull());
        fireEvent.click(document.getElementById('worldtask-action-0-Name') as HTMLElement);

        // WorldBoundFieldRenderer polls every 2 seconds.
        expect(await screen.findByDisplayValue('Gate spawn', {}, { timeout: 5000 })).toBeInTheDocument();
        expect(screen.getByDisplayValue('10.5')).toBeInTheDocument();
        expect(screen.getByDisplayValue('64')).toBeInTheDocument();
        expect(screen.getByDisplayValue('world')).toBeInTheDocument();
        expect(screen.queryByDisplayValue('[object Object]')).not.toBeInTheDocument();
    }, 10000);
});
