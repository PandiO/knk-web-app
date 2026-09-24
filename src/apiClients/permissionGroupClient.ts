import { ObjectManager } from './objectManager';
import { logging } from '../utils';
import { Controllers, HttpMethod } from '../utils/enums';
import { ExpiringMembershipDto, PermissionGroupDto } from '../types/dtos/userManagement/PermissionGroupDto';

// Narrow client for PlayerProfilePage.tsx's group-assign quick action (docs/specs/
// user-management/IMPLEMENTATION_PLAN.md Phase 2) — see PermissionGroupDto.ts for why this isn't
// the generic CRUD path.
class PermissionGroupClient extends ObjectManager {
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

  // Phase 3 "premium expiring soon" moderation view (docs/specs/user-management/
  // IMPLEMENTATION_PLAN.md Phase 3) — UserModerationPage.tsx.
  getExpiringMemberships(groupId: number, withinDays: number): Promise<ExpiringMembershipDto[]> {
    return this.invokeServiceCall({ withinDays }, `${groupId}/expiring-memberships`, Controllers.PermissionGroups, HttpMethod.Get);
  }
}

export const permissionGroupClient = PermissionGroupClient.getInstance();
