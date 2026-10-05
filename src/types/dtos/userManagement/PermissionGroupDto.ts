// Mirrors knk-web-api's PermissionGroupDto (Dtos/PermissionGroupDtos.cs). Originally used only to
// populate the group picker on PlayerProfilePage.tsx's quick actions (docs/specs/
// user-management/IMPLEMENTATION_PLAN.md Phase 2); also the create/edit shape for the generic
// ObjectDashboard/FormWizard registration added 2026-09-25 (developer feedback — PermissionGroup
// is [FormConfigurableEntity] on the backend but had no client-side entry point).
export interface PermissionGroupDto {
  id?: number | null;
  name: string;
  weight: number;
  isPremiumTier: boolean;
  salaryMultiplier: number;
  /** KNG-16: rank multipliers on title promotion gem/XP bonuses. Omitted keeps the stored value. */
  gemBonusMultiplier?: number | null;
  expBonusMultiplier?: number | null;
  chatPrefix?: string | null;
  chatSuffix?: string | null;
  parentGroupId?: number | null;
  /**
   * KNG-41: teleport fees and cooldowns per kind (/tpa = Request, /warp, /spawn). Each kind's
   * price mode is its switch on update: omitted keeps that kind's stored fields, sent sets all of
   * them (null = not set here). Authored on the PermissionGroup FormConfiguration.
   */
  teleportRequestPriceMode?: TeleportPriceMode | null;
  teleportRequestPriceMultiplier?: number | null;
  teleportRequestPriceCoins?: number | null;
  teleportRequestPriceGems?: number | null;
  teleportRequestPriceExperience?: number | null;
  teleportRequestCooldownSeconds?: number | null;
  teleportWarpPriceMode?: TeleportPriceMode | null;
  teleportWarpPriceMultiplier?: number | null;
  teleportWarpPriceCoins?: number | null;
  teleportWarpPriceGems?: number | null;
  teleportWarpPriceExperience?: number | null;
  teleportWarpCooldownSeconds?: number | null;
  /** /spawn has no default price, so only None or Fixed. */
  teleportSpawnPriceMode?: TeleportPriceMode | null;
  teleportSpawnPriceCoins?: number | null;
  teleportSpawnPriceGems?: number | null;
  teleportSpawnPriceExperience?: number | null;
  teleportSpawnCooldownSeconds?: number | null;
}

/**
 * Mirrors knk-web-api's Enums/TeleportPriceMode.cs (serialized as its name): None = the default
 * price, Fixed = exact coins/gems/XP, Multiplier = the default price times a factor.
 */
export type TeleportPriceMode = 'None' | 'Fixed' | 'Multiplier';

// Row shape returned by GET /api/PermissionGroups/{id}/expiring-memberships
// (docs/specs/user-management/IMPLEMENTATION_PLAN.md Phase 3 "premium expiring soon" view).
export interface ExpiringMembershipDto {
  userId: number;
  username: string;
  permissionGroupId: number;
  expiresAt: string;
}

// Mirrors knk-web-api's PermissionGroupListDto — row shape for POST /api/PermissionGroups/search
// (the generic ObjectDashboard paged listing).
export interface PermissionGroupListDto {
  id?: number | null;
  name: string;
  weight: number;
  isPremiumTier: boolean;
  salaryMultiplier: number;
  gemBonusMultiplier: number;
  expBonusMultiplier: number;
  parentGroupId?: number | null;
  parentGroupName?: string | null;
  childrenCount: number;
}
