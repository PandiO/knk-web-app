import {
    deriveGateGeometryStepData,
    gateGeometryFieldError,
    gateReferencePoint2Error,
    isDerivedGateGeometryField
} from '../gateGeometry';

describe('gate geometry derivation', () => {
    it('calculates inclusive width and height spans from the plane-grid locations', () => {
        const result = deriveGateGeometryStepData('GateDoor', {
            AnchorPointId: { x: 0, y: 64, z: 0, World: 'world' },
            ReferencePoint1Id: { x: 3, y: 64, z: 4, World: 'world' },
            ReferencePoint2Id: { x: 0, y: 70, z: 0, World: 'world' },
            GeometryDepth: 3
        });

        // (3,0,4) has gcd 1, i.e. one lattice hop (2 blocks inclusive) - not the Euclidean
        // distance of 5 blocks a naive sqrt(3^2+4^2) calculation would suggest.
        expect(result.GeometryWidth).toBe(2);
        expect(result.GeometryHeight).toBe(7);
        expect(result.GeometryDepth).toBe(3);
    });

    it('calculates the correct span for a 45-degree diagonal reference point', () => {
        // Regression test for GateStructure 14: a (3,0,-3) diagonal delta is 3 lattice hops
        // (4 blocks inclusive), not sqrt(18) ~= 4.24 rounded to 4 (5 blocks) under the old
        // Euclidean-distance calculation, which caused the scan to swallow an extra block
        // one step past the real structure.
        const result = deriveGateGeometryStepData('GateDoor', {
            AnchorPointId: { x: 1375, y: 44, z: -585, World: 'world' },
            ReferencePoint1Id: { x: 1378, y: 44, z: -588, World: 'world' }
        });

        expect(result.GeometryWidth).toBe(4);
    });

    it('supports case-insensitive coordinates and JSON-restored locations', () => {
        const result = deriveGateGeometryStepData('GateDoor', {
            AnchorPointId: JSON.stringify({ X: 100, Y: 64, Z: 100, World: 'WORLD' }),
            ReferencePoint1Id: { x: 105, y: 64, z: 100, world: 'world' },
            ReferencePoint2Id: { X: 100, Y: 71, Z: 100, World: 'world' }
        });

        expect(result.GeometryWidth).toBe(6);
        expect(result.GeometryHeight).toBe(8);
    });

    it('leaves dimensions unchanged when locations are invalid or in different worlds', () => {
        const data = {
            AnchorPointId: { x: 0, y: 64, z: 0, World: 'world' },
            ReferencePoint1Id: { x: 5, y: 64, z: 0, World: 'world_nether' },
            GeometryWidth: 4,
            GeometryHeight: 8,
            GeometryDepth: 2
        };

        expect(deriveGateGeometryStepData('GateDoor', data)).toBe(data);
    });

    it('does not treat missing coordinate values as zero', () => {
        const data = {
            AnchorPointId: { x: null, y: 64, z: 0 },
            ReferencePoint1Id: { x: 5, y: 64, z: 0 },
            GeometryWidth: 4
        };

        expect(deriveGateGeometryStepData('GateDoor', data)).toBe(data);
    });

    it('marks only dimensions backed by valid point pairs as derived', () => {
        const data = {
            AnchorPointId: { x: 0, y: 64, z: 0 },
            ReferencePoint1Id: { x: 5, y: 64, z: 0 },
            ReferencePoint2Id: { x: 0, y: 71, z: 0 }
        };

        expect(isDerivedGateGeometryField('GateDoor', 'GeometryWidth', data)).toBe(true);
        expect(isDerivedGateGeometryField('GateDoor', 'GeometryHeight', data)).toBe(true);
        expect(isDerivedGateGeometryField('GateDoor', 'GeometryDepth', data)).toBe(false);
    });
});

// KNG-132: the developer's door - Reference point 2 put above Reference point 1 instead of the anchor.
describe('gate reference point 2 check', () => {
    const anchor = { x: -972, y: 114, z: 1653, world: 'knk_hub' };
    const ref1 = { x: -972, y: 114, z: 1651, world: 'knk_hub' };
    const aboveRef1 = { x: -972, y: 121, z: 1651, world: 'knk_hub' };
    const aboveAnchor = { x: -972, y: 121, z: 1653, world: 'knk_hub' };

    it('refuses a Ref 2 above Ref 1 and names where it should be', () => {
        const stepData = { AnchorPointId: anchor, ReferencePoint1Id: ref1, ReferencePoint2Id: aboveRef1 };

        const error = gateReferencePoint2Error('GateDoor', stepData);

        expect(error).toContain('straight above the anchor');
        expect(error).toContain('use (-972, 121, 1653) instead');
        expect(gateGeometryFieldError('GateDoor', 'ReferencePoint2Id', stepData)).toBe(error);
        expect(gateGeometryFieldError('GateDoor', 'ReferencePoint1Id', stepData)).toBeNull();
    });

    it('derives no height from it and leaves the height editable', () => {
        const stepData = { AnchorPointId: anchor, ReferencePoint1Id: ref1, ReferencePoint2Id: aboveRef1, GeometryHeight: 5 };

        const result = deriveGateGeometryStepData('GateDoor', stepData);

        expect(result.GeometryWidth).toBe(3);
        expect(result.GeometryHeight).toBe(5);
        expect(isDerivedGateGeometryField('GateDoor', 'GeometryHeight', stepData)).toBe(false);
    });

    it('accepts Ref 2 straight above the anchor: height 8', () => {
        const stepData = { AnchorPointId: anchor, ReferencePoint1Id: ref1, ReferencePoint2Id: aboveAnchor };

        expect(gateReferencePoint2Error('GateDoor', stepData)).toBeNull();
        expect(deriveGateGeometryStepData('GateDoor', stepData).GeometryHeight).toBe(8);
    });

    it('accepts a diagonal door whose height is still at right angles to its width', () => {
        expect(gateReferencePoint2Error('GateDoor', {
            AnchorPointId: { x: 1375, y: 44, z: -585 },
            ReferencePoint1Id: { x: 1378, y: 44, z: -588 },
            ReferencePoint2Id: { x: 1375, y: 50, z: -585 }
        })).toBeNull();
    });

    it('says only that the point is wrong when it is not above Ref 1 either', () => {
        const error = gateReferencePoint2Error('GateDoor', {
            AnchorPointId: anchor, ReferencePoint1Id: ref1, ReferencePoint2Id: { x: -972, y: 121, z: 1652 }
        });

        expect(error).toMatch(/This one is not\.$/);
    });

    it('waits until all three points are set, and only applies to gate doors', () => {
        expect(gateReferencePoint2Error('GateDoor', { AnchorPointId: anchor, ReferencePoint2Id: aboveRef1 })).toBeNull();
        expect(gateReferencePoint2Error('GateStructure', {
            AnchorPointId: anchor, ReferencePoint1Id: ref1, ReferencePoint2Id: aboveRef1
        })).toBeNull();
    });
});

