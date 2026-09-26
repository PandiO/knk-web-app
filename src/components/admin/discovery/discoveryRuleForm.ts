import {
  DiscoveryRewardPreviewRowDto,
  DiscoveryRewardRuleDto,
  DomainDiscoveryOverrideDto,
  UpdateDiscoveryRewardRuleDto,
  UpdateDomainDiscoveryOverrideDto,
} from '../../../types/dtos/discovery/DiscoveryDtos';

// Form state, validation and the live preview for the discovery reward editor
// (DiscoveryAdminPage). Validation mirrors knk-web-api DiscoveryConfigurationService.Validate so
// most mistakes are caught before the save; the API still validates every write.

/** knk-web-api DiscoveryConfigurationService.MaxUnits (XP units and coin salary-hours). */
export const MAX_UNITS = 1000;
/** knk-web-api DiscoveryConfigurationService.MaxGems. */
export const MAX_GEMS = 100_000;

export type RangeKey = 'expUnits' | 'coinSalaryHours' | 'gems';

export const RANGES: { key: RangeKey; label: string; limit: number; whole: boolean }[] = [
  { key: 'expUnits', label: 'XP units', limit: MAX_UNITS, whole: false },
  { key: 'coinSalaryHours', label: 'Coin salary-hours', limit: MAX_UNITS, whole: false },
  { key: 'gems', label: 'Gems', limit: MAX_GEMS, whole: true },
];

type NumberFields = Record<`${RangeKey}Min` | `${RangeKey}Max`, string>;

/** A type rule being edited; numbers as the inputs' text. */
export type RuleDraft = NumberFields & { isEnabled: boolean; includeAncestors: boolean };

/** An override being edited; '' = inherit the type rule. */
export type OverrideDraft = NumberFields & { isEnabled: '' | 'true' | 'false'; includeAncestors: '' | 'true' | 'false' };

const numberFields = (source: Partial<Record<keyof NumberFields, number | null | undefined>>): NumberFields => {
  const text = (value: number | null | undefined) => (value === null || value === undefined ? '' : String(value));
  return {
    expUnitsMin: text(source.expUnitsMin),
    expUnitsMax: text(source.expUnitsMax),
    coinSalaryHoursMin: text(source.coinSalaryHoursMin),
    coinSalaryHoursMax: text(source.coinSalaryHoursMax),
    gemsMin: text(source.gemsMin),
    gemsMax: text(source.gemsMax),
  };
};

const triState = (value: boolean | null | undefined): '' | 'true' | 'false' =>
  value === null || value === undefined ? '' : value ? 'true' : 'false';

export const ruleToDraft = (rule: DiscoveryRewardRuleDto): RuleDraft => ({
  ...numberFields(rule),
  isEnabled: rule.isEnabled,
  includeAncestors: rule.includeAncestors,
});

export const overrideToDraft = (domainOverride?: DomainDiscoveryOverrideDto | null): OverrideDraft => ({
  ...numberFields(domainOverride ?? {}),
  isEnabled: triState(domainOverride?.isEnabled),
  includeAncestors: triState(domainOverride?.includeAncestors),
});

type Parsed = { value: number | null; error?: string };

function parseNumber(text: string, label: string, whole: boolean, required: boolean): Parsed {
  const trimmed = text.trim();
  if (trimmed === '') return required ? { value: null, error: `${label} is required.` } : { value: null };
  const value = Number(trimmed);
  if (!Number.isFinite(value)) return { value: null, error: `${label} must be a number.` };
  if (whole && !Number.isInteger(value)) return { value: null, error: `${label} must be a whole number.` };
  return { value };
}

function validateRanges(values: Record<keyof NumberFields, number>, errors: string[]) {
  for (const range of RANGES) {
    const min = values[`${range.key}Min`];
    const max = values[`${range.key}Max`];
    if (min < 0 || max < 0) errors.push(`${range.label} cannot be negative.`);
    else if (min > range.limit || max > range.limit) errors.push(`${range.label} cannot exceed ${range.limit.toLocaleString('en-US')}.`);
    else if (min > max) errors.push(`${range.label}: min (${min}) cannot exceed max (${max}).`);
  }
}

/** The PUT body for a type rule, or what is wrong with the draft. */
export function parseRuleDraft(draft: RuleDraft): { value?: UpdateDiscoveryRewardRuleDto; errors: string[] } {
  const errors: string[] = [];
  const values = {} as Record<keyof NumberFields, number>;
  for (const range of RANGES) {
    for (const end of ['Min', 'Max'] as const) {
      const field = `${range.key}${end}` as keyof NumberFields;
      const parsed = parseNumber(draft[field], `${range.label} ${end.toLowerCase()}`, range.whole, true);
      if (parsed.error) errors.push(parsed.error);
      values[field] = parsed.value ?? 0;
    }
  }
  if (errors.length === 0) validateRanges(values, errors);
  if (errors.length > 0) return { errors };
  return {
    errors,
    value: { isEnabled: draft.isEnabled, includeAncestors: draft.includeAncestors, ...values },
  };
}

/**
 * The PUT body for an override (blank fields inherit), or what is wrong with it. Like the API, the
 * ranges are checked on the override merged onto its type rule - what grants will actually use.
 */
export function parseOverrideDraft(
  draft: OverrideDraft,
  rule: DiscoveryRewardRuleDto | undefined,
): { value?: UpdateDomainDiscoveryOverrideDto; errors: string[] } {
  const errors: string[] = [];
  const own = {} as Record<keyof NumberFields, number | null>;
  const merged = {} as Record<keyof NumberFields, number>;
  for (const range of RANGES) {
    for (const end of ['Min', 'Max'] as const) {
      const field = `${range.key}${end}` as keyof NumberFields;
      const parsed = parseNumber(draft[field], `${range.label} ${end.toLowerCase()}`, range.whole, false);
      if (parsed.error) errors.push(parsed.error);
      own[field] = parsed.value;
      merged[field] = parsed.value ?? rule?.[field] ?? 0;
    }
  }
  if (errors.length === 0) validateRanges(merged, errors);
  if (errors.length > 0) return { errors };
  const bool = (value: '' | 'true' | 'false') => (value === '' ? null : value === 'true');
  return {
    errors,
    value: { isEnabled: bool(draft.isEnabled), includeAncestors: bool(draft.includeAncestors), ...own },
  };
}

// knk-web-api DiscoveryRewardCalculator.ToWhole: rounded half away from zero, never negative. The
// API multiplies decimals; snapping to 6 places first keeps binary float noise (0.15 × 10 =
// 1.4999…) from rounding the other way.
const toWhole = (value: number): number => (value <= 0 ? 0 : Math.round(Math.round(value * 1e6) / 1e6));

const range = (a: number, b: number): [number, number] => [Math.max(0, Math.min(a, b)), Math.max(0, Math.max(a, b))];

/**
 * The preview rows recomputed for an edited rule - the same formula as the API
 * (DiscoveryRewardCalculator.Min/Max: XP units × the bracket's XP unit, salary-hours × the
 * bracket's salary, flat gems), so the table follows the inputs before anything is saved.
 */
export function previewRowsFor(
  rows: DiscoveryRewardPreviewRowDto[],
  rule: UpdateDiscoveryRewardRuleDto,
): DiscoveryRewardPreviewRowDto[] {
  const [expLo, expHi] = range(rule.expUnitsMin, rule.expUnitsMax);
  const [coinLo, coinHi] = range(rule.coinSalaryHoursMin, rule.coinSalaryHoursMax);
  const [gemsLo, gemsHi] = range(rule.gemsMin, rule.gemsMax);
  return rows.map((row) => ({
    ...row,
    expMin: toWhole(expLo * row.expUnit),
    expMax: toWhole(expHi * row.expUnit),
    coinsMin: toWhole(coinLo * row.salary),
    coinsMax: toWhole(coinHi * row.salary),
    gemsMin: gemsLo,
    gemsMax: gemsHi,
  }));
}
