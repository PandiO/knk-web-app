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

  it('validates numeric fields', () => {
    expect(gateConfig.fields.domainId.validation?.(0)).toBe('Domain ID must be a positive number');
    expect(gateConfig.fields.districtId.validation?.(0)).toBe('District ID must be a positive number');
    expect(gateConfig.fields.animationDurationTicks.validation?.(0)).toBe('Duration must be at least 1 tick');
    expect(gateConfig.fields.animationTickRate.validation?.(6)).toBe('Tick rate must be between 1 and 5');
    expect(gateConfig.fields.healthMax.validation?.(0)).toBe('Health must be greater than 0');
  });

  it('validates anchor point JSON when provided', () => {
    expect(gateConfig.fields.anchorPoint.validation?.('{"x":0,"y":64,"z":0}')).toBeUndefined();
    expect(gateConfig.fields.anchorPoint.validation?.('{invalid')).toBe(
      'Anchor point must be JSON with x, y, z values'
    );
  });
});
