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

    it('KNG-167: keeps a custom Name and updates the coordinates and world', () => {
        const current = { Name: 'Gate spawn', X: 9, Y: 9, Z: 9, World: 'old' };
        expect(spreadTaskValueOntoFields(CAPTURED, fields, current)).toEqual({ X: 1, Y: 2, Z: 3, World: 'world' });
    });

    it('KNG-167: fills an empty Name from the capture', () => {
        expect(spreadTaskValueOntoFields(CAPTURED, fields, { Name: '' })).toEqual({ Name: 'Location', X: 1, Y: 2, Z: 3, World: 'world' });
        expect(spreadTaskValueOntoFields(CAPTURED, fields, { Name: '   ', X: 5 })).toEqual({ Name: 'Location', X: 1, Y: 2, Z: 3, World: 'world' });
        expect(spreadTaskValueOntoFields(CAPTURED, fields, { name: null })).toEqual({ Name: 'Location', X: 1, Y: 2, Z: 3, World: 'world' });
    });

    it('KNG-167: updates Yaw and Pitch fields too', () => {
        const withRotation = [...fields, { fieldName: 'Yaw' }, { fieldName: 'Pitch' }];
        expect(spreadTaskValueOntoFields({ ...CAPTURED, yaw: 90, pitch: -10 }, withRotation, { Name: 'Keep', Yaw: 0, Pitch: 0 }))
            .toEqual({ X: 1, Y: 2, Z: 3, World: 'world', Yaw: 90, Pitch: -10 });
    });

    it('KNG-167: returns an empty patch (not null) when only a kept Name matched', () => {
        expect(spreadTaskValueOntoFields({ name: 'Location' }, [{ fieldName: 'Name' }], { Name: 'Mine' })).toEqual({});
    });

    it('returns null for a scalar result or when no key matches a field', () => {
        expect(spreadTaskValueOntoFields('region_1', fields)).toBeNull();
        expect(spreadTaskValueOntoFields({ regionId: 'r' }, fields)).toBeNull();
        expect(spreadTaskValueOntoFields(null, fields)).toBeNull();
    });
});
