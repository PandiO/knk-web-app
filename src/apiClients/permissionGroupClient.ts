import { ObjectManager } from './objectManager';
import { logging } from '../utils';
import { Controllers, HttpMethod } from '../utils/enums';
import { PagedQueryDto, PagedResultDto } from '../types/dtos/common/PagedQuery';
import { ExpiringMembershipDto, PermissionGroupDto, PermissionGroupListDto } from '../types/dtos/userManagement/PermissionGroupDto';

// Originally a narrow client for PlayerProfilePage.tsx's group-assign quick action (docs/specs/
// user-management/IMPLEMENTATION_PLAN.md Phase 2). Widened 2026-09-25 with the full CRUD set
// (getById/create/update/delete/searchPaged) so PermissionGroup can be registered in
// entityApiMapping.ts for the generic ObjectDashboard/FormWizard - that registry is separate
// from (and in addition to) objectConfigs.tsx's ObjectConfig, discovered the hard way: without
// it, the dashboard throws "No search function registered for entity type: PermissionGroup"
// even with a valid ObjectConfig in place.
export class PermissionGroupClient extends ObjectManager {
  private static instance: PermissionGroupClient;

  public static getInstance() {
    if (!PermissionGroupClient.instance) {
      PermissionGroupClient.instance = new PermissionGroupClient();
      PermissionGroupClient.instance.logger = logging.getLogger('PermissionGroupClient');
    }
    return PermissionGroupClient.instance;
  }

  getAll(): Promise<PermissionGroupDto[]> {
    return this.invokeServiceCall(null, '', Controllers.PermissionGroups, HttpMethod.Get);
  }

  getById(id: number): Promise<PermissionGroupDto> {
    return this.invokeServiceCall(null, `${id}`, Controllers.PermissionGroups, HttpMethod.Get);
  }

  create(data: PermissionGroupDto): Promise<PermissionGroupDto> {
    return this.invokeServiceCall(data, '', Controllers.PermissionGroups, HttpMethod.Post);
  }

  update(data: PermissionGroupDto): Promise<void> {
    return this.invokeServiceCall(data, `${data.id}`, Controllers.PermissionGroups, HttpMethod.Put);
  }

  delete(id: number): Promise<void> {
    return this.invokeServiceCall(null, `${id}`, Controllers.PermissionGroups, HttpMethod.Delete);
  }

  searchPaged(queryParams: PagedQueryDto): Promise<PagedResultDto<PermissionGroupListDto>> {
    return this.invokeServiceCall(queryParams, 'search', Controllers.PermissionGroups, HttpMethod.Post);
  }

  // Phase 3 "premium expiring soon" moderation view (docs/specs/user-management/
  // IMPLEMENTATION_PLAN.md Phase 3) — UserModerationPage.tsx.
  getExpiringMemberships(groupId: number, withinDays: number): Promise<ExpiringMembershipDto[]> {
    return this.invokeServiceCall({ withinDays }, `${groupId}/expiring-memberships`, Controllers.PermissionGroups, HttpMethod.Get);
  }
}

export const permissionGroupClient = PermissionGroupClient.getInstance();
