import { objectConfigs } from './objectConfigs';

const doorConfig = objectConfigs.gatedoor;

describe('GateDoorConfig', () => {
  it('defines gate type selector options', () => {
    const gateTypeField = doorConfig.fields.gateType;
    expect(gateTypeField.type).toBe('select');
    expect(gateTypeField.options?.map(option => option.value)).toEqual([
      'SLIDING',
      'TRAP',
      'DRAWBRIDGE',
      'DOUBLE_DOORS'
    ]);
  });

  it('defines face direction options using the backend GateFaceDirection enum values', () => {
    // Backend converted FaceDirection from a free-form lowercase-hyphenated string to a proper
    // GateFaceDirection enum (uppercase-underscore) as part of item 5 - see
    // GATESTRUCTURE_QOL_IMPLEMENTATION_PLAN.md item 5's status notes.
    const faceDirectionField = doorConfig.fields.faceDirection;
    expect(faceDirectionField.type).toBe('select');
    expect(faceDirectionField.options?.map(option => option.value)).toEqual([
      'NORTH',
      'NORTH_EAST',
      'EAST',
      'SOUTH_EAST',
      'SOUTH',
      'SOUTH_WEST',
      'WEST',
      'NORTH_WEST'
    ]);
  });

  it('defines tile entity and health display selectors', () => {
    const tileEntityPolicyField = doorConfig.fields.tileEntityPolicy;
    expect(tileEntityPolicyField.type).toBe('select');
    expect(tileEntityPolicyField.options?.map(option => option.value)).toEqual([
      'NONE',
      'DECORATIVE_ONLY',
      'ALL'
    ]);

    const healthDisplayModeField = doorConfig.fields.healthDisplayMode;
    expect(healthDisplayModeField.type).toBe('select');
    expect(healthDisplayModeField.options?.map(option => option.value)).toEqual([
      'ALWAYS',
      'DAMAGED_ONLY',
      'NEVER',
      'SIEGE_ONLY'
    ]);
  });

  it('defines the new door-name display mode selector (decision 5.0-D)', () => {
    const doorNameDisplayModeField = doorConfig.fields.doorNameDisplayMode;
    expect(doorNameDisplayModeField.type).toBe('select');
    expect(doorNameDisplayModeField.options?.map(option => option.value)).toEqual([
      'ALWAYS',
      'NEVER',
      'SIEGE_ONLY'
    ]);
  });

  it('requires a positive gateStructureId linking the door to its parent structure', () => {
    expect(doorConfig.fields.gateStructureId.type).toBe('number');
    expect(doorConfig.fields.gateStructureId.validation?.(0)).toBe('Gate Structure ID must be a positive number');
  });

  it('validates numeric fields', () => {
    expect(doorConfig.fields.animationDurationTicks.validation?.(0)).toBe('Duration must be at least 1 tick');
    expect(doorConfig.fields.animationTickRate.validation?.(6)).toBe('Tick rate must be between 1 and 5');
    expect(doorConfig.fields.healthMax.validation?.(0)).toBe('Health must be greater than 0');
  });

  it('uses location object fields for gate coordinate references', () => {
    expect(doorConfig.fields.anchorPoint.type).toBe('object');
    expect(doorConfig.fields.referencePoint1.type).toBe('object');
    expect(doorConfig.fields.referencePoint2.type).toBe('object');
    expect(doorConfig.fields.hingeAxis.type).toBe('object');
    expect(doorConfig.fields.leftDoorSeedBlock.type).toBe('object');
    expect(doorConfig.fields.rightDoorSeedBlock.type).toBe('object');
  });
});
