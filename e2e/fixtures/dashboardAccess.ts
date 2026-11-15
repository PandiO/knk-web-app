import type { UserListDto } from '../../src/types/dtos/auth/UserDtos';
import type { CategoryDto } from '../../src/types/dtos/category/CategoryDtos';
import type { PagedQueryDto, PagedResultDto } from '../../src/types/dtos/common/PagedQuery';
import type { EntityMetadataDto } from '../../src/types/dtos/metadata/MetadataModels';
import type { StreetDto } from '../../src/types/dtos/street/StreetDto';
import type { TownDto } from '../../src/types/dtos/town/TownDto';
import type { MockApi } from '../support/mockApi';

/**
 * The dashboard's access model (PandiO/knk-workspace#280, #205, #371): entity metadata with the API's area and
 * action nodes, and the search endpoints of four types from three areas (backfill #511).
 */

export const WORLD = 'knk.admin.world';
export const CONTENT = 'knk.admin.content';
export const USERS = 'knk.admin.user.manage';

/** The metadata the API sends for a type of `area` (DashboardAccess registry): view, create, edit, delete, export. */
export function accessMetadata(entityName: string, area: string, bulkDeletable = true): EntityMetadataDto {
  return {
    entityName,
    displayName: entityName,
    fields: [],
    area,
    accessNode: area,
    readNodes: [area],
    deletable: true,
    bulkDeletable,
    exportable: true,
    actionNodes: {
      view: [area],
      create: [area],
      edit: [area],
      delete: [area, 'knk.admin.delete'],
      ...(bulkDeletable ? { bulkDelete: [area, 'knk.admin.delete', 'knk.admin.delete.bulk'] } : {}),
      export: [area, 'knk.admin.export'],
    },
  };
}

export const metadata: EntityMetadataDto[] = [
  {
    ...accessMetadata('Town', WORLD),
    lookupGettable: true,
    // Since #374 the API asks the area node and knk.admin.content for link changes.
    relationships: [
      { property: 'streets', relatedType: 'Street', kind: 'collection', storage: 'many', canLink: true, canUnlink: true, nodes: [WORLD, CONTENT] },
    ],
  },
  { ...accessMetadata('Street', WORLD), lookupSearchable: true, lookupGettable: true },
  accessMetadata('Category', CONTENT),
  accessMetadata('User', USERS, false),
];

export const streets: StreetDto[] = [
  { id: 1, name: 'Main Street' },
  { id: 2, name: 'Market Lane' },
  { id: 3, name: 'Harbour Road' },
  { id: 4, name: 'Old Wall' },
];
export const towns: TownDto[] = [{ id: 1, name: 'Cinix', allowEntry: true, requiredTitle: 0, worldName: 'world' }];
export const categories: CategoryDto[] = [{ id: '1', name: 'Weapons' }, { id: '2', name: 'Armour' }, { id: '3', name: 'Tools' }];
export const users: UserListDto[] = [
  { id: 42, username: 'Steve', email: 'steve@example.com', coins: 0, gems: 0, experiencePoints: 0, isActive: true, isOnline: false },
];

function paged<T>(rows: T[], body: unknown): PagedResultDto<T> {
  const query = body as PagedQueryDto & { pageNumber?: number };
  const page = query.pageNumber ?? query.page ?? 1;
  const pageSize = query.pageSize ?? 10;
  return { items: rows.slice((page - 1) * pageSize, page * pageSize), totalCount: rows.length, page, pageSize, totalPages: Math.max(1, Math.ceil(rows.length / pageSize)) };
}

/** The metadata above and a search per type; `liveStreets` is the street table, so a delete can take rows out of it. */
export function mockDashboardTypes(api: MockApi, liveStreets: StreetDto[] = [...streets]): StreetDto[] {
  api.json<EntityMetadataDto[]>('GET', 'Metadata/entities', metadata);
  api.on<PagedResultDto<StreetDto>>('POST', /^Streets\/search$/, ({ body }) => ({ body: paged(liveStreets, body) }));
  api.on<PagedResultDto<TownDto>>('POST', /^Towns\/search$/, ({ body }) => ({ body: paged(towns, body) }));
  api.on<PagedResultDto<CategoryDto>>('POST', /^Categor(y|ies)\/search$/, ({ body }) => ({ body: paged(categories, body) }));
  api.on<PagedResultDto<UserListDto>>('POST', /^Users\/search$/, ({ body }) => ({ body: paged(users, body) }));
  return liveStreets;
}
