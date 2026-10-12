import { keepLocationIdOnReplace, spreadTaskValueOntoFields } from '../worldTaskFieldValue';

const CAPTURED = { name: 'Location', x: 1, y: 2, z: 3, yaw: 0, pitch: 0, World: 'world' };

describe('keepLocationIdOnReplace (KNG-134)', () => {
    it('keeps the id of the Location the field held', () => {
        expect(keepLocationIdOnReplace({ id: 83, name: 'Old', x: 9, y: 9, z: 9 }, CAPTURED))
            .toEqual({ ...CAPTURED, id: 83 });
    });

    it('leaves a first capture (nothing held) as it is', () => {
        expect(keepLocationIdOnReplace(null, CAPTURED)).toBe(CAPTURED);
        expect(keepLocationIdOnReplace(undefined, CAPTURED)).toBe(CAPTURED);
    });

    it('leaves the capture as it is when the held Location has no id or the unsaved -1', () => {
        expect(keepLocationIdOnReplace({ name: 'Captured before', x: 1, y: 1, z: 1 }, CAPTURED)).toBe(CAPTURED);
        expect(keepLocationIdOnReplace({ id: -1 }, CAPTURED)).toBe(CAPTURED);
    });

    it('does not touch non-object results or a held value that is not an object', () => {
        expect(keepLocationIdOnReplace({ id: 83 }, 'region_1')).toBe('region_1');
        expect(keepLocationIdOnReplace('Gate spawn', CAPTURED)).toBe(CAPTURED);
        expect(keepLocationIdOnReplace([{ id: 1 }], CAPTURED)).toBe(CAPTURED);
    });
});

describe('spreadTaskValueOntoFields (KNG-134, inherited world task)', () => {
    const fields = [{ fieldName: 'Name' }, { fieldName: 'X' }, { fieldName: 'Y' }, { fieldName: 'Z' }, { fieldName: 'World' }];

    it('spreads a Location capture over the fields of the same name', () => {
        expect(spreadTaskValueOntoFields(CAPTURED, fields)).toEqual({ Name: 'Location', X: 1, Y: 2, Z: 3, World: 'world' });
    });

    it('returns null for a scalar result or when no key matches a field', () => {
        expect(spreadTaskValueOntoFields('region_1', fields)).toBeNull();
        expect(spreadTaskValueOntoFields({ regionId: 'r' }, fields)).toBeNull();
        expect(spreadTaskValueOntoFields(null, fields)).toBeNull();
    });
});
