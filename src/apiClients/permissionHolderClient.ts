import { ObjectManager } from './objectManager';
import { logging } from '../utils';
import { Controllers, HttpMethod } from '../utils/enums';
import { PagedQueryDto, PagedResultDto } from '../types/dtos/common/PagedQuery';
import { PermissionHolderListDto } from '../types/dtos/userManagement/PermissionHolderListDto';

/** Read-only client for PermissionGrant.Holder's polymorphic relationship picker. */
export class PermissionHolderClient extends ObjectManager {
  private static instance: PermissionHolderClient;

  public static getInstance() {
    if (!PermissionHolderClient.instance) {
      PermissionHolderClient.instance = new PermissionHolderClient();
      PermissionHolderClient.instance.logger = logging.getLogger('PermissionHolderClient');
    }
    return PermissionHolderClient.instance;
  }

  getById(id: number): Promise<PermissionHolderListDto> {
    return this.invokeServiceCall(null, `${id}`, Controllers.PermissionHolders, HttpMethod.Get);
  }

  searchPaged(query: PagedQueryDto): Promise<PagedResultDto<PermissionHolderListDto>> {
    return this.invokeServiceCall(query, 'search', Controllers.PermissionHolders, HttpMethod.Post);
  }
}

export const permissionHolderClient = PermissionHolderClient.getInstance();
