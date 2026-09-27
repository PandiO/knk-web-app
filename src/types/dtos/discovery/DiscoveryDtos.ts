// Domain discovery (knk-web-api Dtos/DiscoveryDtos.cs, docs/specs/domain-discovery/DESIGN.md §3.5).

/**
 * knk-web-api StaffPermissions.ManageDiscovery: another player's discoveries, resetting one,
 * and the reward rules/overrides/preview/statistics. A player reads their own without it.
 */
export const DISCOVERY_ADMIN_NODE = 'knk.admin.discovery';

/** The discoverable domain types, top-down - the order the API lists them in. */
export const DISCOVERY_DOMAIN_TYPES = ['Town', 'District', 'Structure', 'GateStructure'] as const;
export type DiscoveryDomainType = typeof DISCOVERY_DOMAIN_TYPES[number];

export const discoveryTypeLabel = (domainType: string): string =>
  domainType === 'GateStructure' ? 'Gate' : domainType;

/** "Gate structures", "Towns" - for sentences about every place of a type. */
export const discoveryTypePluralLabel = (domainType: string): string =>
  domainType === 'GateStructure' ? 'Gate structures' : `${domainType}s`;

/**
 * Subtypes per domain type (the API's class hierarchy: a GateStructure is a Structure). Turning a
 * type's discovery on or off offers to do the same for these. Containment is not subtyping - a
 * District lies in a Town but is not one - so Town has no entry.
 */
export const DISCOVERY_CHILD_TYPES: Partial<Record<DiscoveryDomainType, readonly DiscoveryDomainType[]>> = {
  Structure: ['GateStructure'],
};

export const discoveryChildTypes = (domainType: string): readonly DiscoveryDomainType[] =>
  DISCOVERY_CHILD_TYPES[domainType as DiscoveryDomainType] ?? [];

/**
 * Body of POST api/users/{id}/discoveries/progress. The API's PagedQueryDto binds "pageNumber"
 * (not the shared web-app PagedQueryDto's "page"). Filters: domainType, status
 * ("discovered"/"undiscovered"); sortBy "name" or "discoveredAt".
 */
export interface DiscoveryProgressQuery {
  pageNumber?: number;
  pageSize?: number;
  searchTerm?: string;
  sortBy?: 'name' | 'discoveredAt';
  sortDescending?: boolean;
  filters?: { domainType?: string; status?: 'discovered' | 'undiscovered' };
}

/** The API's paged wire shape (pageNumber/pageSize, no totalPages). */
export interface DiscoveryPagedResultDto<T> {
  items: T[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
}

export interface DiscoveryProgressRowDto {
  domainId: number;
  name: string;
  domainType: string;
  parentName?: string | null;
  discovered: boolean;
  discoveredAt?: string | null;
  coins: number;
  gems: number;
  exp: number;
}

export interface DiscoveryTypeCountDto {
  domainType: string;
  discovered: number;
  total: number;
}

export interface DiscoverySummaryDto {
  byType: DiscoveryTypeCountDto[];
  latest?: DiscoveryProgressRowDto | null;
  totalDiscovered: number;
  totalCoins: number;
  totalGems: number;
  totalExp: number;
}

/** A domain type's reward rule (GET/PUT api/discovery-rewards). */
export interface DiscoveryRewardRuleDto {
  domainType: string;
  isEnabled: boolean;
  expUnitsMin: number;
  expUnitsMax: number;
  coinSalaryHoursMin: number;
  coinSalaryHoursMax: number;
  gemsMin: number;
  gemsMax: number;
  includeAncestors: boolean;
  updatedAt?: string | null;
}

export type UpdateDiscoveryRewardRuleDto = Omit<DiscoveryRewardRuleDto, 'domainType' | 'updatedAt'>;

/** A per-domain override; a null field inherits the type rule. */
export interface DomainDiscoveryOverrideDto {
  domainId: number;
  domainName?: string | null;
  domainType?: string | null;
  isEnabled?: boolean | null;
  expUnitsMin?: number | null;
  expUnitsMax?: number | null;
  coinSalaryHoursMin?: number | null;
  coinSalaryHoursMax?: number | null;
  gemsMin?: number | null;
  gemsMax?: number | null;
  includeAncestors?: boolean | null;
  updatedAt?: string | null;
}

export type UpdateDomainDiscoveryOverrideDto = Omit<DomainDiscoveryOverrideDto, 'domainId' | 'domainName' | 'domainType' | 'updatedAt'>;

/** GET api/discovery-rewards/preview: what a type (or one domain) pays per title at multiplier 1.0. */
export interface DiscoveryRewardPreviewDto {
  domainType: string;
  domainId?: number | null;
  /** The effective rule the rows were computed from (override applied). */
  rule: DiscoveryRewardRuleDto;
  rows: DiscoveryRewardPreviewRowDto[];
}

export interface DiscoveryRewardPreviewRowDto {
  titleBracketId: number;
  titleName: string;
  minExperience: number;
  /** 1% of the bracket's XP width (v1 getExpPart unit). */
  expUnit: number;
  salary: number;
  expMin: number;
  expMax: number;
  coinsMin: number;
  coinsMax: number;
  gemsMin: number;
  gemsMax: number;
}

export interface DiscoveryStatsQuery {
  pageNumber?: number;
  pageSize?: number;
  domainType?: string;
  searchTerm?: string;
  /** "discoverers" (default) or "name". */
  sortBy?: 'discoverers' | 'name';
  /** Default true: most discovered first. */
  sortDescending?: boolean;
}

export interface DomainDiscoveryStatDto {
  domainId: number;
  name: string;
  domainType: string;
  parentName?: string | null;
  discoverers: number;
  discovererPercent: number;
  firstDiscovererUserId?: number | null;
  firstDiscovererUsername?: string | null;
  firstDiscoveredAt?: string | null;
}

export interface DiscoveryExplorerDto {
  userId: number;
  username?: string | null;
  discoveries: number;
}

export interface DiscoveryStatsDto {
  domains: DiscoveryPagedResultDto<DomainDiscoveryStatDto>;
  /** Active users with a linked Minecraft account - the denominator of discovererPercent. */
  linkedUserCount: number;
  topExplorers: DiscoveryExplorerDto[];
}
