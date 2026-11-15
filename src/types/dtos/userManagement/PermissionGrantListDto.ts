// Mirrors knk-web-api's PermissionGrantListDto (Dtos/PermissionGrantDtos.cs): one row of
// POST /api/PermissionGrants/search, the dashboard's PermissionGrant table (PandiO/knk-workspace#408).
export interface PermissionGrantListDto {
  id?: number | null;
  holderId: number;
  /** "User" or "PermissionGroup". */
  holderType?: string | null;
  node: string;
  /** true = granted, false = an explicit deny. */
  value: boolean;
  /** ISO date; null = never expires. */
  expiresAt?: string | null;
}
