import {
  emptyProfileDraft,
  formatShare,
  parseProfileDraft,
  profileToDraft,
  toMaterialKey,
} from '../roadProfileForm';
import { RoadProfileDto } from '../../../../types/dtos/road/RoadDtos';

const profile: RoadProfileDto = {
  id: 3,
  name: 'Kardenna main street',
  roadClass: 'Main',
  costMultiplier: 0.8,
  materials: [
    { material: 'STONE_BRICKS', role: 'Surface', ambiguous: true, centreShare: 0.7, edgeShare: 0.1, samples: 700 },
    { material: 'GRAVEL', role: 'Edge', ambiguous: false, centreShare: 0.05, edgeShare: 0.6, samples: 300 },
  ],
  widthMin: 3,
  widthMax: 7,
  sampleCount: 1000,
  enabled: true,
  scopeTownIds: [4],
  stats: { version: 1 },
  createdAt: '2026-09-27T10:00:00Z',
  updatedAt: '2026-09-27T12:00:00Z',
};

describe('toMaterialKey', () => {
  it('turns catalogue keys and free text into Bukkit material names', () => {
    expect(toMaterialKey('minecraft:stone_bricks')).toBe('STONE_BRICKS');
    expect(toMaterialKey(' stone bricks ')).toBe('STONE_BRICKS');
    expect(toMaterialKey('Gravel')).toBe('GRAVEL');
    expect(toMaterialKey('')).toBe('');
  });
});

describe('profileToDraft', () => {
  it('copies a profile into the editor, numbers as text, scope as a list', () => {
    expect(profileToDraft(profile)).toEqual({
      name: 'Kardenna main street',
      roadClass: 'Main',
      costMultiplier: '0.8',
      widthMin: '3',
      widthMax: '7',
      enabled: true,
      scopeTownIds: [4],
      materials: profile.materials,
      sampleCount: 1000,
    });
  });

  it('treats an empty scope as everywhere', () => {
    expect(profileToDraft({ ...profile, scopeTownIds: [] }).scopeTownIds).toBeNull();
    expect(profileToDraft({ ...profile, scopeTownIds: null }).scopeTownIds).toBeNull();
  });
});

describe('parseProfileDraft', () => {
  it('turns a valid draft into the upsert body, keeping the stats (stats: null)', () => {
    const draft = { ...profileToDraft(profile), costMultiplier: '1.5', enabled: false };
    draft.materials = [...draft.materials, { material: 'minecraft:dirt_path', role: 'Accent', ambiguous: false, centreShare: 0, edgeShare: 0, samples: 0 }];
    expect(parseProfileDraft(draft)).toEqual({
      errors: [],
      value: {
        name: 'Kardenna main street',
        roadClass: 'Main',
        costMultiplier: 1.5,
        materials: [
          profile.materials[0],
          profile.materials[1],
          { material: 'DIRT_PATH', role: 'Accent', ambiguous: false, centreShare: 0, edgeShare: 0, samples: 0 },
        ],
        widthMin: 3,
        widthMax: 7,
        sampleCount: 1000,
        enabled: false,
        scopeTownIds: [4],
        stats: null,
      },
    });
  });

  it('gives a hand-made profile the defaults the builder needs', () => {
    const parsed = parseProfileDraft({ ...emptyProfileDraft(), name: 'Trail' });
    expect(parsed.errors).toEqual([]);
    expect(parsed.value).toMatchObject({ name: 'Trail', roadClass: 'Road', costMultiplier: 1, widthMin: 1, widthMax: 15, enabled: true, scopeTownIds: null, materials: [] });
  });

  it('refuses a blank name, a non-positive cost, a bad width range and bad materials', () => {
    const draft = {
      ...emptyProfileDraft(),
      name: '   ',
      costMultiplier: '0',
      widthMin: '4',
      widthMax: '2',
      materials: [
        { material: 'stone bricks', role: 'Surface' as const, ambiguous: false, centreShare: 0, edgeShare: 0, samples: 0 },
        { material: 'STONE_BRICKS', role: 'Surface' as const, ambiguous: false, centreShare: 0, edgeShare: 0, samples: 0 },
        { material: 'stone-bricks!', role: 'Surface' as const, ambiguous: false, centreShare: 0, edgeShare: 0, samples: 0 },
        { material: '', role: 'Surface' as const, ambiguous: false, centreShare: 0, edgeShare: 0, samples: 0 },
      ],
    };
    const { errors, value } = parseProfileDraft(draft);
    expect(value).toBeUndefined();
    expect(errors).toEqual([
      'Name is required.',
      'Cost multiplier must be greater than 0.',
      'Width max (2) cannot be below width min (4).',
      'STONE_BRICKS is listed twice.',
      'STONE_BRICKS! is not a Bukkit material name (letters, digits and _ only).',
      'Material 4 needs a material name.',
    ]);
  });

  it('refuses fractional widths, a width min below 1 and an over-long name', () => {
    const { errors } = parseProfileDraft({ ...emptyProfileDraft(), name: 'x'.repeat(101), widthMin: '0', widthMax: '2.5' });
    expect(errors).toEqual([
      'Name is at most 100 characters.',
      'Width max must be a whole number.',
    ]);
    expect(parseProfileDraft({ ...emptyProfileDraft(), name: 'Trail', widthMin: '0' }).errors).toEqual(['Width min must be at least 1.']);
    expect(parseProfileDraft({ ...emptyProfileDraft(), name: 'Trail', costMultiplier: 'abc' }).errors).toEqual(['Cost multiplier must be a number.']);
  });
});

describe('formatShare', () => {
  it('shows a 0..1 share as a percentage', () => {
    expect(formatShare(0.7)).toBe('70%');
    expect(formatShare(0.004)).toBe('0%');
  });
});
