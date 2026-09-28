import {
  ROAD_CLASSES,
  ROAD_MATERIAL_ROLES,
  RoadClass,
  RoadMaterialDto,
  RoadMaterialRole,
  RoadProfileDto,
  RoadProfileUpsertDto,
} from '../../../types/dtos/road/RoadDtos';

// Form state and validation for the road profile editor (RoadProfilesCard). Validation mirrors
// knk-web-api RoadNetworkService.ValidateProfile so most mistakes are caught before the save; the
// API still validates every write. Survey statistics (`stats`) are never touched: every PUT sends
// `stats: null`, which keeps them (plan D5, Phase 2e decision 3).

/** knk-web-api RoadNetworkService: profile names are at most 100 characters. */
export const MAX_PROFILE_NAME_LENGTH = 100;

/** A Bukkit Material name (knk-web-api: ^[A-Z0-9_]+$). */
const MATERIAL_KEY = /^[A-Z0-9_]+$/;

/** A material row being edited; shares and samples are read-only survey results. */
export type MaterialDraft = {
  material: string;
  role: RoadMaterialRole;
  ambiguous: boolean;
  centreShare: number;
  edgeShare: number;
  samples: number;
};

/** A profile being edited; numbers as the inputs' text. */
export type ProfileDraft = {
  name: string;
  roadClass: RoadClass;
  costMultiplier: string;
  widthMin: string;
  widthMax: string;
  enabled: boolean;
  /** null = everywhere. */
  scopeTownIds: number[] | null;
  materials: MaterialDraft[];
  sampleCount: number;
};

/**
 * A fresh, hand-made profile: class Road, cost 1, enabled, everywhere, no materials. widthMax
 * defaults to 15 because the builder's plaza rule needs it at or above the real road width
 * (plan Phase 2c decision 7); surveyed profiles get their own 95th percentile.
 */
export const emptyProfileDraft = (): ProfileDraft => ({
  name: '',
  roadClass: 'Road',
  costMultiplier: '1',
  widthMin: '1',
  widthMax: '15',
  enabled: true,
  scopeTownIds: null,
  materials: [],
  sampleCount: 0,
});

export const emptyMaterialDraft = (): MaterialDraft => ({
  material: '',
  role: 'Surface',
  ambiguous: false,
  centreShare: 0,
  edgeShare: 0,
  samples: 0,
});

export const profileToDraft = (profile: RoadProfileDto): ProfileDraft => ({
  name: profile.name,
  roadClass: profile.roadClass,
  costMultiplier: String(profile.costMultiplier),
  widthMin: String(profile.widthMin),
  widthMax: String(profile.widthMax),
  enabled: profile.enabled,
  scopeTownIds: profile.scopeTownIds && profile.scopeTownIds.length > 0 ? [...profile.scopeTownIds] : null,
  materials: (profile.materials ?? []).map((m) => ({
    material: m.material,
    role: m.role,
    ambiguous: m.ambiguous,
    centreShare: m.centreShare,
    edgeShare: m.edgeShare,
    samples: m.samples,
  })),
  sampleCount: profile.sampleCount,
});

/**
 * A Bukkit Material name from what an admin typed or picked: "minecraft:stone_bricks",
 * "stone bricks" and "Stone_Bricks" all become STONE_BRICKS. Anything else is left for the
 * validation to refuse.
 */
export const toMaterialKey = (text: string): string => {
  const trimmed = text.trim();
  const withoutNamespace = trimmed.includes(':') ? trimmed.slice(trimmed.lastIndexOf(':') + 1) : trimmed;
  return withoutNamespace.replace(/[\s-]+/g, '_').toUpperCase();
};

type Parsed = { value: number | null; error?: string };

function parseNumber(text: string, label: string, whole: boolean): Parsed {
  const trimmed = text.trim();
  if (trimmed === '') return { value: null, error: `${label} is required.` };
  const value = Number(trimmed);
  if (!Number.isFinite(value)) return { value: null, error: `${label} must be a number.` };
  if (whole && !Number.isInteger(value)) return { value: null, error: `${label} must be a whole number.` };
  return { value };
}

/** The POST/PUT body for a profile, or what is wrong with the draft. */
export function parseProfileDraft(draft: ProfileDraft): { value?: RoadProfileUpsertDto; errors: string[] } {
  const errors: string[] = [];

  const name = draft.name.trim();
  if (name === '') errors.push('Name is required.');
  else if (name.length > MAX_PROFILE_NAME_LENGTH) errors.push(`Name is at most ${MAX_PROFILE_NAME_LENGTH} characters.`);

  if (!ROAD_CLASSES.some((c) => c === draft.roadClass)) errors.push('Unknown road class.');

  const cost = parseNumber(draft.costMultiplier, 'Cost multiplier', false);
  if (cost.error) errors.push(cost.error);
  else if ((cost.value ?? 0) <= 0) errors.push('Cost multiplier must be greater than 0.');

  const widthMin = parseNumber(draft.widthMin, 'Width min', true);
  const widthMax = parseNumber(draft.widthMax, 'Width max', true);
  if (widthMin.error) errors.push(widthMin.error);
  if (widthMax.error) errors.push(widthMax.error);
  if (!widthMin.error && !widthMax.error) {
    if ((widthMin.value ?? 0) < 1) errors.push('Width min must be at least 1.');
    else if ((widthMax.value ?? 0) < (widthMin.value ?? 0)) errors.push(`Width max (${widthMax.value}) cannot be below width min (${widthMin.value}).`);
  }

  const materials: RoadMaterialDto[] = [];
  const seen = new Set<string>();
  draft.materials.forEach((m, index) => {
    const key = toMaterialKey(m.material);
    const label = key || `Material ${index + 1}`;
    if (key === '') errors.push(`Material ${index + 1} needs a material name.`);
    else if (!MATERIAL_KEY.test(key)) errors.push(`${label} is not a Bukkit material name (letters, digits and _ only).`);
    else if (seen.has(key)) errors.push(`${label} is listed twice.`);
    seen.add(key);
    if (!ROAD_MATERIAL_ROLES.some((r) => r === m.role)) errors.push(`${label} has an unknown role.`);
    materials.push({
      material: key,
      role: m.role,
      ambiguous: m.ambiguous,
      centreShare: m.centreShare,
      edgeShare: m.edgeShare,
      samples: m.samples,
    });
  });

  if (errors.length > 0) return { errors };
  return {
    errors,
    value: {
      name,
      roadClass: draft.roadClass,
      costMultiplier: cost.value ?? 1,
      materials,
      widthMin: widthMin.value ?? 1,
      widthMax: widthMax.value ?? 1,
      sampleCount: draft.sampleCount,
      enabled: draft.enabled,
      scopeTownIds: draft.scopeTownIds && draft.scopeTownIds.length > 0 ? draft.scopeTownIds : null,
      stats: null,
    },
  };
}

/** "42%" from a 0..1 share. */
export const formatShare = (share: number): string => `${Math.round((share ?? 0) * 100)}%`;
