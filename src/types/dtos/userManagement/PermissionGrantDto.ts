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
