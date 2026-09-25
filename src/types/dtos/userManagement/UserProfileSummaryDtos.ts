// docs/specs/user-management/DESIGN.md §2, IMPLEMENTATION_PLAN.md Phase 1.
// Mirrors knk-web-api's GET /api/users/{id}/profile-summary response shape. Kept separate from
// the shared UserDto in types/dtos/auth/UserDtos.ts, which predates user-features Phases 3-6 and
// doesn't carry activeMode/title/premium-tier/salary fields yet - widening that shared type is a
// bigger, riskier change than this view needs (see the handoff note in ACTIVE_SESSIONS.md).

// Backend serializes these as their PascalCase enum names (System.Text.Json string enum
// converter), e.g. {"activeMode":"None"} - confirmed live against GET /api/Users/{id} rather
// than assumed from the C# enum's underlying int values.
export type ActiveMode = 'None' | 'Staff' | 'Owner';
export type GatePassThroughMethod = 'Default' | 'InstantOpen' | 'Teleport';

export interface ProfileAccountDto {
  id: number;
  username: string;
  uuid?: string | null;
  email?: string | null;
  coins: number;
  gems: number;
  experiencePoints: number;
  emailVerified: boolean;
  gatePassThroughMethodDefault: GatePassThroughMethod;
  activeMode: ActiveMode;
  titleBracketId?: number | null;
  titleName?: string | null;
  prestigeExperience: number;
  premiumTierGroupId?: number | null;
  premiumTierName?: string | null;
  premiumTierExpiresAt?: string | null;
  personalSalaryMultiplier: number;
  lastSalaryPayoutAt: string;
  isFullAccount: boolean;
  createdAt: string;
  isActive: boolean;
}

export interface EffectivePermissionEntryDto {
  node: string;
  value: boolean;
  sourceHolderId: number;
  sourceHolderType: string;
  sourceHolderName?: string | null;
}

export interface PermissionEffectiveResponseDto {
  userId: number;
  permissions: EffectivePermissionEntryDto[];
}

export interface UserPermissionGroupDto {
  userId: number;
  permissionGroupId: number;
  permissionGroupName?: string | null;
  weight: number;
  isPremiumTier: boolean;
  expiresAt?: string | null;
  isActive: boolean;
}

export interface TitleResolutionDto {
  titleBracketId?: number | null;
  titleName?: string | null;
  prestigeExperience: number;
  nextTitleBracketId?: number | null;
  nextTitleName?: string | null;
  nextTitleMinExperience?: number | null;
}

export interface SalaryStateDto {
  globalMultiplier: number;
  personalMultiplier: number;
  rankMultiplier: number;
  effectiveHourlyRate: number;
  lastSalaryPayoutAt: string;
  nextEligibleAt: string;
}

export interface UserProfileSummaryDto {
  account: ProfileAccountDto;
  permissions: PermissionEffectiveResponseDto;
  groups: UserPermissionGroupDto[];
  title: TitleResolutionDto;
  salary: SalaryStateDto;
}

// docs/specs/user-management/IMPLEMENTATION_PLAN.md Phase 2.

export interface AssignGroupRequest {
  permissionGroupId: number;
  expiresAt?: string | null;
}

export interface GrantNodeRequest {
  node: string;
  value: boolean;
  expiresAt?: string | null;
}

export type AuditAction =
  | 'GroupAssigned'
  | 'GroupRemoved'
  | 'GrantAdded'
  | 'GrantUpdated'
  | 'GrantRemoved'
  | 'TitleChanged'
  | 'VanishToggled'
  | 'SalaryPayout'
  | 'BalanceAdjusted'
  // docs/specs/kits/DESIGN.md §4.1's proposed GiveKitAsync -> AuditLogService.Record action.
  // Not yet written server-side (kits/IMPLEMENTATION_PLAN.md §2 status: TODO(kits-phase2)) -
  // included here so the type and PlayerProfilePage.tsx's activity feed are ready for it.
  | 'KitGranted';

export interface AuditLogEntryDto {
  id: number;
  timestamp: string;
  actorUserId?: number | null;
  actorUsername?: string | null;
  targetUserId: number;
  targetUsername?: string | null;
  action: AuditAction;
  details?: string | null;
}

// Kept separate from the shared PagedResultDto in types/dtos/common/PagedQuery.ts, which targets
// a different backend paged shape (page/totalPages) - this mirrors GET /api/audit-log's actual
// wire shape (pageNumber/pageSize, no totalPages) confirmed live rather than assumed.
export interface AuditLogPagedResultDto {
  items: AuditLogEntryDto[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
}

// PUT /api/users/{id}/balances' response - consolidates every title bracket crossed by one
// adjustment into a single result rather than one per tier (see UserService.AdjustBalancesAsync
// on the backend, and the /knk user xp command's PromotionEffects on the plugin side).
export interface TitleCrossingDto {
  titleBracketId: number;
  titleName: string;
}

export interface TitleChangeResultDto {
  direction: 'promotion' | 'demotion';
  fromTitleBracketId: number;
  fromTitleName: string;
  toTitleBracketId: number;
  toTitleName: string;
  crossedTitles: TitleCrossingDto[];
  coinBonusGranted: number;
  gemBonusGranted: number;
  expBonusGranted: number;
}

export interface BalanceAdjustmentResultDto {
  newCoins: number;
  newGems: number;
  newExperiencePoints: number;
  titleChange: TitleChangeResultDto | null;
}
