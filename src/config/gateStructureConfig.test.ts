import { objectConfigs } from './objectConfigs';

const gateConfig = objectConfigs.gatestructure;

describe('GateStructureConfig', () => {
  it('defines gate type selector options', () => {
    const gateTypeField = gateConfig.fields.gateType;
    expect(gateTypeField.type).toBe('select');
    expect(gateTypeField.options?.map(option => option.value)).toEqual([
      'SLIDING',
      'TRAP',
      'DRAWBRIDGE',
      'DOUBLE_DOORS'
    ]);
  });

  it('defines tile entity and health display selectors', () => {
    const tileEntityPolicyField = gateConfig.fields.tileEntityPolicy;
    expect(tileEntityPolicyField.type).toBe('select');
    expect(tileEntityPolicyField.options?.map(option => option.value)).toEqual([
      'NONE',
      'DECORATIVE_ONLY',
      'ALL'
    ]);

    const healthDisplayModeField = gateConfig.fields.healthDisplayMode;
    expect(healthDisplayModeField.type).toBe('select');
    expect(healthDisplayModeField.options?.map(option => option.value)).toEqual([
      'ALWAYS',
      'DAMAGED_ONLY',
      'NEVER',
      'SIEGE_ONLY'
    ]);
  });

  it('validates numeric fields', () => {
    expect(gateConfig.fields.domainId.validation?.(0)).toBe('Domain ID must be a positive number');
    expect(gateConfig.fields.districtId.validation?.(0)).toBe('District ID must be a positive number');
    expect(gateConfig.fields.animationDurationTicks.validation?.(0)).toBe('Duration must be at least 1 tick');
    expect(gateConfig.fields.animationTickRate.validation?.(6)).toBe('Tick rate must be between 1 and 5');
    expect(gateConfig.fields.healthMax.validation?.(0)).toBe('Health must be greater than 0');
  });

  it('uses location object fields for gate coordinate references', () => {
    expect(gateConfig.fields.anchorPoint.type).toBe('object');
    expect(gateConfig.fields.referencePoint1.type).toBe('object');
    expect(gateConfig.fields.referencePoint2.type).toBe('object');
    expect(gateConfig.fields.hingeAxis.type).toBe('object');
    expect(gateConfig.fields.leftDoorSeedBlock.type).toBe('object');
    expect(gateConfig.fields.rightDoorSeedBlock.type).toBe('object');
  });
});
