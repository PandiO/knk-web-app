import { extractTaskResult, getWorldTaskResultDetails, siegeWeaponSpotBounds } from '../WorldBoundFieldRenderer';
import { WorldTaskReadDto } from '../../../types/dtos/workflow/WorkflowDtos';
import { hasWorldTaskHandler } from '../../../utils/forms/worldTaskTypes';

// PandiO/knk-workspace#799: the SiegeWeaponSpot result the plugin completes the spot form's Min X task with.
const output = {
    fieldName: 'SiegeWeaponSpot', status: 'Success',
    minX: 0, minY: 64, minZ: 0, maxX: 6, maxY: 68, maxZ: 8,
    facing: 'North', sizeClass: 'Small', wgRegionId: null, world: 'siege', warnings: [], capturedAt: 1
};

const spotTask = (result: Record<string, unknown>): WorldTaskReadDto => ({
    id: 1,
    workflowSessionId: 2,
    fieldName: 'MinX',
    taskType: 'SiegeWeaponSpot',
    status: 'Completed',
    outputJson: JSON.stringify(result),
    createdAt: '2026-11-19T10:00:00Z'
});

describe('the SiegeWeaponSpot world task result', () => {
    it('gives the bound Min X field its value, also when min X is 0', () => {
        expect(extractTaskResult(spotTask(output), 'SiegeWeaponSpot')).toBe(0);
        expect(extractTaskResult(spotTask({ ...output, minX: -12 }), 'SiegeWeaponSpot')).toBe(-12);
    });

    it('is not used without all six whole-number bounds', () => {
        const { maxZ, ...missing } = output;
        expect(maxZ).toBe(8);
        expect(extractTaskResult(spotTask(missing), 'SiegeWeaponSpot')).toBeNull();
        expect(extractTaskResult(spotTask({ ...output, minY: 'high' }), 'SiegeWeaponSpot')).toBeNull();
        expect(siegeWeaponSpotBounds({ ...output, maxX: 6.5 })).toBeNull();
        expect(siegeWeaponSpotBounds({ ...output, maxX: null })).toBeNull();
    });

    it('lists bounds, facing, size class and region in the result details', () => {
        const details = getWorldTaskResultDetails(spotTask({ ...output, wgRegionId: 'spot_north' }), 'SiegeWeaponSpot');
        expect(details).toEqual([
            { label: 'Bounds', value: '(0, 64, 0) to (6, 68, 8)' },
            { label: 'Facing', value: 'North' },
            { label: 'Size class', value: 'Small' },
            { label: 'Region', value: 'spot_north' },
            { label: 'World', value: 'siege' }
        ]);
    });

    it('is a type the form builder offers', () => {
        expect(hasWorldTaskHandler('SiegeWeaponSpot')).toBe(true);
    });
});
