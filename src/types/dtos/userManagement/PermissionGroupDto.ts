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

// Mirrors knk-web-api's PermissionGroupListDto — row shape for POST /api/PermissionGroups/search
// (the generic ObjectDashboard paged listing).
export interface PermissionGroupListDto {
  id?: number | null;
  name: string;
  weight: number;
  isPremiumTier: boolean;
  salaryMultiplier: number;
  parentGroupId?: number | null;
  parentGroupName?: string | null;
  childrenCount: number;
}
