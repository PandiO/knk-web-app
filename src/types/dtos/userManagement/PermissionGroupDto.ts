// Mirrors knk-web-api's PermissionGroupDto (Dtos/PermissionGroupDtos.cs) — used here only to
// populate the group picker on PlayerProfilePage.tsx's quick actions (docs/specs/
// user-management/IMPLEMENTATION_PLAN.md Phase 2). PermissionGroup isn't registered in
// objectConfigs.tsx yet (Phase 1's carried-forward item 1), so this is a narrow, page-scoped
// client rather than the generic CRUD path.
export interface PermissionGroupDto {
  id?: number | null;
  name: string;
  weight: number;
  isPremiumTier: boolean;
  salaryMultiplier: number;
  chatPrefix?: string | null;
  chatSuffix?: string | null;
  parentGroupId?: number | null;
}

// Row shape returned by GET /api/PermissionGroups/{id}/expiring-memberships
// (docs/specs/user-management/IMPLEMENTATION_PLAN.md Phase 3 "premium expiring soon" view).
export interface ExpiringMembershipDto {
  userId: number;
  username: string;
  permissionGroupId: number;
  expiresAt: string;
}
