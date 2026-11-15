import type { PagedQueryDto, PagedResultDto } from '../../src/types/dtos/common/PagedQuery';
import type { DisplayConfigurationDto } from '../../src/types/dtos/displayConfig/DisplayModels';
import type { EntityMetadataDto } from '../../src/types/dtos/metadata/MetadataModels';
import type { PermissionGrantDto, UpsertPermissionGrantByNodeDto } from '../../src/types/dtos/userManagement/PermissionGrantDto';
import type { PermissionGrantListDto } from '../../src/types/dtos/userManagement/PermissionGrantListDto';
import type { PermissionGroupDto, PermissionGroupMemberCountDto } from '../../src/types/dtos/userManagement/PermissionGroupDto';
import type { AuditLogEntryDto, AuditLogPagedResultDto } from '../../src/types/dtos/userManagement/UserProfileSummaryDtos';
import type { MockApi } from '../support/mockApi';

/**
 * A permission group's detail page with its Permissions panel (`/display/PermissionGroup/8`, PandiO/knk-workspace#50):
 * the Knight group, its own grants (read through POST api/PermissionGrants/search filtered on holderId), the blast
 * radius (GET api/PermissionGroups/8/member-count) and its History (GET api/audit-log by subject). The by-node writes
 * change the live grants and append an audit entry the way the API does (one row per group and node, one entry per
 * change, the group as subject).
 */

export const MANAGE_USERS = 'knk.admin.user.manage';
export const USER_PERMISSIONS = 'knk.admin.user.perm';
export const KNIGHT_ID = 8;
export const groupUrl = `/display/PermissionGroup/${KNIGHT_ID}`;

export const permissionGroupMetadata: EntityMetadataDto = {
  entityName: 'PermissionGroup',
  displayName: 'Permission Group',
  fields: [],
  area: 'Players',
  accessNode: MANAGE_USERS,
  writeNode: USER_PERMISSIONS,
  readNodes: [MANAGE_USERS],
  deletable: true,
  bulkDeletable: false,
  exportable: false,
  actionNodes: {
    view: [MANAGE_USERS],
    create: [USER_PERMISSIONS],
    edit: [USER_PERMISSIONS],
    delete: [USER_PERMISSIONS, 'knk.admin.delete'],
  },
};

export const knight: PermissionGroupDto = { id: KNIGHT_ID, name: 'Knight', weight: 10, isPremiumTier: false, salaryMultiplier: 1 };

export const groupDisplay: DisplayConfigurationDto = {
  id: '21',
  name: 'Permission group display',
  entityTypeName: 'PermissionGroup',
  isDefault: true,
  isDraft: false,
  sections: [{
    sectionGuid: 'g0',
    sectionName: 'Group',
    isReusable: false,
    isLinkedToSource: false,
    isCollection: false,
    subSections: [],
    fields: [
      { fieldGuid: 'gf0', label: 'Name', fieldName: 'name', fieldType: 'String', isReusable: false, isLinkedToSource: false },
      { fieldGuid: 'gf1', label: 'Weight', fieldName: 'weight', fieldType: 'Integer', isReusable: false, isLinkedToSource: false },
    ],
  }],
};

export const memberCount: PermissionGroupMemberCountDto = { groupId: KNIGHT_ID, directMembers: 4, totalMembers: 7, inheritingGroups: 2 };

export interface GroupState {
  grants: PermissionGrantListDto[];
  history: AuditLogEntryDto[];
}

const seedGrants = (): PermissionGrantListDto[] => [
  { id: 101, holderId: KNIGHT_ID, holderType: 'PermissionGroup', node: 'knk.fly', value: false, expiresAt: null },
  { id: 102, holderId: KNIGHT_ID, holderType: 'PermissionGroup', node: 'knk.gate.open', value: true, expiresAt: null },
  { id: 103, holderId: KNIGHT_ID, holderType: 'PermissionGroup', node: 'knk.kit.knight', value: true, expiresAt: '2027-03-01T12:00:00Z' },
];

const seedHistory = (): AuditLogEntryDto[] => [{
  id: 500,
  timestamp: '2026-11-10T09:00:00Z',
  actorUserId: 2,
  actorUsername: 'Alex',
  targetUserId: null,
  action: 'GrantAdded',
  details: JSON.stringify({ grantId: 102, node: 'knk.gate.open', value: true, expiresAt: null }),
  subjectType: 'PermissionGroup',
  subjectId: KNIGHT_ID,
}];

/**
 * Mocks the group's detail page and its panel. Returns the live state: writes change it, so the page's reload shows
 * the result. `count` overrides the member count (null: the count fails).
 */
export function mockGroupDetail(api: MockApi, count: PermissionGroupMemberCountDto | null = memberCount): GroupState {
  const state: GroupState = { grants: seedGrants(), history: seedHistory() };
  let nextGrantId = 200;
  let nextEntryId = 600;
  const audit = (action: AuditLogEntryDto['action'], details: object) => {
    state.history.unshift({
      id: nextEntryId++, timestamp: new Date().toISOString(), actorUserId: 2, actorUsername: 'Alex', targetUserId: null,
      action, details: JSON.stringify(details), subjectType: 'PermissionGroup', subjectId: KNIGHT_ID,
    });
  };

  api.json<EntityMetadataDto[]>('GET', 'Metadata/entities', [permissionGroupMetadata]);
  api.json<DisplayConfigurationDto>('GET', 'DisplayConfigurations/entity/PermissionGroup', groupDisplay);
  api.json<PermissionGroupDto>('GET', `PermissionGroups/${KNIGHT_ID}`, knight);
  api.on<PermissionGroupMemberCountDto>('GET', `PermissionGroups/${KNIGHT_ID}/member-count`, () =>
    count ? { body: count } : { status: 500, body: { error: 'Boom' } as never });

  api.on<PagedResultDto<PermissionGrantListDto>>('POST', 'PermissionGrants/search', ({ body }) => {
    const query = body as PagedQueryDto & { pageNumber?: number };
    const holderId = Number(query.filters?.holderId);
    const items = state.grants.filter(g => g.holderId === holderId).sort((a, b) => a.node.localeCompare(b.node));
    return { body: { items, totalCount: items.length, page: query.pageNumber ?? 1, pageSize: query.pageSize, totalPages: 1 } };
  });

  api.on<PermissionGrantDto>('PUT', 'PermissionGrants/by-node', ({ body }) => {
    const request = body as UpsertPermissionGrantByNodeDto;
    const existing = state.grants.find(g => g.holderId === request.holderId && g.node === request.node);
    if (existing) {
      audit('GrantUpdated', {
        grantId: existing.id,
        from: { node: existing.node, value: existing.value, expiresAt: existing.expiresAt ?? null },
        to: { node: request.node, value: request.value, expiresAt: request.expiresAt },
      });
      existing.value = request.value;
      existing.expiresAt = request.expiresAt;
      return { body: { ...existing, holderId: request.holderId } };
    }
    const created: PermissionGrantListDto = { id: nextGrantId++, holderType: 'PermissionGroup', ...request };
    state.grants.push(created);
    audit('GrantAdded', { grantId: created.id, node: created.node, value: created.value, expiresAt: created.expiresAt });
    return { body: { ...created, holderId: request.holderId } };
  });

  api.on('DELETE', 'PermissionGrants/by-node', ({ query }) => {
    const holderId = Number(query.get('holderId'));
    const node = query.get('node');
    const existing = state.grants.find(g => g.holderId === holderId && g.node === node);
    if (!existing) return { status: 404, body: { error: 'NotFound' } };
    state.grants = state.grants.filter(g => g !== existing);
    audit('GrantRemoved', { grantId: existing.id, node: existing.node, value: existing.value, expiresAt: existing.expiresAt ?? null });
    return { status: 204 };
  });

  api.on<AuditLogPagedResultDto>('GET', 'audit-log', ({ query }) => {
    const pageNumber = Number(query.get('pageNumber') ?? 1);
    const pageSize = Number(query.get('pageSize') ?? 20);
    const items = state.history.filter(e => e.subjectType === query.get('subjectType') && e.subjectId === Number(query.get('subjectId')));
    return { body: { items: items.slice((pageNumber - 1) * pageSize, pageNumber * pageSize), totalCount: items.length, pageNumber, pageSize } };
  });

  return state;
}
