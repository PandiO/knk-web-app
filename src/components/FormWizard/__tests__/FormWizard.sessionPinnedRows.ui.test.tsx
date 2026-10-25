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
import {
    getCreateFunctionForEntity,
    getFetchByIdFunctionForEntity,
    getSearchFunctionForEntity,
    getUpdateFunctionForEntity
} from '../../../utils/entityApiMapping';

/**
 * KNG-136: an entity created in a nested child form is pinned ("Created in this form", New) in every
 * picker of the root form, without reopening anything. Scenario from the spec (§1): create a
 * GateStructure; its Street field's Create New opens a Street form; inside it the Districts field's
 * Create New opens a District form (two levels deep). The District search endpoint doesn't return
 * the new District (the page is empty), yet the GateStructure's own District picker lists it, it
 * can be picked, and the GateStructure submits its id.
 *
 * Real ChildFormModal at both depths, real PagedEntityTable, search client mocked.
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
    gatestructure: config('20', 'GateStructure', [
        { fieldName: 'Name', label: 'Gate name', fieldType: 'String' },
        { fieldName: 'StreetId', label: 'Street', fieldType: 'Object', objectType: 'Street', canCreate: true },
        { fieldName: 'DistrictIds', label: 'Gate districts', fieldType: 'List', elementType: 'Object', objectType: 'District' }
    ]),
    street: config('30', 'Street', [
        { fieldName: 'Name', label: 'Street name', fieldType: 'String' },
        { fieldName: 'Districts', label: 'Street districts', fieldType: 'List', elementType: 'Object', objectType: 'District', canCreate: true }
    ]),
    district: config('40', 'District', [
        { fieldName: 'Name', label: 'District name', fieldType: 'String' }
    ])
};

const modalFor = (title: string): HTMLElement =>
    screen.getAllByText(title)[0].closest('.overflow-y-auto') as HTMLElement;

const fieldBlock = (container: HTMLElement, label: string): HTMLElement =>
    within(container).getByText(label).closest('div') as HTMLElement;

describe('GateStructure -> Street -> District: the new District is pinned in the root picker (KNG-136)', () => {
    let createDistrict: jest.Mock;
    let createStreet: jest.Mock;
    let districtSearch: jest.Mock;

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
        let nextSession = 700;
        (workflowClient.createSession as jest.Mock).mockImplementation(async () => ({ id: nextSession++ }));
        (getFetchByIdFunctionForEntity as jest.Mock).mockImplementation(() => async () => undefined);
        createDistrict = jest.fn(async (data: Record<string, unknown>) => ({ id: 501, name: data.Name, townId: null }));
        createStreet = jest.fn(async (data: Record<string, unknown>) => ({ id: 77, name: data.Name, districtIds: data.DistrictIds }));
        (getCreateFunctionForEntity as jest.Mock).mockImplementation((type: string) =>
            type === 'District' ? createDistrict : type === 'Street' ? createStreet : jest.fn());
        (getUpdateFunctionForEntity as jest.Mock).mockImplementation(() => jest.fn());
        // The database search never returns the new District (e.g. not indexed / other page).
        districtSearch = jest.fn(async () => ({ items: [], totalCount: 0, page: 1, pageSize: 5, totalPages: 0 }));
        (getSearchFunctionForEntity as jest.Mock).mockImplementation(() => districtSearch);
    });

    it('pins the District made two levels down in the GateStructure District picker, selectable and submitted', async () => {
        const onComplete = jest.fn();
        render(<FormWizard entityName="gatestructure" userId="1" onComplete={onComplete} />);

        await screen.findByText('Gate name');
        fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'North Gate' } });
        const rootDistricts = () => fieldBlock(document.body, 'Gate districts');
        expect(within(rootDistricts()).getByText('No results found')).toBeInTheDocument();

        // Depth 1: Street "Create New" (the Street field comes before the Districts field).
        fireEvent.click(screen.getAllByRole('button', { name: /create new/i })[0]);
        await screen.findByText('Street name');
        const streetModal = modalFor('Create New Street');
        const streetTextboxes = within(streetModal).getAllByRole('textbox');
        fireEvent.change(streetTextboxes[0], { target: { value: 'Market Lane' } });

        // Depth 2: District "Create New" inside the Street form.
        fireEvent.click(within(fieldBlock(streetModal, 'Street districts')).getByRole('button', { name: /create new/i }));
        await screen.findByText('District name');
        const districtModal = modalFor('Create New District');
        fireEvent.change(within(districtModal).getByRole('textbox'), { target: { value: 'Old Quarter' } });
        fireEvent.click(within(districtModal).getByRole('button', { name: /submit/i }));

        await waitFor(() => expect(createDistrict).toHaveBeenCalledTimes(1));
        await waitFor(() => expect(screen.queryByText('Create New District')).not.toBeInTheDocument());

        // Without reopening anything, the root picker lists the District, pinned and marked New.
        await waitFor(() => expect(within(rootDistricts()).getByText('Created in this form')).toBeInTheDocument());
        const pinnedRow = within(rootDistricts()).getByText('Old Quarter').closest('tr') as HTMLElement;
        expect(within(pinnedRow).getByText('New')).toBeInTheDocument();
        // The picker refetched when the registry changed.
        expect(districtSearch.mock.calls.length).toBeGreaterThan(1);

        // Finish the Street (it holds the District it created, saved with its id).
        fireEvent.click(within(modalFor('Create New Street')).getByRole('button', { name: /submit/i }));
        await waitFor(() => expect(createStreet).toHaveBeenCalledWith(expect.objectContaining({ Name: 'Market Lane', DistrictIds: [501] })));
        await waitFor(() => expect(screen.queryByText('Create New Street')).not.toBeInTheDocument());

        // The search box filters pinned rows too.
        const search = within(rootDistricts()).getByPlaceholderText('Search...');
        fireEvent.change(search, { target: { value: 'harbour' } });
        // Wait for the refetch with the term and its empty result (the table hides rows while loading).
        await waitFor(() => expect(districtSearch).toHaveBeenLastCalledWith(expect.objectContaining({ searchTerm: 'harbour' })));
        await waitFor(() => expect(within(rootDistricts()).getByText('No results found')).toBeInTheDocument());
        expect(within(rootDistricts()).queryByText('Old Quarter')).not.toBeInTheDocument();
        fireEvent.change(search, { target: { value: 'quarter' } });
        await waitFor(() => expect(districtSearch).toHaveBeenLastCalledWith(expect.objectContaining({ searchTerm: 'quarter' })));

        // Pick it in the GateStructure form and submit.
        fireEvent.click(await within(rootDistricts()).findByText('Old Quarter'));
        await waitFor(() => expect(within(rootDistricts()).getByText('ID: 501')).toBeInTheDocument());
        fireEvent.click(screen.getByRole('button', { name: /submit/i }));

        await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
        const [payload] = onComplete.mock.calls[0];
        expect(payload.DistrictIds).toEqual([501]);
        expect(payload.StreetId).toBe(77);
        expect(payload.Name).toBe('North Gate');
    });
});
