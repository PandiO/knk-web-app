import {
    cancelOpenTasks,
    isClosedWorldTask,
    isOpenWorldTask,
    needsApplying,
    resolveWorkflowSessionId,
    taskCodeCommand,
    tasksByField,
} from '../worldTaskLifecycle';
import { DEFAULT_WORLD_TASK_TYPE, WORLD_TASK_TYPES_WITH_HANDLER, hasWorldTaskHandler } from '../worldTaskTypes';
import { worldTaskClient } from '../../../apiClients/worldTaskClient';
import { workflowClient } from '../../../apiClients/workflowClient';
import { formSubmissionClient } from '../../../apiClients/formSubmissionClient';
import { WorldTaskReadDto } from '../../../types/dtos/workflow/WorkflowDtos';

jest.mock('../../../apiClients/worldTaskClient', () => ({ worldTaskClient: { cancel: jest.fn() } }));
jest.mock('../../../apiClients/workflowClient', () => ({ workflowClient: { getById: jest.fn(), createSession: jest.fn() } }));
jest.mock('../../../apiClients/formSubmissionClient', () => ({ formSubmissionClient: { getById: jest.fn() } }));

const task = (id: number, status: string, extra: Partial<WorldTaskReadDto> = {}): WorldTaskReadDto =>
    ({ id, workflowSessionId: 1, taskType: 'LocationSelection', status, createdAt: '', ...extra });

/** PandiO/knk-workspace#180: world-task states, the draft's latest task per field, and one session per draft. */
describe('worldTaskLifecycle (#180)', () => {
    beforeEach(() => jest.clearAllMocks());

    it('tells open from closed tasks and what still needs applying', () => {
        expect(isOpenWorldTask(task(1, 'Pending'))).toBe(true);
        expect(isOpenWorldTask(task(1, 'InProgress'))).toBe(true);
        expect(isClosedWorldTask(task(1, 'Expired'))).toBe(true);
        expect(isClosedWorldTask(task(1, 'Cancelled'))).toBe(true);
        expect(isOpenWorldTask(task(1, 'Completed'))).toBe(false);
        expect(needsApplying(task(1, 'Completed', { outputJson: '{}' }))).toBe(true);
        expect(needsApplying(task(1, 'Completed', { outputJson: '{}', appliedAt: 'x' }))).toBe(false);
        expect(needsApplying(task(1, 'InProgress', { outputJson: '{}' }))).toBe(false);
        expect(taskCodeCommand('AB12CD')).toBe('/knk task AB12CD');
    });

    it('keeps the newest task per field', () => {
        const byField = tasksByField([
            task(3, 'Cancelled', { fieldName: 'Location' }),
            task(5, 'Pending', { fieldName: 'Location' }),
            task(4, 'Completed', { fieldName: 'WgRegionId' }),
            task(6, 'Pending'),
        ]);
        expect(byField.Location.id).toBe(5);
        expect(byField.WgRegionId.id).toBe(4);
        expect(Object.keys(byField)).toHaveLength(2);
    });

    it('cancels only the open tasks when the form is left, and survives refusals', async () => {
        (worldTaskClient.cancel as jest.Mock).mockRejectedValueOnce({ status: 409 }).mockResolvedValue({});

        await cancelOpenTasks([task(1, 'Pending'), task(2, 'InProgress'), task(3, 'Completed'), task(4, 'Expired')], 'left');

        expect(worldTaskClient.cancel).toHaveBeenCalledTimes(2);
        expect(worldTaskClient.cancel).toHaveBeenCalledWith(1, { reason: 'left' });
        expect(worldTaskClient.cancel).toHaveBeenCalledWith(2, { reason: 'left' });
    });

    it('reuses a resumed draft\'s session, and starts one when there is none (or it is gone)', async () => {
        (formSubmissionClient.getById as jest.Mock).mockResolvedValue({ id: '40', workflowSessionId: 21 });
        (workflowClient.getById as jest.Mock).mockResolvedValue({ id: 21 });
        (workflowClient.createSession as jest.Mock).mockResolvedValue({ id: 99 });

        expect(await resolveWorkflowSessionId({ progressId: '40', entityTypeName: 'Town' })).toBe(21);
        expect(workflowClient.createSession).not.toHaveBeenCalled();

        (workflowClient.getById as jest.Mock).mockRejectedValueOnce({ status: 404 });
        expect(await resolveWorkflowSessionId({ progressId: '40', entityTypeName: 'Town' })).toBe(99);

        expect(await resolveWorkflowSessionId({ entityTypeName: 'Town', formConfigurationId: 3 })).toBe(99);
        expect(workflowClient.createSession).toHaveBeenLastCalledWith({ formConfigurationId: 3, entityTypeName: 'Town', entityId: undefined });

        (workflowClient.createSession as jest.Mock).mockRejectedValueOnce({ status: 403 });
        expect(await resolveWorkflowSessionId({ entityTypeName: 'Town' })).toBeUndefined();
    });

    it('offers only task types the game server has a handler for', () => {
        expect(WORLD_TASK_TYPES_WITH_HANDLER).toEqual(expect.arrayContaining(['LocationSelection', 'ItemScan', 'KitScan', 'GateBlockScan']));
        expect(hasWorldTaskHandler('VerifyLocation')).toBe(false);
        expect(hasWorldTaskHandler('Custom')).toBe(false);
        expect(DEFAULT_WORLD_TASK_TYPE).toBe('LocationSelection');
    });
});
