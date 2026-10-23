import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FormWizard } from '../FormWizard';
import { FormCancelAction } from '../FormCancelAction';
import { FormSessionRoot } from '../../../contexts/FormSessionContext';
import type { DeleteCreatedEntitiesDeps } from '../../../utils/forms/deleteCreatedEntities';
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
 * KNG-162: cancelling a root form whose child forms saved entities. GateStructure -> Street (Create
 * New) -> District (Create New, two levels deep), both saved by their own forms; then "Cancel form"
 * lists both with Keep (default) or Delete. Delete goes newest first (Street, then District) through
 * the reference check and the normal delete. The root draft records both (createdEntitiesJson) and a
 * resumed draft pins them again.
 *
 * Real FormWizard, ChildFormModal and PagedEntityTable; API clients mocked.
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


describe('Cancel a root form after its child forms saved entities (KNG-162)', () => {
    let createDistrict: jest.Mock;
    let createStreet: jest.Mock;
    let calls: string[];
    let deps: DeleteCreatedEntitiesDeps;

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
        (formConfigClient.getById as jest.Mock).mockImplementation(async (id: string) =>
            Object.values(CONFIGS).find(c => (c as { id: string }).id === id));
        (workflowClient.getProgress as jest.Mock).mockResolvedValue([]);
        let nextSession = 700;
        (workflowClient.createSession as jest.Mock).mockImplementation(async () => ({ id: nextSession++ }));
        (getFetchByIdFunctionForEntity as jest.Mock).mockImplementation(() => async () => undefined);
        createDistrict = jest.fn(async (data: Record<string, unknown>) => ({ id: 501, name: data.Name, townId: null }));
        createStreet = jest.fn(async (data: Record<string, unknown>) => ({ id: 77, name: data.Name, districtIds: data.DistrictIds }));
        (getCreateFunctionForEntity as jest.Mock).mockImplementation((type: string) =>
            type === 'District' ? createDistrict : type === 'Street' ? createStreet : jest.fn());
        (getUpdateFunctionForEntity as jest.Mock).mockImplementation(() => jest.fn());
        (getSearchFunctionForEntity as jest.Mock).mockImplementation(() =>
            jest.fn(async () => ({ items: [], totalCount: 0, page: 1, pageSize: 5, totalPages: 0 })));
        calls = [];
        deps = {
            checkReferences: jest.fn(async (type: string, id: number | string, ignore: string[]) => {
                calls.push(`check ${type}:${id} [${ignore.join(',')}]`);
                return { entityTypeName: type, id: String(id), inUse: false, references: [] };
            }),
            getDeleteFunction: jest.fn((type: string) => async (id: number | string) => {
                calls.push(`delete ${type}:${id}`);
            })
        };
    });

    const renderWizard = (onLeave: jest.Mock, existingProgressId?: string) =>
        render(
            <FormSessionRoot>
                <FormCancelAction onLeave={onLeave} deps={deps} />
                <FormWizard entityName="gatestructure" userId="1" onComplete={jest.fn()} existingProgressId={existingProgressId} />
            </FormSessionRoot>
        );

    /** Street "Market Lane" with a new District "Old Quarter" inside it, both saved by their own forms. */
    const createStreetWithDistrict = async () => {
        await screen.findByText('Gate name');
        fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'North Gate' } });
        fireEvent.click(screen.getAllByRole('button', { name: /create new/i })[0]);
        await screen.findByText('Street name');
        const streetModal = modalFor('Create New Street');
        fireEvent.change(within(streetModal).getAllByRole('textbox')[0], { target: { value: 'Market Lane' } });
        fireEvent.click(within(fieldBlock(streetModal, 'Street districts')).getByRole('button', { name: /create new/i }));
        await screen.findByText('District name');
        const districtModal = modalFor('Create New District');
        fireEvent.change(within(districtModal).getByRole('textbox'), { target: { value: 'Old Quarter' } });
        fireEvent.click(within(districtModal).getByRole('button', { name: /submit/i }));
        await waitFor(() => expect(createDistrict).toHaveBeenCalledTimes(1));
        await waitFor(() => expect(screen.queryByText('Create New District')).not.toBeInTheDocument());
        fireEvent.click(within(modalFor('Create New Street')).getByRole('button', { name: /submit/i }));
        await waitFor(() => expect(createStreet).toHaveBeenCalledTimes(1));
        await waitFor(() => expect(screen.queryByText('Create New Street')).not.toBeInTheDocument());
    };

    const openCancelPrompt = async () => {
        fireEvent.click(screen.getByRole('button', { name: /cancel form/i }));
        return screen.findByRole('dialog', { name: 'Cancel this form?' });
    };

    it('lists both entities; Keep leaves the form and deletes nothing', async () => {
        const onLeave = jest.fn();
        renderWizard(onLeave);
        await createStreetWithDistrict();

        const dialog = await openCancelPrompt();
        const items = within(within(dialog).getByRole('list', { name: 'Created entities' })).getAllByRole('listitem');
        expect(items.map(item => item.textContent)).toEqual(["District 'Old Quarter'", "Street 'Market Lane'"]);
        // Keep is the default (focused) choice.
        expect(within(dialog).getByRole('button', { name: 'Keep them' })).toHaveFocus();

        fireEvent.click(within(dialog).getByRole('button', { name: 'Keep them' }));

        await waitFor(() => expect(onLeave).toHaveBeenCalledTimes(1));
        expect(calls).toEqual([]);
        expect(screen.queryByRole('dialog', { name: 'Cancel this form?' })).not.toBeInTheDocument();
    });

    it('Delete removes the Street, then the District, reports it and leaves after Done', async () => {
        const onLeave = jest.fn();
        renderWizard(onLeave);
        await createStreetWithDistrict();

        const dialog = await openCancelPrompt();
        fireEvent.click(within(dialog).getByRole('button', { name: 'Delete them' }));

        const report = await within(dialog).findByRole('list', { name: 'Delete results' });
        expect(calls).toEqual(['check Street:77 [District:501]', 'delete Street:77', 'check District:501 []', 'delete District:501']);
        expect(within(dialog).getByText('Deleted 2 of 2.')).toBeInTheDocument();
        expect(within(report).getAllByRole('listitem').map(item => item.textContent)).toEqual([
            "Street 'Market Lane': deleted",
            "District 'Old Quarter': deleted"
        ]);
        expect(onLeave).not.toHaveBeenCalled();

        fireEvent.click(within(dialog).getByRole('button', { name: 'Done' }));
        expect(onLeave).toHaveBeenCalledTimes(1);
    });

    it('an entity in use is skipped with a message', async () => {
        (deps.checkReferences as jest.Mock).mockImplementation(async (type: string, id: number | string) => ({
            entityTypeName: type,
            id: String(id),
            inUse: type === 'District',
            references: type === 'District' ? [{ referencedBy: 'Structure.DistrictId', count: 1 }] : []
        }));
        renderWizard(jest.fn());
        await createStreetWithDistrict();

        const dialog = await openCancelPrompt();
        fireEvent.click(within(dialog).getByRole('button', { name: 'Delete them' }));

        expect(await within(dialog).findByText('Deleted 1 of 2.')).toBeInTheDocument();
        expect(within(dialog).getByText("District 'Old Quarter': skipped: in use (used by Structure.DistrictId)")).toBeInTheDocument();
        expect(calls).not.toContain('delete District:501');
    });

    it('with nothing created, Cancel only asks to leave; Close stays in the form', async () => {
        const onLeave = jest.fn();
        renderWizard(onLeave);
        await screen.findByText('Gate name');

        fireEvent.click(screen.getByRole('button', { name: /cancel form/i }));
        const dialog = await screen.findByRole('dialog', { name: 'Leave this form?' });
        fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
        expect(onLeave).not.toHaveBeenCalled();
        expect(screen.getByText('Gate name')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /cancel form/i }));
        fireEvent.click(within(await screen.findByRole('dialog', { name: 'Leave this form?' })).getByRole('button', { name: 'Leave form' }));
        await waitFor(() => expect(onLeave).toHaveBeenCalledTimes(1));
    });

    it('Save Draft records both entities on the root progress', async () => {
        renderWizard(jest.fn());
        await createStreetWithDistrict();

        fireEvent.click(screen.getByRole('button', { name: /save draft/i }));

        await waitFor(() => {
            const saves = [...(formSubmissionClient.create as jest.Mock).mock.calls, ...(formSubmissionClient.update as jest.Mock).mock.calls]
                .map(([p]) => p as { createdEntitiesJson?: string; parentProgressId?: string; status?: string })
                .filter(p => !p.parentProgressId && p.status === 'Paused');
            expect(saves.length).toBeGreaterThan(0);
            const recorded = JSON.parse(saves[saves.length - 1].createdEntitiesJson!);
            expect(recorded.map((r: { entityTypeName: string; id: number }) => `${r.entityTypeName}:${r.id}`)).toEqual(['District:501', 'Street:77']);
        });
    });

    it('a resumed draft pins its recorded entities again and Cancel still lists them', async () => {
        (formSubmissionClient.getById as jest.Mock).mockResolvedValue({
            id: 'progress-9',
            formConfigurationId: '20',
            userId: '1',
            entityTypeName: 'GateStructure',
            currentStepIndex: 0,
            currentStepDataJson: JSON.stringify({ Name: 'North Gate' }),
            allStepsDataJson: JSON.stringify({ 0: { Name: 'North Gate' } }),
            status: 'Paused',
            createdEntitiesJson: JSON.stringify([
                { entityTypeName: 'District', id: 501, display: { name: 'Old Quarter' }, origin: { formPath: ['gatestructure', 'Street'], fieldName: 'Districts' }, sequence: 1 },
                { entityTypeName: 'Street', id: 77, display: { name: 'Market Lane' }, origin: { formPath: ['gatestructure'], fieldName: 'StreetId' }, sequence: 2 }
            ])
        });
        renderWizard(jest.fn(), 'progress-9');

        await screen.findByText('Gate name');
        const rootDistricts = () => fieldBlock(document.body, 'Gate districts');
        await waitFor(() => expect(within(rootDistricts()).getByText('Created in this form')).toBeInTheDocument());
        expect(within(rootDistricts()).getByText('Old Quarter')).toBeInTheDocument();

        const dialog = await openCancelPrompt();
        expect(within(dialog).getByText("Street 'Market Lane'")).toBeInTheDocument();
        expect(within(dialog).getByText("District 'Old Quarter'")).toBeInTheDocument();
    });
});
