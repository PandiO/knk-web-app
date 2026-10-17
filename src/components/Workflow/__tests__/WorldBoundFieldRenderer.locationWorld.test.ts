import { extractTaskResult } from '../WorldBoundFieldRenderer';
import { WorldTaskReadDto } from '../../../types/dtos/workflow/WorkflowDtos';

// KNG-118 (U2): a Location capture keeps the world the plugin reported and never invents 'world'.
const locationTask = (output: Record<string, unknown>): WorldTaskReadDto => ({
    id: 1,
    workflowSessionId: 2,
    taskType: 'LocationSelection',
    status: 'Completed',
    outputJson: JSON.stringify(output),
    createdAt: '2026-10-15T10:00:00Z'
});

describe('extractTaskResult for a Location capture', () => {
    it('keeps the captured world, whatever the key casing', () => {
        expect(extractTaskResult(locationTask({ x: 1, y: 2, z: 3, World: 'hub' }), 'LocationSelection').World).toBe('hub');
        expect(extractTaskResult(locationTask({ x: 1, y: 2, z: 3, world: 'hub' }), 'LocationSelection').World).toBe('hub');
        expect(extractTaskResult(locationTask({ x: 1, y: 2, z: 3, worldName: ' gameplay ' }), 'LocationSelection').World).toBe('gameplay');
    });

    it('refuses a capture without a world instead of defaulting to "world"', () => {
        jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        expect(extractTaskResult(locationTask({ x: 1, y: 2, z: 3 }), 'LocationSelection')).toBeNull();
        expect(extractTaskResult(locationTask({ x: 1, y: 2, z: 3, World: '  ' }), 'LocationSelection')).toBeNull();
    });
});
