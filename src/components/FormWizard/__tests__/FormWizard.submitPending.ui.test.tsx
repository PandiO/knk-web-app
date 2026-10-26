import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FormWizard } from '../FormWizard';
import { formConfigClient } from '../../../apiClients/formConfigClient';
import { formSubmissionClient } from '../../../apiClients/formSubmissionClient';
import { fieldValidationRuleClient } from '../../../apiClients/fieldValidationRuleClient';
import { FormConfigurationDto, FormFieldDto } from '../../../types/dtos/forms/FormModels';
import { FieldType } from '../../../utils/enums';

// #177 link 1: Submit stays pending until the entity is saved (onComplete awaited), a second click
// does nothing, and the progress is marked Completed only after the entity was saved.

jest.mock('../../../apiClients/formConfigClient', () => ({
    formConfigClient: { getByEntityTypeName: jest.fn(), getById: jest.fn() }
}));
jest.mock('../../../apiClients/metadataClient', () => ({
    metadataClient: {
        getEntityMetadata: jest.fn().mockResolvedValue({ entityName: 'Town', displayName: 'Town', fields: [] })
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

const nameField: FormFieldDto = {
    id: 'guid-name',
    fieldGuid: 'guid-name',
    fieldName: 'Name',
    label: 'Name',
    fieldType: FieldType.String,
    isRequired: false,
    isReadOnly: false,
    order: 0,
    isReusable: false,
    isLinkedToSource: false,
    hasCompatibilityIssues: false,
    validations: [],
    displayConditionGroups: []
};

const config: FormConfigurationDto = {
    id: '7',
    entityTypeName: 'Town',
    configurationName: 'Town',
    description: '',
    isDefault: true,
    steps: [{
        id: '0',
        stepName: 'General',
        description: '',
        order: 0,
        fieldOrderJson: JSON.stringify(['guid-name']),
        isReusable: false,
        isLinkedToSource: false,
        hasCompatibilityIssues: false,
        isManyToManyRelationship: false,
        childFormSteps: [],
        conditions: [],
        fields: [nameField]
    }]
};

const create = formSubmissionClient.create as jest.Mock;
const update = formSubmissionClient.update as jest.Mock;
const savedStatuses = () =>
    [...create.mock.calls.map(call => ['create', call[0].status]), ...update.mock.calls.map(call => ['update', call[0].status, call[0].id])];

const deferred = <T,>() => {
    let resolve: (value: T) => void = () => undefined;
    let reject: (reason: unknown) => void = () => undefined;
    const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
};

describe('FormWizard submit pending state (#177 link 1)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (formConfigClient.getByEntityTypeName as jest.Mock).mockResolvedValue(config);
        (fieldValidationRuleClient.getByFormConfigurationId as jest.Mock).mockResolvedValue([]);
        create.mockImplementation(async (dto: Record<string, unknown>) => ({ ...dto, id: '55' }));
        update.mockImplementation(async (dto: Record<string, unknown>) => dto);
        jest.spyOn(console, 'log').mockImplementation(() => undefined);
    });

    afterEach(() => {
        (console.log as jest.Mock).mockRestore();
    });

    it('stays pending until the entity is saved, ignores a second click, then marks the progress Completed', async () => {
        const save = deferred<boolean>();
        const onComplete = jest.fn(() => save.promise);
        const onCompleted = jest.fn();
        const onSubmittingChange = jest.fn();

        render(
            <FormWizard entityName="town" userId="1" onComplete={onComplete} onCompleted={onCompleted} onSubmittingChange={onSubmittingChange} />
        );
        fireEvent.click(await screen.findByRole('button', { name: /^submit$/i }));

        await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
        const pending = screen.getByRole('button', { name: /submitting/i });
        expect(pending).toBeDisabled();
        expect(screen.getByText('Saving Town…')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /save draft/i })).toBeDisabled();
        expect(onSubmittingChange).toHaveBeenLastCalledWith(true);
        // The progress holds the latest values, but is not Completed while the entity is unsaved.
        expect(savedStatuses()).toEqual([['create', 'InProgress']]);
        expect(onComplete.mock.calls[0]).toEqual([expect.anything(), expect.objectContaining({ id: '55' })]);

        fireEvent.click(pending);
        expect(onComplete).toHaveBeenCalledTimes(1);

        await act(async () => save.resolve(true));

        await waitFor(() => expect(onCompleted).toHaveBeenCalledTimes(1));
        // Completed on the same progress row, not a second create.
        expect(savedStatuses()).toEqual([['create', 'InProgress'], ['update', 'Completed', '55']]);
        expect(onSubmittingChange).toHaveBeenLastCalledWith(false);
    });

    it('leaves the progress not Completed when the page reports the save failed', async () => {
        const onComplete = jest.fn().mockResolvedValue(false);
        const onCompleted = jest.fn();

        render(<FormWizard entityName="town" userId="1" onComplete={onComplete} onCompleted={onCompleted} />);
        fireEvent.click(await screen.findByRole('button', { name: /^submit$/i }));

        await waitFor(() => expect(onComplete).toHaveBeenCalled());
        expect(await screen.findByRole('button', { name: /^submit$/i })).toBeEnabled();
        expect(savedStatuses()).toEqual([['create', 'InProgress']]);
        expect(onCompleted).not.toHaveBeenCalled();
    });

    it('leaves the progress not Completed when saving the entity throws', async () => {
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
        const onComplete = jest.fn().mockRejectedValue(new Error('refused'));
        const onCompleted = jest.fn();

        render(<FormWizard entityName="town" userId="1" onComplete={onComplete} onCompleted={onCompleted} />);
        fireEvent.click(await screen.findByRole('button', { name: /^submit$/i }));

        await waitFor(() => expect(onComplete).toHaveBeenCalled());
        expect(await screen.findByRole('button', { name: /^submit$/i })).toBeEnabled();
        expect(savedStatuses()).toEqual([['create', 'InProgress']]);
        expect(onCompleted).not.toHaveBeenCalled();
        consoleError.mockRestore();
    });

    it('treats a caller that returns nothing as saved', async () => {
        const onComplete = jest.fn();
        const onCompleted = jest.fn();

        render(<FormWizard entityName="town" userId="1" onComplete={onComplete} onCompleted={onCompleted} />);
        fireEvent.click(await screen.findByRole('button', { name: /^submit$/i }));

        await waitFor(() => expect(onCompleted).toHaveBeenCalled());
        expect(savedStatuses()).toEqual([['create', 'InProgress'], ['update', 'Completed', '55']]);
    });
});
