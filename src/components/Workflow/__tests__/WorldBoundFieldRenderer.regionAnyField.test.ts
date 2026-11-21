import { extractTaskResult } from '../WorldBoundFieldRenderer';
import { WorldTaskReadDto } from '../../../types/dtos/workflow/WorkflowDtos';
import { hasWorldTaskHandler } from '../../../utils/forms/worldTaskTypes';

// PandiO/knk-workspace#944: the plugin's region handler now runs on any field (registered by task type), such as the
// Landmark form's RegionId. Its result (WgRegionIdTaskHandler.completeTask) still says fieldName WgRegionId.
const regionTask = (taskType: string, fieldName: string): WorldTaskReadDto => ({
    id: 42,
    workflowSessionId: 7,
    fieldName,
    taskType,
    status: 'Completed',
    outputJson: JSON.stringify({
        fieldName: 'WgRegionId',
        regionId: 'tempregion_worldtask_42',
        createdAt: 1,
        worldName: 'world'
    }),
    createdAt: '2026-11-21T12:00:00Z'
});

describe('a region world task on a field not named WgRegionId', () => {
    it.each(['ReagionCreate', 'RegionCreate', 'RegionClaim'])('fills the Landmark RegionId field with the drawn region (%s)', taskType => {
        expect(extractTaskResult(regionTask(taskType, 'RegionId'), taskType)).toBe('tempregion_worldtask_42');
    });

    it('still fills a WgRegionId field as before', () => {
        expect(extractTaskResult(regionTask('ReagionCreate', 'WgRegionId'), 'ReagionCreate')).toBe('tempregion_worldtask_42');
    });

    it('is offered by the form builder', () => {
        expect(hasWorldTaskHandler('ReagionCreate')).toBe(true);
        expect(hasWorldTaskHandler('RegionClaim')).toBe(true);
    });
});
