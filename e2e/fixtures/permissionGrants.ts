import type { PagedQueryDto, PagedResultDto } from '../../src/types/dtos/common/PagedQuery';
import type { EntityMetadataDto } from '../../src/types/dtos/metadata/MetadataModels';
import type { PermissionGrantListDto } from '../../src/types/dtos/userManagement/PermissionGrantListDto';

/**
 * The dashboard's PermissionGrant table (PandiO/knk-workspace#408): the type's metadata as the API's
 * DashboardAccess registry gives it (view on `knk.admin.user.manage`, writes on `knk.admin.user.perm`,
 * no delete), a Town entry for a viewer of another area, and twelve grants the mocked search pages,
 * sorts and filters like `PermissionGrantRepository.SearchAsync`.
 */

export const MANAGE_USERS = 'knk.admin.user.manage';
export const USER_PERMISSIONS = 'knk.admin.user.perm';

export const permissionGrantMetadata: EntityMetadataDto = {
  entityName: 'PermissionGrant',
  displayName: 'Permission Grant',
  fields: [],
  area: 'Players',
  accessNode: MANAGE_USERS,
  writeNode: USER_PERMISSIONS,
  readNodes: [MANAGE_USERS],
  deletable: false,
  bulkDeletable: false,
  exportable: false,
  actionNodes: { view: [MANAGE_USERS], create: [USER_PERMISSIONS], edit: [USER_PERMISSIONS] },
};

export const townMetadata: EntityMetadataDto = {
  entityName: 'Town',
  displayName: 'Town',
  fields: [],
  area: 'World',
  accessNode: 'knk.admin.world',
  writeNode: 'knk.admin.world',
  readNodes: ['knk.admin.world'],
  actionNodes: { view: ['knk.admin.world'], create: ['knk.admin.world', 'knk.admin.content'], edit: ['knk.admin.world', 'knk.admin.content'] },
};

const nodes = [
  'knk.admin.content', 'knk.admin.world', 'knk.fly', 'knk.gate.open', 'knk.kit.manage', 'knk.siege.admin.manage',
  'knk.admin.road', 'knk.tasks', 'knk.admin.item', 'knk.gamemode.others', 'knk.admin.export', 'knk.admin.user.manage',
];

/** Twelve grants: ids 1–12, odd ids on the Staff group (holder 8), even ids on user 1; id 3 is a deny. */
export const grants: PermissionGrantListDto[] = nodes.map((node, index) => ({
  id: index + 1,
  holderId: index % 2 === 0 ? 8 : 1,
  holderType: index % 2 === 0 ? 'PermissionGroup' : 'User',
  node,
  value: index !== 2,
  expiresAt: index === 1 ? '2027-01-15T10:30:00' : index === 4 ? '2026-12-01T00:00:00' : null,
}));

type SortKey = 'id' | 'holderId' | 'value' | 'expiresAt' | 'node';

function compare(a: PermissionGrantListDto, b: PermissionGrantListDto, key: SortKey): number {
  const left = a[key] ?? '';
  const right = b[key] ?? '';
  if (left < right) return -1;
  if (left > right) return 1;
  return a.node.localeCompare(b.node);
}

/** The search as the API runs it: node contains the term, sort by the asked column (node by default), then the page. */
export function searchGrants(query: PagedQueryDto & { pageNumber?: number }): PagedResultDto<PermissionGrantListDto> {
  const term = (query.searchTerm ?? '').toLowerCase();
  const key = (['id', 'holderId', 'value', 'expiresAt'].includes(query.sortBy ?? '') ? query.sortBy : 'node') as SortKey;
  const matching = grants
    .filter(grant => grant.node.toLowerCase().includes(term))
    .sort((a, b) => (query.sortDescending ? -1 : 1) * compare(a, b, key));
  const page = query.pageNumber ?? query.page;
  const items = matching.slice((page - 1) * query.pageSize, page * query.pageSize);
  return { items, totalCount: matching.length, page, pageSize: query.pageSize, totalPages: Math.ceil(matching.length / query.pageSize) };
}
