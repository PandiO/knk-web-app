import {
  defaultMenuItemSettings,
  menuItemSettingsErrors,
  menuItemSettingsPayload,
  normalizeMenuItemSettings,
} from '../menuItemSettings';

/** PandiO/knk-workspace#870: the Menu item card's defaults, inline checks and payload. */
describe('menuItemSettings', () => {
  it('defaults mirror the API seed: every click opens main, the siege overrides open the siege menu and shop', () => {
    const d = defaultMenuItemSettings();
    expect(d.material).toBe('NETHER_STAR');
    expect(d.slot).toBe(8);
    expect(Object.values(d.clicks).every(a => a.type === 'OpenMenu' && a.menuKey === 'main')).toBe(true);
    expect(Object.keys(d.clicks)).toHaveLength(5);
    expect(d.overrides['siege.match'].SHIFT_RIGHT_CLICK).toEqual({ type: 'OpenMenu', menuKey: 'siege.shop' });
    expect(d.overrides['siege.survival.match'].LEFT_CLICK).toEqual({ type: 'OpenMenu', menuKey: 'siege.information' });
    expect(Object.keys(d.overrides['siege.hub'])).toEqual(['LEFT_CLICK', 'RIGHT_CLICK']);
    expect(menuItemSettingsErrors(d)).toEqual([]);
  });

  it('normalize fills what an older API leaves out', () => {
    expect(normalizeMenuItemSettings(null)).toEqual(defaultMenuItemSettings());
    const partial = normalizeMenuItemSettings({ name: 'x' } as never);
    expect(partial.name).toBe('x');
    expect(partial.clicks).toEqual({});
    expect(partial.overrides).toEqual({});
  });

  it('lists what the API would refuse', () => {
    const bad = defaultMenuItemSettings();
    bad.material = 'nether star';
    bad.slot = 36;
    bad.lore = Array(21).fill('x');
    bad.clicks.LEFT_CLICK = { type: 'OpenMenu', menuKey: '' };
    bad.clicks.RIGHT_CLICK = { type: 'RunCommand', command: ' / ' };
    bad.overrides['siege.match'].SHIFT_RIGHT_CLICK = { type: 'OpenMenu', menuKey: 'Siege Shop' };

    expect(menuItemSettingsErrors(bad)).toEqual([
      'Material must be a material name such as NETHER_STAR.',
      'The lore has at most 20 lines.',
      'Slot must be 0 to 35.',
      'Left click: Open menu needs a menu key.',
      'Right click: Run command needs a command.',
      'Siege match, Shift + right click: "Siege Shop" is not a menu key (lower case letters, digits, ".", "_" and "-", such as siege.shop).',
    ]);
  });

  it('an empty slot field is refused, a lower-case material is fine', () => {
    const value = { ...defaultMenuItemSettings(), slot: Number.NaN, material: 'compass' };
    expect(menuItemSettingsErrors(value)).toEqual(['Slot must be 0 to 35.']);
  });

  it('the payload drops empty overrides and upper-cases the material', () => {
    const value = { ...defaultMenuItemSettings(), material: ' compass ' };
    value.overrides = { ...value.overrides, 'siege.hub': {} };
    const payload = menuItemSettingsPayload(value);
    expect(payload.material).toBe('COMPASS');
    expect(Object.keys(payload.overrides)).toEqual(['siege.match', 'siege.survival.match']);
  });
});
