import { objectConfigs } from './objectConfigs';

const gateConfig = objectConfigs.gatestructure;

// Item 5 (docs/features/gate-structure-animation/GATESTRUCTURE_QOL_IMPLEMENTATION_PLAN.md) moved
// every per-door field (gateType, tileEntityPolicy, healthDisplayMode, anchorPoint, etc.) off
// this config onto GateDoorConfig - see gateDoorConfig.test.ts for that coverage.
describe('GateStructureConfig', () => {
  it('validates the district id field', () => {
    expect(gateConfig.fields.districtId.validation?.(0)).toBe('District ID must be a positive number');
  });

  it('uses a location array field for guard spawn locations', () => {
    expect(gateConfig.fields.guardSpawnLocations.type).toBe('array');
  });

  it('no longer defines per-door fields moved to GateDoorConfig', () => {
    expect(gateConfig.fields.gateType).toBeUndefined();
    expect(gateConfig.fields.anchorPoint).toBeUndefined();
    expect(gateConfig.fields.healthMax).toBeUndefined();
  });
});
