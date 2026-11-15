import { ObjectManager } from './objectManager';
import { logging } from '../utils';
import { Controllers, HttpMethod } from '../utils/enums';
import { PagedQueryDto, PagedResultDto } from '../types/dtos/common/PagedQuery';
import { PermissionGrantDto, UpsertPermissionGrantByNodeDto } from '../types/dtos/userManagement/PermissionGrantDto';
import { PermissionGrantListDto } from '../types/dtos/userManagement/PermissionGrantListDto';

/** How many of one holder's own grants `getForHolder` reads in one go (a group has a few dozen at most). */
export const HOLDER_GRANTS_PAGE_SIZE = 500;

/**
 * Client for permission grants. Reads (PandiO/knk-workspace#408): search and get by id, both on
 * `knk.admin.user.manage`, used by the dashboard's PermissionGrant table. Writes (#50): only the by-node routes on
 * `knk.admin.user.perm`, used by the group Permissions panel (the player profile writes through
 * `userManagementClient.grantNode`). There is still no create, update or delete by id, so the generic form can't save
 * a grant and the dashboard offers no delete that would skip the panel's blast-radius confirmation.
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

  /**
   * One holder's own grants (a group's Permissions panel, #50): `searchPaged` filtered on `holderId`, sorted by node,
   * expired rows included (the API keeps one row per holder and node). The API reads `pageNumber`.
   */
  getForHolder(holderId: number): Promise<PagedResultDto<PermissionGrantListDto>> {
    return this.searchPaged({
      page: 1,
      pageNumber: 1,
      pageSize: HOLDER_GRANTS_PAGE_SIZE,
      sortBy: 'node',
      sortDescending: false,
      filters: { holderId: String(holderId) },
    } as PagedQueryDto);
  }

  /** PUT api/PermissionGrants/by-node: grant, deny or change the expiry of a node; an existing node is updated. */
  upsertByNode(request: UpsertPermissionGrantByNodeDto): Promise<PermissionGrantDto> {
    return this.invokeServiceCall(request, 'by-node', Controllers.PermissionGrants, HttpMethod.Put);
  }

  /**
   * DELETE api/PermissionGrants/by-node: removes the holder's grant or deny of this exact node. serviceCall drops the
   * request data on DELETE, so both ride in the query string.
   */
  revokeByNode(holderId: number, node: string): Promise<void> {
    return this.invokeServiceCall(null, `by-node?holderId=${holderId}&node=${encodeURIComponent(node)}`,
      Controllers.PermissionGrants, HttpMethod.Delete);
  }
}

export const permissionGrantClient = PermissionGrantClient.getInstance();
