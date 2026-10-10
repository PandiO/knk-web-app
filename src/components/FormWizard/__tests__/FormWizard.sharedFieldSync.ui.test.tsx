import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FormWizard } from '../FormWizard';
import { formConfigClient } from '../../../apiClients/formConfigClient';
import { formSubmissionClient } from '../../../apiClients/formSubmissionClient';
import { fieldValidationRuleClient } from '../../../apiClients/fieldValidationRuleClient';
import { FormConfigurationDto, FormFieldDto, FormStepDto } from '../../../types/dtos/forms/FormModels';
import { FieldType } from '../../../utils/enums';

// KNG-120: two fields bound to the same property in different steps (the default District form
// asks for the Location twice) share one value, in both directions, and an empty copy never
// overwrites a filled one on submit.

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

const field = (guid: string, name: string, label: string): FormFieldDto => ({
    id: guid,
    fieldGuid: guid,
    fieldName: name,
    label,
    fieldType: FieldType.String,
    isRequired: false,
    isReadOnly: false,
    order: 0,
    isReusable: false,
    isLinkedToSource: false,
    hasCompatibilityIssues: false,
    validations: [],
    displayConditionGroups: []
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

const buildConfig = (): FormConfigurationDto => ({
    id: '12',
    entityTypeName: 'District',
    configurationName: 'District',
    description: '',
    isDefault: true,
    isActive: true,
    steps: [
        step('0', 'General', [field('guid-name', 'Name', 'Name'), field('guid-loc-1', 'LocationId', 'Location')]),
        step('1', 'Region', [field('guid-region', 'WgRegionId', 'Region')]),
        step('2', 'Spawn', [field('guid-loc-2', 'LocationId', 'Spawn location')])
    ]
});

const clickNext = () => fireEvent.click(screen.getByRole('button', { name: /^next$/i }));
const clickPrevious = () => fireEvent.click(screen.getByRole('button', { name: /previous/i }));
// The String renderer's textarea has no id, so its label isn't wired to it; find it beside the label.
const input = async (label: string): Promise<HTMLTextAreaElement> => {
    const labelElement = await screen.findByText(label, { selector: 'label' });
    return labelElement.parentElement!.querySelector('textarea')!;
};
const type = async (label: string, value: string) => fireEvent.change(await input(label), { target: { value } });

describe('FormWizard fields bound to the same property (KNG-120)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (fieldValidationRuleClient.getByFormConfigurationId as jest.Mock).mockResolvedValue([]);
        (formSubmissionClient.create as jest.Mock).mockImplementation(async (dto: Record<string, unknown>) => ({ ...dto, id: '55' }));
        (formSubmissionClient.update as jest.Mock).mockImplementation(async (dto: Record<string, unknown>) => dto);
    });

    it('fills the later copy, writes edits back to the earlier one and submits the value', async () => {
        (formConfigClient.getByEntityTypeName as jest.Mock).mockResolvedValue(buildConfig());
        const onComplete = jest.fn();
        render(<FormWizard entityName="District" userId="1" onComplete={onComplete} />);

        await input('Location');
        await type('Name', 'Old Town');
        await type('Location', '7');

        clickNext();
        await input('Region');
        clickNext();
        expect(await input('Spawn location')).toHaveValue('7');

        await type('Spawn location', '8');
        clickPrevious();
        await input('Region');
        clickPrevious();
        expect(await input('Location')).toHaveValue('8');

        clickNext();
        await input('Region');
        clickNext();
        await input('Spawn location');
        fireEvent.click(screen.getByRole('button', { name: /^submit$/i }));

        await waitFor(() => expect(onComplete).toHaveBeenCalled());
        expect(onComplete.mock.calls[0][0].LocationId).toBe('8');
    });

    it('resumed draft with only the earlier copy filled shows it in the later step', async () => {
        (formConfigClient.getById as jest.Mock).mockResolvedValue(buildConfig());
        (formSubmissionClient.getById as jest.Mock).mockResolvedValue({
            id: '55',
            formConfigurationId: '12',
            userId: '1',
            entityTypeName: 'District',
            currentStepIndex: 2,
            currentStepDataJson: JSON.stringify({ LocationId: null }),
            allStepsDataJson: JSON.stringify({
                0: { Name: 'Old Town', LocationId: '7' },
                1: { WgRegionId: null },
                2: { LocationId: null }
            }),
            status: 'Paused',
            childProgresses: []
        });

        render(<FormWizard entityName="District" userId="1" existingProgressId="55" />);

        expect(await input('Spawn location')).toHaveValue('7');
    });
});
