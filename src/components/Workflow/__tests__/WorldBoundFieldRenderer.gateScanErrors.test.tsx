import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { WorldBoundFieldRenderer } from '../WorldBoundFieldRenderer';
import { FormFieldDto } from '../../../types/dtos/forms/FormModels';
import { FieldType } from '../../../utils/enums';
import { worldTaskClient } from '../../../apiClients/worldTaskClient';

/**
 * KNG-268: a gate scan the API refuses shows why, and a failed scan shows its reason once
 * (it used to appear as both "Result Processing Error" and "Task Failed").
 */

jest.mock('../../../apiClients/worldTaskClient', () => ({
    worldTaskClient: { create: jest.fn(), getById: jest.fn() }
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

const openScanField: FormFieldDto = {
    id: '210',
    fieldName: 'OpenedBlockSnapshots',
    label: 'Open-door scan',
    fieldType: FieldType.List,
    objectType: 'GateOpenedBlockSnapshot',
    isRequired: false,
    isReadOnly: false,
    order: 0,
    isReusable: false,
    isLinkedToSource: false,
    hasCompatibilityIssues: false,
    validations: []
} as FormFieldDto;

const REFUSAL = "Door 'Main gate' (id 17) has no opened region yet. Build the opened door, select it with WorldEdit and run /gatedoor capture 17 opened in game, then scan again.";

describe('WorldBoundFieldRenderer: gate scan errors (KNG-268)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('shows why the API refused to start the scan', async () => {
        (worldTaskClient.create as jest.Mock).mockRejectedValue(new Error(REFUSAL));
        render(
            <WorldBoundFieldRenderer
                field={openScanField}
                value={null}
                onChange={jest.fn()}
                taskType="GateOpenedBlockScan"
                workflowSessionId={700}
                entityId={17}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: /start scan/i }));

        expect(await screen.findByText(REFUSAL)).toBeInTheDocument();
        expect(screen.getByText(/couldn't start/i)).toBeInTheDocument();
    });

    it('shows the reason of a failed scan once', async () => {
        const reason = "Gate 'Main gate' has no opened region captured yet - use '/gatedoor capture' first.";
        (worldTaskClient.create as jest.Mock).mockResolvedValue({ id: 9, status: 'Pending', taskType: 'GateOpenedBlockScan' });
        (worldTaskClient.getById as jest.Mock).mockResolvedValue({
            id: 9, status: 'Failed', taskType: 'GateOpenedBlockScan', errorMessage: reason
        });
        render(
            <WorldBoundFieldRenderer
                field={openScanField}
                value={null}
                onChange={jest.fn()}
                taskType="GateOpenedBlockScan"
                workflowSessionId={700}
                entityId={17}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: /start scan/i }));

        expect(await screen.findByText(/task failed/i, undefined, { timeout: 5000 })).toBeInTheDocument();
        expect(screen.getAllByText(reason)).toHaveLength(1);
        expect(screen.queryByText(/result processing error/i)).not.toBeInTheDocument();
    }, 10000);
});
