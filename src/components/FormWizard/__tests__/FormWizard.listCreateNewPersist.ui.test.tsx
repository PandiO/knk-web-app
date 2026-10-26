import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FormWizard } from '../FormWizard';
import { formConfigClient } from '../../../apiClients/formConfigClient';
import { workflowClient } from '../../../apiClients/workflowClient';
import { formSubmissionClient } from '../../../apiClients/formSubmissionClient';
import { fieldValidationRuleClient } from '../../../apiClients/fieldValidationRuleClient';
import { metadataClient } from '../../../apiClients/metadataClient';
import { displayConfigClient } from '../../../apiClients/displayConfigClient';
import { FormSubmissionStatus } from '../../../utils/enums';
import {
    getCreateFunctionForEntity,
    getFetchByIdFunctionForEntity,
    getUpdateFunctionForEntity
} from '../../../utils/entityApiMapping';

/**
 * KNG-133: a District made with "Create New" on a Street form's (non-owned) Districts List field was
 * never saved. It stayed an id-less object in the Street form, normalizeFormSubmission filtered it
 * out, and the Street was saved with districtIds = [] without a word. Under decision D1 = A the
 * District is saved as soon as its form completes; an id-less item that still reaches the submit
 * blocks it with a message naming the field.
 *
 * Uses the real ChildFormModal and a nested FormWizard (only the picker table is stubbed).
 */

jest.mock('../../PagedEntityTable/PagedEntityTable', () => ({
    PagedEntityTable: () => <div data-testid="paged-table">paged-table</div>
}));
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
        stepName: `${entityTypeName} details`,
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
    street: config('30', 'Street', [
        { fieldName: 'Name', label: 'Street name', fieldType: 'String' },
        {
            fieldName: 'Districts',
            label: 'Districts',
            fieldType: 'List',
            elementType: 'Object',
            objectType: 'District',
            canCreate: true,
            minSelection: 1
        }
    ]),
    district: config('40', 'District', [
        { fieldName: 'Name', label: 'District name', fieldType: 'String' }
    ])
};

describe('Street form: a District made with Create New on the Districts List field (KNG-133)', () => {
    let createDistrict: jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
        (metadataClient.getEntityMetadata as jest.Mock).mockResolvedValue({ entityName: '', displayName: '', fields: [] });
        (metadataClient.getAllEntityMetadata as jest.Mock).mockResolvedValue([]);
        (displayConfigClient.getDefaultByEntityType as jest.Mock).mockRejectedValue(new Error('none'));
        (fieldValidationRuleClient.getByFormConfigurationId as jest.Mock).mockResolvedValue([]);
        (formSubmissionClient.getByEntityTypeNameFiltered as jest.Mock).mockResolvedValue([]);
        (formSubmissionClient.create as jest.Mock).mockImplementation(async (p: Record<string, unknown>) => ({ ...p, id: 'progress-1' }));
        (formSubmissionClient.update as jest.Mock).mockImplementation(async (p: Record<string, unknown>) => p);
        (formConfigClient.getByEntityTypeName as jest.Mock).mockImplementation(async (name: string) => CONFIGS[name.toLowerCase()]);
        (workflowClient.getProgress as jest.Mock).mockResolvedValue([]);
        (workflowClient.createSession as jest.Mock).mockResolvedValue({ id: 700 });
        (getFetchByIdFunctionForEntity as jest.Mock).mockImplementation(() => async () => undefined);
        createDistrict = jest.fn(async (data: Record<string, unknown>) => ({ id: 501, name: data.Name }));
        (getCreateFunctionForEntity as jest.Mock).mockImplementation((type: string) =>
            type === 'District' ? createDistrict : jest.fn());
        (getUpdateFunctionForEntity as jest.Mock).mockImplementation(() => jest.fn());
    });

    it('saves the new District when its form completes and submits the Street with its id', async () => {
        const onComplete = jest.fn();
        render(<FormWizard entityName="street" onComplete={onComplete} />);

        await screen.findByText('Street name');
        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Market Lane' } });
        fireEvent.click(screen.getByRole('button', { name: /create new/i }));

        // The child form's Name input renders after the Street form's.
        await screen.findByText('District name');
        const textboxes = screen.getAllByRole('textbox');
        fireEvent.change(textboxes[textboxes.length - 1], { target: { value: 'Old Quarter' } });
        // The modal renders after the Street form, so its Submit is the last one.
        const submitButtons = screen.getAllByRole('button', { name: /submit/i });
        fireEvent.click(submitButtons[submitButtons.length - 1]);

        // Saved through the District's own create API the moment the child form completes.
        await waitFor(() => expect(createDistrict).toHaveBeenCalledTimes(1));
        expect(getCreateFunctionForEntity).toHaveBeenCalledWith('District');
        expect(createDistrict).toHaveBeenCalledWith(expect.objectContaining({ Name: 'Old Quarter' }));
        await waitFor(() => expect(screen.queryByText('Create New District')).not.toBeInTheDocument());
        expect(screen.getByText('ID: 501')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /submit/i }));

        await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
        const [payload] = onComplete.mock.calls[0];
        expect(payload.DistrictIds).toEqual([501]);
        expect(payload.Name).toBe('Market Lane');
    });

    it('refuses to submit a District that was never saved, names the field, and leaves the progress open', async () => {
        const onComplete = jest.fn();
        render(
            <FormWizard
                entityName="street"
                onComplete={onComplete}
                initialFieldValues={{ Name: 'Market Lane', Districts: [{ name: 'Old Quarter' }] }}
            />
        );

        await screen.findByDisplayValue('Market Lane');
        fireEvent.click(screen.getByRole('button', { name: /submit/i }));

        const banner = await screen.findByText(/"Districts" holds 1 District that was never saved/);
        expect(within(banner.parentElement as HTMLElement).getByText(/select or create it again/)).toBeInTheDocument();
        expect(onComplete).not.toHaveBeenCalled();
        // The refused submit didn't mark the progress Completed.
        const savedStatuses = [
            ...(formSubmissionClient.create as jest.Mock).mock.calls,
            ...(formSubmissionClient.update as jest.Mock).mock.calls
        ].map(([progress]) => progress.status);
        expect(savedStatuses).not.toContain(FormSubmissionStatus.Completed);
    });
});
