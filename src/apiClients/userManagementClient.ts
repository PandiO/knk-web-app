import { logging, Controllers, HttpMethod } from '../utils';
import { UserProfileSummaryDto } from '../types/dtos/userManagement/UserProfileSummaryDtos';
import { ObjectManager } from './objectManager';

// docs/specs/user-management/IMPLEMENTATION_PLAN.md Phase 1.
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
}

export const userManagementClient = UserManagementClient.getInstance();
