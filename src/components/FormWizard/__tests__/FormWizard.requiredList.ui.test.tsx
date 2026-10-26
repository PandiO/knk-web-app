import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FormWizard } from '../FormWizard';
import { formConfigClient } from '../../../apiClients/formConfigClient';
import { formSubmissionClient } from '../../../apiClients/formSubmissionClient';
import { fieldValidationRuleClient } from '../../../apiClients/fieldValidationRuleClient';
import { getFetchByIdFunctionForEntity } from '../../../utils/entityApiMapping';
import { FormConfigurationDto, FormFieldDto, FormStepDto } from '../../../types/dtos/forms/FormModels';
import { FieldType } from '../../../utils/enums';

// KNG-164: a required List field let Next/Submit through with an empty list and never read
// minSelection/maxSelection, so "a Street needs at least one District" wasn't enforced.

jest.mock('../../PagedEntityTable/PagedEntityTable', () => ({
    PagedEntityTable: () => <div data-testid="paged-table">paged-table</div>
}));
jest.mock('../../../apiClients/formConfigClient', () => ({
    formConfigClient: { getByEntityTypeName: jest.fn(), getById: jest.fn() }
}));
jest.mock('../../../apiClients/metadataClient', () => ({
    metadataClient: {
        getEntityMetadata: jest.fn().mockResolvedValue({ entityName: '', displayName: '', fields: [] })
    }
}));
jest.mock('../../../apiClients/formSubmissionClient', () => ({
    formSubmissionClient: { getById: jest.fn(), create: jest.fn(), update: jest.fn() }
}));
jest.mock('../../../apiClients/fieldValidationRuleClient', () => ({
    fieldValidationRuleClient: { getByFormConfigurationId: jest.fn(), validateField: jest.fn(), resolvePlaceholders: jest.fn() }
}));
jest.mock('../../../utils/entityApiMapping', () => ({
    getFetchByIdFunctionForEntity: jest.fn(),
    getCreateFunctionForEntity: jest.fn(),
    getUpdateFunctionForEntity: jest.fn()
}));

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

const districtsField = (overrides: Partial<FormFieldDto> = {}) =>
    field('guid-districts', 'DistrictIds', {
        label: 'Districts',
        fieldType: FieldType.List,
        objectType: 'District',
        isRequired: true,
        order: 1,
        ...overrides
    });

const streetConfig = (districts: FormFieldDto = districtsField()): FormConfigurationDto => ({
    id: '3',
    entityTypeName: 'Street',
    configurationName: 'Street',
    description: '',
    isDefault: true,
    steps: [
        step('0', 'Basics', [field('guid-name', 'Name', { label: 'Name', order: 0 }), districts]),
        step('1', 'Details', [field('guid-notes', 'Notes', { label: 'Notes' })])
    ]
});

const clickNext = () => fireEvent.click(screen.getByRole('button', { name: /^next$/i }));
const advanced = () => waitFor(() => expect(screen.getByRole('button', { name: /^submit$/i })).toBeInTheDocument());

describe('FormWizard required / min / max List (KNG-164)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (fieldValidationRuleClient.getByFormConfigurationId as jest.Mock).mockResolvedValue([]);
        (formSubmissionClient.create as jest.Mock).mockImplementation(async (dto: Record<string, unknown>) => ({ ...dto, id: '55' }));
        (formSubmissionClient.update as jest.Mock).mockImplementation(async (dto: Record<string, unknown>) => dto);
    });

    it('blocks Next on a required List with no items and names the field', async () => {
        (formConfigClient.getByEntityTypeName as jest.Mock).mockResolvedValue(streetConfig());

        render(<FormWizard entityName="Street" />);
        fireEvent.change(await screen.findByRole('textbox'), { target: { value: 'High Street' } });

        clickNext();

        // On the field, and as a link in the error summary (#109).
        expect(await screen.findByText('Districts is required: select at least 1 District', { selector: 'p' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Districts is required: select at least 1 District' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /^submit$/i })).not.toBeInTheDocument();
        expect(formSubmissionClient.create).not.toHaveBeenCalled();
    });

    it('blocks Next when the list holds [] (the bug: [] counted as present)', async () => {
        (formConfigClient.getByEntityTypeName as jest.Mock).mockResolvedValue(streetConfig());
        (getFetchByIdFunctionForEntity as jest.Mock).mockReturnValue(async () => ({
            id: 4, name: 'High Street', districtIds: [], districts: []
        }));

        render(<FormWizard entityName="Street" entityId="4" />);
        await screen.findByDisplayValue('High Street');

        clickNext();

        // On the field, and as a link in the error summary (#109).
        expect(await screen.findByText('Districts is required: select at least 1 District', { selector: 'p' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Districts is required: select at least 1 District' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /^submit$/i })).not.toBeInTheDocument();
    });

    it('lets an edit form with a loaded District through (DistrictIds loads from districts, KNG-135)', async () => {
        (formConfigClient.getByEntityTypeName as jest.Mock).mockResolvedValue(streetConfig());
        (getFetchByIdFunctionForEntity as jest.Mock).mockReturnValue(async () => ({
            id: 4, name: 'High Street', districtIds: [], districts: [{ id: 2, name: 'Old Quarter' }]
        }));

        render(<FormWizard entityName="Street" entityId="4" />);
        expect(await screen.findByText('Old Quarter')).toBeInTheDocument();

        clickNext();
        await advanced();
    });

    it('enforces minSelection on a list that has fewer items', async () => {
        (formConfigClient.getByEntityTypeName as jest.Mock).mockResolvedValue(streetConfig(districtsField({ minSelection: 2 })));
        (getFetchByIdFunctionForEntity as jest.Mock).mockReturnValue(async () => ({
            id: 4, name: 'High Street', districtIds: [2], districts: [{ id: 2, name: 'Old Quarter' }]
        }));

        render(<FormWizard entityName="Street" entityId="4" />);
        await screen.findByText('Old Quarter');

        clickNext();

        expect(await screen.findByText('Districts needs at least 2 Districts (1 selected)', { selector: 'p' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /^submit$/i })).not.toBeInTheDocument();
    });

    it('does not block creating the parent of an owned child collection (items come after the save)', async () => {
        (formConfigClient.getByEntityTypeName as jest.Mock).mockResolvedValue(streetConfig(districtsField({
            label: 'Gate doors',
            fieldName: 'GateDoors',
            objectType: 'GateDoor',
            settingsJson: JSON.stringify({ ownedChildCollection: true })
        })));

        render(<FormWizard entityName="Street" />);
        fireEvent.change(await screen.findByRole('textbox'), { target: { value: 'High Street' } });

        clickNext();
        await advanced();
    });
});
