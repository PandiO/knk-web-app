// Mirrors knk-web-api's PermissionGrantDto (Dtos/PermissionGrantDtos.cs) — the response shape of
// POST /api/users/{id}/grants (docs/specs/user-management/IMPLEMENTATION_PLAN.md Phase 2).
export interface PermissionGrantDto {
  id?: number | null;
  holderId: number;
  holderType?: string | null;
  node: string;
  value: boolean;
  expiresAt?: string | null;
}

// Body of PUT /api/PermissionGrants/by-node (knk.admin.user.perm): grant, deny or change the expiry of one node on any
// holder (a user or a permission group). The API keeps one row per (holder, node), so saving an existing node updates it.
export interface UpsertPermissionGrantByNodeDto {
  holderId: number;
  node: string;
  value: boolean;
  /** ISO date; null = never expires. */
  expiresAt: string | null;
}
