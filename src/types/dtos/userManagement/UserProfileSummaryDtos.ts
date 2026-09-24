// docs/specs/user-management/DESIGN.md §2, IMPLEMENTATION_PLAN.md Phase 1.
// Mirrors knk-web-api's GET /api/users/{id}/profile-summary response shape. Kept separate from
// the shared UserDto in types/dtos/auth/UserDtos.ts, which predates user-features Phases 3-6 and
// doesn't carry activeMode/title/premium-tier/salary fields yet - widening that shared type is a
// bigger, riskier change than this view needs (see the handoff note in ACTIVE_SESSIONS.md).

export enum ActiveMode {
  None = 0,
  Staff = 1,
  Owner = 2,
}

export enum GatePassThroughMethod {
  Default = 0,
  InstantOpen = 1,
  Teleport = 2,
}

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
