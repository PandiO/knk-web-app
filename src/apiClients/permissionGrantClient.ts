import { ObjectManager } from './objectManager';
import { logging } from '../utils';
import { Controllers, HttpMethod } from '../utils/enums';
import { PagedQueryDto, PagedResultDto } from '../types/dtos/common/PagedQuery';
import { PermissionGrantDto } from '../types/dtos/userManagement/PermissionGrantDto';
import { PermissionGrantListDto } from '../types/dtos/userManagement/PermissionGrantListDto';

/**
 * Read-only client for the dashboard's PermissionGrant table (PandiO/knk-workspace#408): search and
 * get by id, both on `knk.admin.user.manage`. Grants are written through the by-node routes
 * (`userManagementClient.grantNode` on the player profile, the group editor of #50), so there is no
 * create, update or delete here and the generic form can't save a grant.
 */
export class PermissionGrantClient extends ObjectManager {
  private static instance: PermissionGrantClient;

  public static getInstance() {
    if (!PermissionGrantClient.instance) {
      PermissionGrantClient.instance = new PermissionGrantClient();
      PermissionGrantClient.instance.logger = logging.getLogger('PermissionGrantClient');
    }
    return PermissionGrantClient.instance;
  }

  getById(id: number): Promise<PermissionGrantDto> {
    return this.invokeServiceCall(null, `${id}`, Controllers.PermissionGrants, HttpMethod.Get);
  }

  searchPaged(query: PagedQueryDto): Promise<PagedResultDto<PermissionGrantListDto>> {
    return this.invokeServiceCall(query, 'search', Controllers.PermissionGrants, HttpMethod.Post);
  }
}

export const permissionGrantClient = PermissionGrantClient.getInstance();
