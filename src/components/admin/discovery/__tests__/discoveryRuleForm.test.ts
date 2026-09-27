import {
  overrideToDraft,
  parseOverrideDraft,
  parseRuleDraft,
  previewRowsFor,
  ruleToDraft,
} from '../discoveryRuleForm';
import { DiscoveryRewardPreviewRowDto, DiscoveryRewardRuleDto } from '../../../../types/dtos/discovery/DiscoveryDtos';

const town: DiscoveryRewardRuleDto = {
  domainType: 'Town',
  isEnabled: true,
  expUnitsMin: 1,
  expUnitsMax: 4,
  coinSalaryHoursMin: 2,
  coinSalaryHoursMax: 8,
  gemsMin: 5,
  gemsMax: 15,
  includeAncestors: false,
  updatedAt: '2026-09-26T12:00:00Z',
};

const bracket = (overrides: Partial<DiscoveryRewardPreviewRowDto>): DiscoveryRewardPreviewRowDto => ({
  titleBracketId: 1, titleName: 'Serf', minExperience: 0, expUnit: 25, salary: 650,
  expMin: 0, expMax: 0, coinsMin: 0, coinsMax: 0, gemsMin: 0, gemsMax: 0,
  ...overrides,
});

describe('parseRuleDraft', () => {
  it('turns a valid draft into the PUT body', () => {
    expect(parseRuleDraft({ ...ruleToDraft(town), expUnitsMax: '6', isEnabled: false })).toEqual({
      errors: [],
      value: {
        isEnabled: false, includeAncestors: false,
        expUnitsMin: 1, expUnitsMax: 6, coinSalaryHoursMin: 2, coinSalaryHoursMax: 8, gemsMin: 5, gemsMax: 15,
      },
    });
  });

  it('refuses a min above its max, negatives, blanks, fractional gems and values over the limit', () => {
    const draft = ruleToDraft(town);
    expect(parseRuleDraft({ ...draft, expUnitsMin: '5' }).errors).toEqual(['XP units: min (5) cannot exceed max (4).']);
    expect(parseRuleDraft({ ...draft, gemsMin: '-1' }).errors).toEqual(['Gems cannot be negative.']);
    expect(parseRuleDraft({ ...draft, coinSalaryHoursMax: ' ' }).errors).toEqual(['Coin salary-hours max is required.']);
    expect(parseRuleDraft({ ...draft, gemsMax: '2.5' }).errors).toEqual(['Gems max must be a whole number.']);
    expect(parseRuleDraft({ ...draft, expUnitsMax: '1001' }).errors).toEqual(['XP units cannot exceed 1,000.']);
    expect(parseRuleDraft({ ...draft, expUnitsMin: '5' }).value).toBeUndefined();
  });
});

describe('parseOverrideDraft', () => {
  it('sends blank fields as null (inherit)', () => {
    const draft = { ...overrideToDraft(null), gemsMax: '40', isEnabled: 'false' as const };
    expect(parseOverrideDraft(draft, town)).toEqual({
      errors: [],
      value: {
        isEnabled: false, includeAncestors: null,
        expUnitsMin: null, expUnitsMax: null, coinSalaryHoursMin: null, coinSalaryHoursMax: null, gemsMin: null, gemsMax: 40,
      },
    });
  });

  it('checks the ranges merged onto the type rule', () => {
    // Min 20 gems alone is above the Town rule's max of 15.
    expect(parseOverrideDraft({ ...overrideToDraft(null), gemsMin: '20' }, town).errors)
      .toEqual(['Gems: min (20) cannot exceed max (15).']);
    expect(parseOverrideDraft({ ...overrideToDraft(null), gemsMin: '20', gemsMax: '30' }, town).errors).toEqual([]);
  });

  it('round-trips an existing override', () => {
    const draft = overrideToDraft({ domainId: 4, isEnabled: true, expUnitsMin: 2, includeAncestors: null });
    expect(draft).toMatchObject({ isEnabled: 'true', includeAncestors: '', expUnitsMin: '2', expUnitsMax: '' });
  });
});

describe('previewRowsFor', () => {
  it('recomputes each bracket with the API formula', () => {
    const rows = previewRowsFor([bracket({}), bracket({ titleBracketId: 2, titleName: 'Count', expUnit: 100, salary: 10000 })], {
      isEnabled: true, includeAncestors: false,
      expUnitsMin: 1, expUnitsMax: 4, coinSalaryHoursMin: 2, coinSalaryHoursMax: 8, gemsMin: 5, gemsMax: 15,
    });
    expect(rows.map((r) => [r.expMin, r.expMax, r.coinsMin, r.coinsMax, r.gemsMin, r.gemsMax])).toEqual([
      [25, 100, 1300, 5200, 5, 15],
      [100, 400, 20000, 80000, 5, 15],
    ]);
  });

  it('rounds halves up despite float noise and never goes negative', () => {
    const [row] = previewRowsFor([bracket({ expUnit: 10, salary: 10 })], {
      isEnabled: true, includeAncestors: false,
      expUnitsMin: 0.15, expUnitsMax: 0.25, coinSalaryHoursMin: 0, coinSalaryHoursMax: 0.05, gemsMin: 0, gemsMax: 0,
    });
    expect([row.expMin, row.expMax, row.coinsMin, row.coinsMax]).toEqual([2, 3, 0, 1]);
  });
});
