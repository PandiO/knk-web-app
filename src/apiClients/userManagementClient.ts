import { logging, Controllers, HttpMethod } from '../utils';
import {
  ActiveMode,
  AssignGroupRequest,
  AuditLogPagedResultDto,
  GrantNodeRequest,
  UserPermissionGroupDto,
  UserProfileSummaryDto,
} from '../types/dtos/userManagement/UserProfileSummaryDtos';
import { PermissionGrantDto } from '../types/dtos/userManagement/PermissionGrantDto';
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

  toggleVanishMode(userId: number, activeMode: ActiveMode): Promise<void> {
    return this.invokeServiceCall({ activeMode }, `${userId}/vanish-mode`, Controllers.Users, HttpMethod.Post);
  }

  getAuditLog(params: {
    targetUserId?: number;
    actorUserId?: number;
    pageNumber?: number;
    pageSize?: number;
  }): Promise<AuditLogPagedResultDto> {
    // Query-string params only, no extra path segment — the backend route is the literal
    // "api/audit-log" (AuditLogController), not "api/audit-log/{operation}".
    const query: Record<string, number> = {};
    if (params.targetUserId !== undefined) query.targetUserId = params.targetUserId;
    if (params.actorUserId !== undefined) query.actorUserId = params.actorUserId;
    if (params.pageNumber !== undefined) query.pageNumber = params.pageNumber;
    if (params.pageSize !== undefined) query.pageSize = params.pageSize;
    return this.invokeServiceCall(query, '', Controllers.AuditLog, HttpMethod.Get);
  }
}

export const userManagementClient = UserManagementClient.getInstance();
