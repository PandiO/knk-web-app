import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { WorldBoundFieldRenderer } from '../WorldBoundFieldRenderer';
import { FormFieldDto } from '../../../types/dtos/forms/FormModels';
import { FieldType } from '../../../utils/enums';
import { worldTaskClient } from '../../../apiClients/worldTaskClient';

/**
 * KNG-134: "Replace via Minecraft" on a Location that already has an id wrote an id-less capture,
 * so the next "Edit instance" was blank and the parent's save created a second Location.
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

const locationField: FormFieldDto = {
    id: '102',
    fieldName: 'Location',
    label: 'Location',
    fieldType: FieldType.Object,
    objectType: 'Location',
    isRequired: false,
    isReadOnly: false,
    order: 0,
    isReusable: false,
    isLinkedToSource: false,
    hasCompatibilityIssues: false,
    validations: []
} as FormFieldDto;

const CAPTURED = { name: 'Gate spawn', x: 10.5, y: 64, z: -3, yaw: 90, pitch: 0, World: 'world' };

describe('WorldBoundFieldRenderer: Replace via Minecraft (KNG-134)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (worldTaskClient.create as jest.Mock).mockResolvedValue({ id: 5, status: 'Pending', linkCode: 'ABC123', taskType: 'LocationSelection' });
        (worldTaskClient.getById as jest.Mock).mockResolvedValue({
            id: 5, status: 'Completed', taskType: 'LocationSelection', outputJson: JSON.stringify(CAPTURED)
        });
    });

    it('keeps the id of the Location it replaces', async () => {
        const onChange = jest.fn();
        render(
            <WorldBoundFieldRenderer
                field={locationField}
                value={{ id: 83, name: 'Kardenna spawn', x: 120.5, y: 64, z: -30, world: 'world' }}
                onChange={onChange}
                taskType="LocationSelection"
                workflowSessionId={700}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: /replace via minecraft/i }));

        await waitFor(() => expect(onChange).toHaveBeenCalled(), { timeout: 5000 });
        expect(onChange).toHaveBeenCalledWith({ ...CAPTURED, id: 83 });
    }, 10000);

    it('leaves a first capture without an id', async () => {
        const onChange = jest.fn();
        render(
            <WorldBoundFieldRenderer
                field={locationField}
                value={null}
                onChange={onChange}
                taskType="LocationSelection"
                workflowSessionId={700}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: /send to minecraft/i }));

        await waitFor(() => expect(onChange).toHaveBeenCalled(), { timeout: 5000 });
        expect(onChange).toHaveBeenCalledWith(CAPTURED);
    }, 10000);
});
