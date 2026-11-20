import type { CurrencyPolicyDto } from '../../src/types/dtos/currency/CurrencyDtos';
import type { LootboxConfigurationDto, LootboxSpawnAreaDto } from '../../src/types/dtos/lootbox/LootboxDtos';
import type {
  DomainNavigationDefaultDto,
  NavigationCompassSettingsDto,
  RoadNetworkMetaDto,
  RoadProfileDto,
  RoadTileDto,
} from '../../src/types/dtos/road/RoadDtos';
import type { SiegeConfigurationDto } from '../../src/types/dtos/siege/SiegeDtos';
import type { TitleBracketDto } from '../../src/types/dtos/title/TitleBracketDto';
import type { MockApi } from '../support/mockApi';

/**
 * The settings pages on the SettingsPage shell (PandiO/knk-workspace#26, #187): Lootboxes → Settings,
 * Currency policy, Road network, Siege settings. Each mock answers the page's read and echoes a save back
 * with a new `updatedAt`, as the API does (backfill #511).
 */

export const lootboxConfig: LootboxConfigurationDto = {
  enabled: true,
  globalMaxActive: 15,
  maxClaimsPerPlayerPerDay: 10,
  announceMinItemStars: 5,
  announceSpawnMinBoxStars: 6,
  dropAnnouncementTemplate: '&6{player} &efound {item} &ein a {box}!',
  spawnAnnouncementTemplate: '',
  updatedAt: '2026-09-26T10:00:00Z',
};

export function mockLootboxSettings(api: MockApi, config: LootboxConfigurationDto = lootboxConfig): void {
  api.json<LootboxConfigurationDto>('GET', /^LootboxConfiguration\/?$/, config);
  api.on<LootboxConfigurationDto>('PUT', /^LootboxConfiguration\/?$/, ({ body }) => ({
    body: { ...(body as LootboxConfigurationDto), updatedAt: '2026-11-14T10:00:00Z' },
  }));
  api.json<LootboxSpawnAreaDto[]>('GET', /^LootboxSpawnAreas\/?$/, []);
}

export const coinsPolicy: CurrencyPolicyDto = {
  currency: 'Coins',
  transfersEnabled: true,
  transferable: true,
  minTransfer: 10,
  maxTransfer: 1_000_000,
  dailySendCap: 2_000_000,
  dailyReceiveCap: 4_000_000,
  confirmThreshold: 100_000,
  confirmTtlSeconds: 60,
  cooldownSeconds: 0,
  maxTransfersPerHour: 0,
  minSenderAccountAgeHours: 0,
  minSenderTitleBracketId: null,
  transferFeeBasisPoints: 0,
  maxBalance: 999_999_999,
  adminDailyGrantCapPerActor: 1_000,
  signupGrant: 250,
  updatedAt: '2026-09-27T08:00:00.123456',
  updatedByUserId: 900,
  hardMaxBalance: 999_999_999,
};

export const gemsPolicy: CurrencyPolicyDto = { ...coinsPolicy, currency: 'Gems', transferable: false, maxTransfer: 500, updatedAt: '2026-09-28T08:00:00' };

export const titleBrackets: TitleBracketDto[] = [
  { id: 1, name: 'Peasant', maleName: 'Peasant', femaleName: 'Peasant', minExperience: 0, salary: 0, coinBonus: 0, gemBonus: 0, expBonus: 0 },
  { id: 3, name: 'Knight', maleName: 'Knight', femaleName: 'Dame', minExperience: 5000, salary: 0, coinBonus: 0, gemBonus: 0, expBonus: 0 },
];

/** Currency policy for both currencies; a save echoes the body back with a new version. */
export function mockCurrencyPolicy(api: MockApi, policies: CurrencyPolicyDto[] = [coinsPolicy, gemsPolicy]): void {
  api.json<CurrencyPolicyDto[]>('GET', 'currency/admin/policy', policies);
  api.on<CurrencyPolicyDto>('PUT', /^currency\/admin\/policy\/(coins|gems)$/, ({ body }) => ({
    body: { ...(body as CurrencyPolicyDto), updatedAt: '2026-11-14T10:00:00.000001Z' },
  }));
  api.json<TitleBracketDto[]>('GET', /^TitleBrackets\/?$/, titleBrackets);
}

export const compass: NavigationCompassSettingsDto = {
  enabled: true,
  material: 'COMPASS',
  displayName: 'Navigation Compass',
  nameMatch: 'Exact',
  siegeEnabled: true,
  generalEnabled: false,
  generalTargets: '',
  updatedAt: null,
};

export const navigationDefaults: DomainNavigationDefaultDto[] = [
  { domainType: 'Town', defaultMode: 'Spawn', overrideCount: 0, roadAccess: 'Applies', roadAccessOverrideCount: 0 },
  { domainType: 'District', defaultMode: 'Spawn', overrideCount: 2, roadAccess: 'Applies', roadAccessOverrideCount: 0 },
];

/** The Road network page with no roads yet: empty profiles and tiles, the navigation defaults and the compass rule. */
export function mockRoadNetwork(api: MockApi): void {
  api.json<RoadProfileDto[]>('GET', /^road-profiles\/?$/, []);
  api.json<RoadTileDto[]>('GET', /^road-tiles\/?$/, []);
  api.json<RoadNetworkMetaDto>('GET', 'road-network/meta', { profiles: [], streets: [], components: [] });
  api.json<DomainNavigationDefaultDto[]>('GET', 'navigation-settings/domain-defaults', navigationDefaults);
  api.on<DomainNavigationDefaultDto>('PUT', /^navigation-settings\/domain-defaults\/\w+$/, ({ path, body }) => {
    const domainType = decodeURIComponent(path.split('/').pop() ?? '');
    const current = navigationDefaults.find(d => d.domainType === domainType) ?? navigationDefaults[0];
    return { body: { ...current, ...(body as Partial<DomainNavigationDefaultDto>), updatedAt: '2026-11-14T10:00:00Z' } };
  });
  api.json<NavigationCompassSettingsDto>('GET', 'navigation-settings/compass', compass);
  api.on<NavigationCompassSettingsDto>('PUT', 'navigation-settings/compass', ({ body }) => ({
    body: { ...compass, ...(body as Partial<NavigationCompassSettingsDto>), updatedAt: '2026-11-14T10:00:00Z' },
  }));
}

export const siegeConfig: SiegeConfigurationDto = {
  captureAttackBase: 5,
  captureAttackPerExtra: 1,
  captureAttackPerExtraInstantVictory: 1,
  captureDefendBase: 5,
  captureDefendPerExtra: 1,
  captureDefendPerExtraInstantVictory: 1,
  sideCaptureReduction: 0.4,
  voteCloseSecondsBeforeStart: 30,
  drawSecondsBeforeStart: 25,
  hubSecondsBeforeStart: 15,
  teamSplitSecondsBeforeStart: 10,
  matchmakingAnnouncementMarks: [290, 60, 30, 15],
  killAnnouncementThresholds: [5, 10, 15],
  killStreakAnnounceAbove: 3,
  headshotMultiplier: 1.5,
  allowedCommands: ['/siege', '/msg'],
  spawnPickerDelayTicks: 20,
  enchantDropChancePerMille: 30,
  allowedEnchantmentKeys: ['minecraft:sharpness'],
  enchantLevelMin: 1,
  enchantLevelMax: 2,
  maxBooksAlive: 10,
  nonMemberGateView: 'PreLockdownView',
  giveNavigationItem: false,
  playerSkipMatchmakingSeconds: 60,
  adminSkipMatchmakingSeconds: 31,
  postMatchSeconds: 30,
  // Siege points (#866, page section #878): the design's defaults.
  pointsPerKill: 100,
  pointsStreakStep: 0.1,
  pointsStreakCap: 1.5,
  pointsPerAssist: 40,
  assistMinDamage: 4,
  assistWindowSeconds: 10,
  pointsPerDeath: 15,
  gateHpPerPoint: 5,
  pointsPerCapturePercent: 3,
  pointsPerCapture: 100,
  trickleAmount: 10,
  trickleIntervalSeconds: 60,
  pointTransfersEnabled: false,
  updatedAt: '2026-09-25T17:00:00Z',
};

/** Siege settings; the PUT is partial, so the answer is the stored values with the sent ones applied. */
export function mockSiegeSettings(api: MockApi): void {
  api.json<SiegeConfigurationDto>('GET', /^SiegeConfiguration\/?$/, siegeConfig);
  api.on<SiegeConfigurationDto>('PUT', /^SiegeConfiguration\/?$/, ({ body }) => ({
    body: { ...siegeConfig, ...(body as Partial<SiegeConfigurationDto>), updatedAt: '2026-11-14T10:00:00Z' },
  }));
}
