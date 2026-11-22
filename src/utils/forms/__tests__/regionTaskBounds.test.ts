import { isRegionTaskType, regionBoundsFromTaskOutput, regionBoundsPatch } from '../regionTaskBounds';

// PandiO/knk-workspace#951 (web part): a drawn region's bounding box fills the form's empty bounds.
const fields = ['WgRegionId', 'MinX', 'MinY', 'MinZ', 'MaxX', 'MaxY', 'MaxZ', 'Radius'].map(fieldName => ({ fieldName }));
const box = { minX: -10, minY: 60, minZ: 5, maxX: 20, maxY: 80, maxZ: 30 };

describe('region task bounds (#951)', () => {
    it('knows the region task types', () => {
        expect(['ReagionCreate', 'RegionCreate', 'RegionClaim'].every(isRegionTaskType)).toBe(true);
        expect(isRegionTaskType('LocationSelection')).toBe(false);
        expect(isRegionTaskType(undefined)).toBe(false);
    });

    it('reads the bounding box nested or at the top level, in any case', () => {
        expect(regionBoundsFromTaskOutput(JSON.stringify({ regionId: 'tempregion_worldtask_4', bounds: box }))).toEqual(box);
        expect(regionBoundsFromTaskOutput(JSON.stringify({ regionId: 'r', MinX: '-10', MinY: 60, MinZ: 5, MaxX: 20.4, MaxY: 80, MaxZ: 30 })))
            .toEqual(box);
    });

    it('reads nothing from a result without all six numbers', () => {
        expect(regionBoundsFromTaskOutput(JSON.stringify({ regionId: 'r' }))).toBeNull();
        expect(regionBoundsFromTaskOutput(JSON.stringify({ bounds: { ...box, maxZ: 'north' } }))).toBeNull();
        expect(regionBoundsFromTaskOutput('not json')).toBeNull();
        expect(regionBoundsFromTaskOutput(null)).toBeNull();
    });

    it('fills only the empty bound fields and keeps what staff typed', () => {
        expect(regionBoundsPatch(box, fields, { MinX: 3, MaxY: '', MinY: null }))
            .toEqual({ MinY: 60, MinZ: 5, MaxX: 20, MaxY: 80, MaxZ: 30 });
        expect(regionBoundsPatch(null, fields, {})).toEqual({});
        expect(regionBoundsPatch(box, [{ fieldName: 'Name' }], {})).toEqual({});
    });
});
