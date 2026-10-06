import { logging, Controllers, HttpMethod } from '../utils';
import {
  ActiveMode,
  AdjustBalancesRequestDto,
  AssignGroupRequest,
  AuditAction,
  AuditLogPagedResultDto,
  BalanceAdjustmentResultDto,
  GrantNodeRequest,
  UserPermissionGroupDto,
  UserProfileSummaryDto,
} from '../types/dtos/userManagement/UserProfileSummaryDtos';
import { PermissionGrantDto } from '../types/dtos/userManagement/PermissionGrantDto';
import { UserListDto } from '../types/dtos/auth/UserDtos';
import { ObjectManager } from './objectManager';

// docs/specs/user-management/IMPLEMENTATION_PLAN.md Phase 1 + Phase 2.
class UserManagementClient extends ObjectManager {
  private static instance: UserManagementClient;

  public static getInstance() {
    if (!UserManagementClient.instance) {
      UserManagementClient.instance = new UserManagementClient();
      UserManagementClient.instance.logger = logging.getLogger('UserManagementClient');
    }
    return UserManagementClient.instance;
  }

  getProfileSummary(id: number): Promise<UserProfileSummaryDto> {
    return this.invokeServiceCall(null, `${id}/profile-summary`, Controllers.Users, HttpMethod.Get);
  }

  // ===== Phase 2 quick actions (DESIGN.md §3) — each a thin wrapper over the same write the
  // generic FormWizard CRUD uses, tailored to the profile page's "target user from the route"
  // shape. Callers re-fetch getProfileSummary() after a successful write per DESIGN.md §3.

  assignGroup(userId: number, request: AssignGroupRequest): Promise<UserPermissionGroupDto> {
    return this.invokeServiceCall(request, `${userId}/groups`, Controllers.Users, HttpMethod.Post);
  }

  removeGroup(userId: number, permissionGroupId: number): Promise<void> {
    return this.invokeServiceCall(null, `${userId}/groups/${permissionGroupId}`, Controllers.Users, HttpMethod.Delete);
  }

  grantNode(userId: number, request: GrantNodeRequest): Promise<PermissionGrantDto> {
    return this.invokeServiceCall(request, `${userId}/grants`, Controllers.Users, HttpMethod.Post);
  }

  // KNG-59: removes the player's direct grant/deny for this exact node (every active row for it).
  // Group-inherited nodes are not touched - those change on the group itself. serviceCall drops
  // the request data on DELETE, so the node rides in the operation's query string.
  revokeNode(userId: number, node: string): Promise<void> {
    return this.invokeServiceCall(null, `${userId}/grants?node=${encodeURIComponent(node)}`, Controllers.Users, HttpMethod.Delete);
  }

  toggleVanishMode(userId: number, activeMode: ActiveMode): Promise<void> {
    return this.invokeServiceCall({ activeMode }, `${userId}/vanish-mode`, Controllers.Users, HttpMethod.Post);
  }

  // Developer request 2026-09-25: a web quick action for the same coins/gems/XP adjustment the
  // /knk user in-game command wraps - both call this identical PUT /api/users/{id}/balances.
  // Since the currency ledger (KNG-21 Phase 2) the server applies Add/Remove/Set itself (no
  // client-computed delta) and requires an Idempotency-Key: generate one per form submission and
  // reuse it when retrying that same submission, so a lost response can't apply it twice.
  adjustBalances(userId: number, request: AdjustBalancesRequestDto, idempotencyKey: string): Promise<BalanceAdjustmentResultDto> {
    return this.invokeServiceCall(request, `${userId}/balances`, Controllers.Users, HttpMethod.Put,
      { 'Idempotency-Key': idempotencyKey });
  }

  // GET /api/users/{id}/permissions/check - resolves one node through the in-house permission
  // system (wildcards included). Used by useStaffAccess for the staff-only moderation pages.
  checkPermission(userId: number, node: string): Promise<{ allowed: boolean }> {
    return this.invokeServiceCall({ node }, `${userId}/permissions/check`, Controllers.Users, HttpMethod.Get);
  }

  getAuditLog(params: {
    targetUserId?: number;
    actorUserId?: number;
    action?: AuditAction;
    direction?: 'promotion' | 'demotion';
    pageNumber?: number;
    pageSize?: number;
  }): Promise<AuditLogPagedResultDto> {
    // Query-string params only, no extra path segment — the backend route is the literal
    // "api/audit-log" (AuditLogController), not "api/audit-log/{operation}".
    const query: Record<string, string | number> = {};
    if (params.targetUserId !== undefined) query.targetUserId = params.targetUserId;
    if (params.actorUserId !== undefined) query.actorUserId = params.actorUserId;
    if (params.action !== undefined) query.action = params.action;
    if (params.direction !== undefined) query.direction = params.direction;
    if (params.pageNumber !== undefined) query.pageNumber = params.pageNumber;
    if (params.pageSize !== undefined) query.pageSize = params.pageSize;
    return this.invokeServiceCall(query, '', Controllers.AuditLog, HttpMethod.Get);
  }

  // ===== Phase 3 moderation search/filters (docs/specs/user-management/IMPLEMENTATION_PLAN.md
  // Phase 3, DESIGN.md §5) — UserModerationPage.tsx. Distinct from the generic
  // POST /api/Users/search (PagedQueryDto column filters) used by userClient.ts, since group
  // membership isn't a flat column on User.

  searchByGroup(groupId: number, onlineOnly?: boolean): Promise<UserListDto[]> {
    const query: Record<string, number | boolean> = { groupId };
    if (onlineOnly !== undefined) query.onlineOnly = onlineOnly;
    return this.invokeServiceCall(query, 'search', Controllers.Users, HttpMethod.Get);
  }
}

export const userManagementClient = UserManagementClient.getInstance();
