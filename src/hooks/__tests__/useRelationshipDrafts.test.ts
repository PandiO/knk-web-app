import { renderHook, waitFor } from '@testing-library/react';
import { useRelationshipDrafts } from '../useRelationshipDrafts';
import { formConfigClient } from '../../apiClients/formConfigClient';
import { formSubmissionClient } from '../../apiClients/formSubmissionClient';
import { FieldType, FormSubmissionStatus } from '../../utils/enums';
import { FormConfigurationDto } from '../../types/dtos/forms/FormModels';

jest.mock('../../apiClients/formConfigClient', () => ({
    formConfigClient: {
        getByEntityTypeName: jest.fn()
    }
}));

jest.mock('../../apiClients/formSubmissionClient', () => ({
    formSubmissionClient: {
        getByEntityTypeNameFiltered: jest.fn()
    }
}));

const gateDoorConfig: FormConfigurationDto = {
    id: '12',
    entityTypeName: 'GateDoor',
    configurationName: 'Gate Door Configuration',
    isDefault: true,
    isActive: true,
    steps: [
        {
            stepName: 'General Information',
            order: 0,
            isReusable: false,
            isLinkedToSource: false,
            hasCompatibilityIssues: false,
            isManyToManyRelationship: false,
            childFormSteps: [],
            conditions: [],
            fields: [
                {
                    fieldName: 'GateStructureId',
                    label: 'Gate structure',
                    fieldType: FieldType.Object,
                    objectType: 'GateStructure',
                    isRequired: true,
                    isReadOnly: false,
                    order: 0,
                    isReusable: false,
                    isLinkedToSource: false,
                    hasCompatibilityIssues: false,
                    validations: []
                }
            ]
        }
    ]
};

describe('useRelationshipDrafts', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (formConfigClient.getByEntityTypeName as jest.Mock).mockResolvedValue(gateDoorConfig);
        (formSubmissionClient.getByEntityTypeNameFiltered as jest.Mock).mockResolvedValue([]);
    });

    it('does not fetch until childEntityTypeName, parentEntityTypeName and parentEntityId are all available', async () => {
        const { result, rerender } = renderHook(
            ({ parentEntityId }: { parentEntityId?: string }) =>
                useRelationshipDrafts('GateDoor', 'GateStructure', parentEntityId),
            { initialProps: { parentEntityId: undefined } }
        );

        expect(result.current.drafts).toEqual([]);
        expect(formConfigClient.getByEntityTypeName).not.toHaveBeenCalled();

        rerender({ parentEntityId: '14' });

        await waitFor(() => {
            expect(formConfigClient.getByEntityTypeName).toHaveBeenCalledWith('GateDoor', true);
        });
    });

    it('resolves the parent link field from the child config and filters to draft statuses', async () => {
        (formSubmissionClient.getByEntityTypeNameFiltered as jest.Mock).mockResolvedValue([
            { id: '1', status: FormSubmissionStatus.Paused, createdByUsername: 'alice', updatedAt: '2026-01-01T00:00:00Z' },
            { id: '2', status: FormSubmissionStatus.InProgress, createdByUsername: 'bob' },
            { id: '3', status: FormSubmissionStatus.Completed, createdByUsername: 'carol' }
        ]);

        const { result } = renderHook(() => useRelationshipDrafts('GateDoor', 'GateStructure', '14'));

        await waitFor(() => {
            expect(result.current.drafts).toHaveLength(2);
        });

        expect(formSubmissionClient.getByEntityTypeNameFiltered).toHaveBeenCalledWith('GateDoor', 'GateStructureId', '14');
        expect(result.current.drafts.map(d => d.progressId)).toEqual(['1', '2']);
        expect(result.current.drafts[0].createdByUsername).toBe('alice');
    });

    it('returns no drafts when the child config has no field linking back to the parent type', async () => {
        (formConfigClient.getByEntityTypeName as jest.Mock).mockResolvedValue({
            ...gateDoorConfig,
            steps: [{ ...gateDoorConfig.steps[0], fields: [] }]
        });

        const { result } = renderHook(() => useRelationshipDrafts('GateDoor', 'GateStructure', '14'));

        await waitFor(() => {
            expect(formConfigClient.getByEntityTypeName).toHaveBeenCalled();
        });

        expect(result.current.drafts).toEqual([]);
        expect(formSubmissionClient.getByEntityTypeNameFiltered).not.toHaveBeenCalled();
    });

    it('clears drafts and reports no error when the fetch fails', async () => {
        (formSubmissionClient.getByEntityTypeNameFiltered as jest.Mock).mockRejectedValue(new Error('network error'));
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

        const { result } = renderHook(() => useRelationshipDrafts('GateDoor', 'GateStructure', '14'));

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.drafts).toEqual([]);
        consoleError.mockRestore();
    });
});
