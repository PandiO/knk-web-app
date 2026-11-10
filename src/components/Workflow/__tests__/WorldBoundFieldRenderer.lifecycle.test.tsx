import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { WorldBoundFieldRenderer } from '../WorldBoundFieldRenderer';
import { FormFieldDto } from '../../../types/dtos/forms/FormModels';
import { WorldTaskReadDto } from '../../../types/dtos/workflow/WorkflowDtos';
import { FieldType } from '../../../utils/enums';
import { worldTaskClient } from '../../../apiClients/worldTaskClient';

/**
 * PandiO/knk-workspace#180 (DESIGN §8.2 web hygiene, §8.7): the panel reattaches to the field's latest task, applies a
 * result that completed while the form was closed, anchors new tasks to the draft, cancels what it replaces, and shows
 * Cancelled/Expired with "Start again".
 */

jest.mock('../../../apiClients/worldTaskClient', () => ({
    worldTaskClient: { create: jest.fn(), getById: jest.fn(), cancel: jest.fn() }
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

const regionField: FormFieldDto = {
    id: '11',
    fieldName: 'WgRegionId',
    label: 'Region',
    fieldType: FieldType.String,
    isRequired: false,
    isReadOnly: false,
    order: 0,
    isReusable: false,
    isLinkedToSource: false,
    hasCompatibilityIssues: false,
    validations: []
} as FormFieldDto;

const task = (overrides: Partial<WorldTaskReadDto>): WorldTaskReadDto => ({
    id: 41,
    workflowSessionId: 7,
    fieldName: 'WgRegionId',
    taskType: 'WgRegionId',
    status: 'Pending',
    linkCode: 'AB12CD',
    createdAt: '2026-11-01T12:00:00Z',
    ...overrides,
});

describe('WorldBoundFieldRenderer: task lifecycle (#180)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useRealTimers();
    });

    it('applies a result that completed while the form was closed, and reports it applied', () => {
        const onChange = jest.fn();
        const onResultApplied = jest.fn();
        const onTaskChange = jest.fn();
        const completed = task({ status: 'Completed', outputJson: JSON.stringify({ regionId: 'tempregion_worldtask_41' }) });

        render(
            <WorldBoundFieldRenderer field={regionField} value={null} onChange={onChange} taskType="WgRegionId"
                workflowSessionId={7} initialTask={completed} onResultApplied={onResultApplied} onTaskChange={onTaskChange} />
        );

        expect(onChange).toHaveBeenCalledWith('tempregion_worldtask_41');
        expect(onResultApplied).toHaveBeenCalledWith(completed);
        expect(onTaskChange).toHaveBeenCalledWith(expect.objectContaining({ id: 41, appliedAt: expect.any(String) }));
        expect(screen.getByText(/Task completed!/)).toBeInTheDocument();
    });

    it('does not apply a result that is already in the draft', () => {
        const onChange = jest.fn();
        render(
            <WorldBoundFieldRenderer field={regionField} value="tempregion_worldtask_41" onChange={onChange} taskType="WgRegionId"
                workflowSessionId={7}
                initialTask={task({ status: 'Completed', outputJson: '{"regionId":"x"}', appliedAt: '2026-11-01T12:05:00Z' })} />
        );

        expect(onChange).not.toHaveBeenCalled();
        expect(screen.getByRole('button', { name: /Replace via Minecraft/i })).toBeInTheDocument();
    });

    it('reattaches to a waiting task with its task code, and Cancel task ends it with "Start again"', async () => {
        (worldTaskClient.cancel as jest.Mock).mockResolvedValue(task({ status: 'Cancelled', errorMessage: 'Cancelled in the web app.' }));
        const onTaskChange = jest.fn();
        render(
            <WorldBoundFieldRenderer field={regionField} value={null} onChange={jest.fn()} taskType="WgRegionId"
                workflowSessionId={7} initialTask={task({})} onTaskChange={onTaskChange} />
        );

        expect(screen.queryByText('Task code:')).not.toBeInTheDocument(); // #240: only the command
        expect(screen.getByText('/knk task AB12CD')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Cancel task' }));

        expect(await screen.findByText(/Task cancelled/)).toBeInTheDocument();
        expect(worldTaskClient.cancel).toHaveBeenCalledWith(41, expect.objectContaining({ reason: expect.any(String) }));
        expect(onTaskChange).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'Cancelled' }));

        fireEvent.click(screen.getByRole('button', { name: 'Start again' }));
        expect(screen.getByRole('button', { name: /Send to Minecraft/i })).toBeInTheDocument();
        expect(onTaskChange).toHaveBeenLastCalledWith(null);
        // A closed task is not cancelled again.
        expect(worldTaskClient.cancel).toHaveBeenCalledTimes(1);
    });

    it('a claimed task can be cancelled from the web app (a stuck InProgress has a way out)', () => {
        render(
            <WorldBoundFieldRenderer field={regionField} value={null} onChange={jest.fn()} taskType="WgRegionId"
                workflowSessionId={7}
                initialTask={task({ status: 'InProgress', claimedByMinecraftUsername: 'Steve', claimedByServerId: 'survival-1' })} />
        );

        expect(screen.getByText(/Claimed by:/)).toHaveTextContent('Steve on survival-1');
        expect(screen.getByRole('button', { name: 'Cancel task' })).toBeInTheDocument();
    });

    it('shows Expired and stops polling once the task is closed', async () => {
        jest.useFakeTimers();
        (worldTaskClient.getById as jest.Mock).mockResolvedValue(task({ status: 'Expired', errorMessage: 'Expired: nobody claimed it within 30 minutes.' }));
        render(
            <WorldBoundFieldRenderer field={regionField} value={null} onChange={jest.fn()} taskType="WgRegionId"
                workflowSessionId={7} initialTask={task({})} />
        );

        await act(async () => { jest.advanceTimersByTime(2100); });
        await act(async () => { await Promise.resolve(); });

        expect(screen.getByText(/Task expired/)).toBeInTheDocument();
        expect(screen.getByText('Expired: nobody claimed it within 30 minutes.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Start again' })).toBeInTheDocument();
        const calls = (worldTaskClient.getById as jest.Mock).mock.calls.length;
        await act(async () => { jest.advanceTimersByTime(10000); });
        expect((worldTaskClient.getById as jest.Mock).mock.calls.length).toBe(calls);
        jest.useRealTimers();
    });

    it('anchors a new task to the draft the form saves first', async () => {
        const ensureTaskAnchor = jest.fn().mockResolvedValue({ workflowSessionId: 9, formSubmissionProgressId: 55 });
        (worldTaskClient.create as jest.Mock).mockResolvedValue(task({ id: 42, workflowSessionId: 9 }));
        render(
            <WorldBoundFieldRenderer field={regionField} value={null} onChange={jest.fn()} taskType="WgRegionId"
                workflowSessionId={7} ensureTaskAnchor={ensureTaskAnchor} />
        );

        fireEvent.click(screen.getByRole('button', { name: /Send to Minecraft/i }));

        await waitFor(() => expect(worldTaskClient.create).toHaveBeenCalled());
        expect(ensureTaskAnchor).toHaveBeenCalled();
        expect(worldTaskClient.create).toHaveBeenCalledWith(expect.objectContaining({
            workflowSessionId: 9, formSubmissionProgressId: 55, fieldName: 'WgRegionId'
        }));
    });

    it('Try Again on a failed task starts over without cancelling anything', () => {
        render(
            <WorldBoundFieldRenderer field={regionField} value={null} onChange={jest.fn()} taskType="WgRegionId"
                workflowSessionId={7}
                initialTask={task({ status: 'Failed', errorMessage: "This game server has no handler for task type 'VerifyLocation'." })} />
        );

        expect(screen.getByText(/no handler for task type/)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));

        expect(screen.getByRole('button', { name: /Send to Minecraft/i })).toBeInTheDocument();
        expect(worldTaskClient.cancel).not.toHaveBeenCalled();
    });
});
