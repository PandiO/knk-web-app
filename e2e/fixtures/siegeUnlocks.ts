import type { MockApi } from '../support/mockApi';
import type {
  SiegeWeaponUnlockOfferDto,
  SiegeWeaponUnlockPurchaseResultDto,
  SiegeWeaponUnlocksOverviewDto,
} from '../../src/types/dtos/siege/SiegeWeaponUnlockDtos';

/**
 * Siege shop L4 (PandiO/knk-workspace#869): the player's Siege unlocks as knk-web-api's SiegeWeaponUnlocksController
 * serves them, with a purchase that checks the title and the coins like the API (smoke guide § 4.0: the trebuchet
 * needs a title the player hasn't got, the ballista costs 500 of their 1200 coins).
 */

export interface UnlocksState {
  coins: number;
  unlocked: Set<number>;
  /** Template ids whose minimum title the player lacks. */
  titleShort: Set<number>;
}

const templates: Array<Pick<SiegeWeaponUnlockOfferDto, 'templateId' | 'name' | 'kind' | 'unlockPrice' | 'minTitleLevel' | 'minTitleName'>> = [
  { templateId: 3, name: 'Ballista', kind: 'Direct', unlockPrice: 500, minTitleLevel: null, minTitleName: null },
  { templateId: 4, name: 'Trebuchet', kind: 'Indirect', unlockPrice: 1000, minTitleLevel: 2, minTitleName: 'Squire' },
  { templateId: 5, name: 'Catapult', kind: 'Indirect', unlockPrice: 800, minTitleLevel: null, minTitleName: null },
];

export function overview(userId: number, state: UnlocksState): SiegeWeaponUnlocksOverviewDto {
  return {
    userId,
    coins: state.coins,
    titleLevel: 1,
    titleName: 'Peasant',
    offers: templates.map(t => {
      const unlocked = state.unlocked.has(t.templateId);
      const meetsTitle = !state.titleShort.has(t.templateId);
      const canAfford = state.coins >= t.unlockPrice;
      return {
        ...t,
        unlocked,
        unlockedAt: unlocked ? '2026-11-20T20:00:00Z' : null,
        meetsTitle,
        canAfford,
        state: unlocked ? 'Unlocked' : !meetsTitle ? 'NeedsTitle' : !canAfford ? 'NeedsCoins' : 'Unlockable',
      };
    }),
  };
}

/** Mocks GET mine and POST purchase over a shared state; returns the state for the spec to inspect. */
export function mockSiegeUnlocks(api: MockApi, userId: number, initial?: Partial<UnlocksState>,
                                 options: { delayMs?: number } = {}): UnlocksState {
  const state: UnlocksState = {
    coins: initial?.coins ?? 1200,
    unlocked: initial?.unlocked ?? new Set<number>(),
    titleShort: initial?.titleShort ?? new Set<number>([4]),
  };
  api.on<SiegeWeaponUnlocksOverviewDto>('GET', 'SiegeWeaponUnlocks/mine', () => ({ body: overview(userId, state) }));
  api.on<SiegeWeaponUnlockPurchaseResultDto | { code: string; message: string }>('POST', 'SiegeWeaponUnlocks/purchase', async ({ body }) => {
    if (options.delayMs) await new Promise(resolve => setTimeout(resolve, options.delayMs));
    const templateId = (body as { templateId: number }).templateId;
    const template = templates.find(t => t.templateId === templateId)!;
    if (state.unlocked.has(templateId)) {
      const again: SiegeWeaponUnlockPurchaseResultDto = { templateId, templateName: template.name, userId, coinsPaid: 0,
        alreadyUnlocked: true, unlockedAt: '2026-11-20T20:00:00Z', coins: state.coins };
      return { body: again };
    }
    if (state.titleShort.has(templateId)) {
      return { status: 409, body: { code: 'NeedsTitle', message: `You need the title ${template.minTitleName} to unlock the ${template.name}.` } };
    }
    if (state.coins < template.unlockPrice) {
      return { status: 409, body: { code: 'InsufficientFunds', message: `Not enough coins to unlock the ${template.name}: ${state.coins}/${template.unlockPrice}.` } };
    }
    state.coins -= template.unlockPrice;
    state.unlocked.add(templateId);
    const result: SiegeWeaponUnlockPurchaseResultDto = { templateId, templateName: template.name, userId,
      coinsPaid: template.unlockPrice, alreadyUnlocked: false, unlockedAt: '2026-11-20T20:00:00Z', coins: state.coins };
    return { body: result };
  });
  return state;
}
