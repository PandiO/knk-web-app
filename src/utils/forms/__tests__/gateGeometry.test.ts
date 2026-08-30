import { deriveGateGeometryStepData, isDerivedGateGeometryField } from '../gateGeometry';

describe('gate geometry derivation', () => {
    it('calculates inclusive width and height spans from the plane-grid locations', () => {
        const result = deriveGateGeometryStepData('GateStructure', {
            AnchorPointId: { x: 0, y: 64, z: 0, World: 'world' },
            ReferencePoint1Id: { x: 3, y: 64, z: 4, World: 'world' },
            ReferencePoint2Id: { x: 0, y: 70, z: 0, World: 'world' },
            GeometryDepth: 3
        });

        expect(result.GeometryWidth).toBe(6);
        expect(result.GeometryHeight).toBe(7);
        expect(result.GeometryDepth).toBe(3);
    });

    it('supports case-insensitive coordinates and JSON-restored locations', () => {
        const result = deriveGateGeometryStepData('GateStructure', {
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

        expect(deriveGateGeometryStepData('GateStructure', data)).toBe(data);
    });

    it('does not treat missing coordinate values as zero', () => {
        const data = {
            AnchorPointId: { x: null, y: 64, z: 0 },
            ReferencePoint1Id: { x: 5, y: 64, z: 0 },
            GeometryWidth: 4
        };

        expect(deriveGateGeometryStepData('GateStructure', data)).toBe(data);
    });

    it('marks only dimensions backed by valid point pairs as derived', () => {
        const data = {
            AnchorPointId: { x: 0, y: 64, z: 0 },
            ReferencePoint1Id: { x: 5, y: 64, z: 0 },
            ReferencePoint2Id: { x: 0, y: 71, z: 0 }
        };

        expect(isDerivedGateGeometryField('GateStructure', 'GeometryWidth', data)).toBe(true);
        expect(isDerivedGateGeometryField('GateStructure', 'GeometryHeight', data)).toBe(true);
        expect(isDerivedGateGeometryField('GateStructure', 'GeometryDepth', data)).toBe(false);
    });
});