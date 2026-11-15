import type { UserListDto } from '../../src/types/dtos/auth/UserDtos';
import type { PagedQueryDto, PagedResultDto } from '../../src/types/dtos/common/PagedQuery';
import type { LedgerLineDto, LedgerPageDto, TransferLockDto } from '../../src/types/dtos/currency/CurrencyDtos';
import type { KitAvailabilityDto } from '../../src/types/dtos/kit/KitDtos';
import type { PlayerSessionDto, StatisticsPagedResultDto } from '../../src/types/dtos/statistics/StatisticsDtos';
import type { PermissionGroupDto } from '../../src/types/dtos/userManagement/PermissionGroupDto';
import type { PermissionGrantDto } from '../../src/types/dtos/userManagement/PermissionGrantDto';
import type {
  AuditAction,
  AuditLogEntryDto,
  AuditLogPagedResultDto,
  EffectivePermissionEntryDto,
  GrantNodeRequest,
  PlayerModerationResultDto,
  UserProfileSummaryDto,
} from '../../src/types/dtos/userManagement/UserProfileSummaryDtos';
import type { MockApi } from '../support/mockApi';

/**
 * The staff player profile (`/admin/users/:id`) and the moderation list (`/admin/users`), typed with the
 * app's DTOs (PandiO/knk-workspace#119, backfill #511). `mockPlayerProfile` keeps the frozen state, so a
 * freeze or unfreeze the page sends is what the next read returns. Since #565 the frozen state (since when, by whom)
 * is in the profile summary's account, the game sessions have their own read, and kick / ban are answered (202) or
 * refused as the API would.
 */

export const playerId = 42;
export const playerUuid = '069a79f4-44e9-4726-a5be-fca90e38aaf5';

export function profileSummary(overrides: Partial<UserProfileSummaryDto> = {}): UserProfileSummaryDto {
  return {
    account: {
      id: playerId,
      username: 'Steve',
      uuid: playerUuid,
      email: 'steve@example.com',
      coins: 1234,
      gems: 5,
      experiencePoints: 4567,
      emailVerified: true,
      gatePassThroughMethodDefault: 'Default',
      activeMode: 'None',
      prestigeExperience: 0,
      personalSalaryMultiplier: 1,
      lastSalaryPayoutAt: '2026-11-08T08:00:00',
      isFullAccount: true,
      createdAt: '2026-01-01T00:00:00',
      isActive: true,
      admitted: true,
    },
    permissions: { userId: playerId, permissions: [] },
    groups: [{ userId: playerId, permissionGroupId: 2, permissionGroupName: 'Builder', weight: 10, isPremiumTier: false, isActive: true }],
    title: { titleName: 'Squire', prestigeExperience: 0, nextTitleName: 'Knight', nextTitleMinExperience: 5000 },
    salary: {
      titleSalary: 100,
      globalMultiplier: 1,
      personalMultiplier: 1,
      rankMultiplier: 1,
      effectiveHourlyRate: 100,
      lastSalaryPayoutAt: '2026-11-08T08:00:00',
      nextEligibleAt: '2026-11-08T09:00:00',
    },
    presence: { online: true, lastSeenAt: null },
    ...overrides,
  };
}

export const groups: PermissionGroupDto[] = [
  { id: 2, name: 'Builder', weight: 10, isPremiumTier: false, salaryMultiplier: 1 },
  { id: 3, name: 'Staff', weight: 50, isPremiumTier: false, salaryMultiplier: 1 },
];

export const kits: KitAvailabilityDto[] = [
  { kitId: 5, name: 'Starter', canClaim: true, isPurchased: false, isSinglePurchasePremium: false },
];

export function auditEntry(id: number, action: AuditAction, timestamp: string, details: string | null = null): AuditLogEntryDto {
  return { id, timestamp, action, targetUserId: playerId, targetUsername: 'Steve', actorUserId: 7, actorUsername: 'Alex', details };
}

export function ledgerLine(entryId: number, createdAt: string, amount: number, reason: string): LedgerLineDto {
  return {
    entryId,
    transactionId: entryId,
    publicId: `tx-${entryId}`,
    createdAt,
    userId: playerId,
    username: 'Steve',
    currency: 'Coins',
    operation: amount >= 0 ? 'Add' : 'Remove',
    amount,
    balanceBefore: 1000,
    balanceAfter: 1000 + amount,
    kind: 'AdminAdjustment',
    reasonCode: 'admin',
    reason,
    initiator: 'Admin',
    initiatorUserId: 7,
    initiatorUsername: 'Alex',
  };
}

export interface PlayerProfileMock {
  summary?: UserProfileSummaryDto;
  /** #565: `at` and `by` are the summary's frozenAt / frozenByUsername (defaults: a fixed time, "Mod"). */
  frozen?: { reason: string; at?: string; by?: string } | null;
  audit?: AuditLogEntryDto[];
  ledger?: LedgerLineDto[];
  /** #565: the player's game sessions (newest first, as the API sends them). */
  sessions?: PlayerSessionDto[];
  /** #565: how the API answers a kick or ban: 202 (default) or a refusal. */
  kickBanRefusal?: { status: number; error: string; message: string };
}

/** #565: one game session of player 42. */
export function gameSession(key: string, startedAt: string, endedAt: string | null, endReason: PlayerSessionDto['endReason'],
  activeSeconds: number, serverId = 'survival'): PlayerSessionDto {
  return { sessionKey: key, startedAt, endedAt, endReason, serverId, activeSeconds };
}

/** Every call the profile page makes for player 42, answered from `state`; freeze/unfreeze change the state. */
export function mockPlayerProfile(api: MockApi, state: PlayerProfileMock = {}): void {
  const summary = state.summary ?? profileSummary();
  let frozen = state.frozen ?? null;
  const audit = [...(state.audit ?? [])];
  const ledger = state.ledger ?? [];
  const sessions = state.sessions ?? [];
  let nextAuditId = 1000;

  // #565: the frozen state, since when and by whom, comes with the summary (no GET Users/42, no audit lookup).
  api.on<UserProfileSummaryDto>('GET', `Users/${playerId}/profile-summary`, () => ({
    body: {
      ...summary,
      account: {
        ...summary.account,
        isFrozen: frozen !== null,
        frozenReason: frozen?.reason ?? null,
        frozenAt: frozen ? frozen.at ?? '2026-11-08T07:30:00' : null,
        frozenByUserId: frozen ? 9 : null,
        frozenByUsername: frozen ? frozen.by ?? 'Mod' : null,
      },
    },
  }));
  api.on<StatisticsPagedResultDto<PlayerSessionDto>>('GET', `statistics/users/${playerId}/sessions`, ({ query }) => {
    const page = Number(query.get('page') ?? 1);
    const pageSize = Number(query.get('pageSize') ?? 20);
    return { body: { items: sessions.slice((page - 1) * pageSize, page * pageSize), totalCount: sessions.length, pageNumber: page, pageSize } };
  });
  api.json<KitAvailabilityDto[]>('GET', 'Kits/available', kits);
  api.json<TransferLockDto>('GET', `currency/admin/users/${playerId}/transfer-lock`, { userId: playerId, locked: false });
  api.json<PermissionGroupDto[]>('GET', /^PermissionGroups\/?$/, groups);

  api.on<AuditLogPagedResultDto>('GET', /^audit-log\/?$/, ({ query }) => {
    const action = query.get('action');
    const pageNumber = Number(query.get('pageNumber') ?? 1);
    const pageSize = Number(query.get('pageSize') ?? 25);
    const rows = audit
      .filter(e => !action || e.action === action)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    return { body: { items: rows.slice((pageNumber - 1) * pageSize, pageNumber * pageSize), totalCount: rows.length, pageNumber, pageSize } };
  });
  api.on<LedgerPageDto>('GET', /^currency\/admin\/ledger$/, ({ query }) => {
    const page = Number(query.get('page') ?? query.get('pageNumber') ?? 1);
    const pageSize = Number(query.get('pageSize') ?? 25);
    const rows = [...ledger].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return { body: { items: rows.slice((page - 1) * pageSize, page * pageSize), totalCount: rows.length, pageNumber: page, pageSize } };
  });

  api.on('PUT', `Users/${playerId}/freeze`, ({ body }) => {
    const reason = (body as { reason?: string } | undefined)?.reason ?? '';
    frozen = { reason, at: new Date().toISOString().replace('Z', ''), by: 'Alex' };
    audit.push(auditEntry(nextAuditId++, 'PlayerFrozen', new Date().toISOString(), JSON.stringify({ reason })));
    return { status: 204 };
  });
  api.on('PUT', `Users/${playerId}/unfreeze`, ({ body }) => {
    frozen = null;
    const reason = (body as { reason?: string } | undefined)?.reason ?? null;
    audit.push(auditEntry(nextAuditId++, 'PlayerUnfrozen', new Date().toISOString(), JSON.stringify({ reason })));
    return { status: 204 };
  });

  // #565: kick and ban (202 with the action id, or the refusal the test asks for); each accepted one is audited.
  for (const [verb, action] of [['kick', 'PlayerKicked'], ['ban', 'PlayerBanned']] as const) {
    api.on<PlayerModerationResultDto | { error: string; message: string }>('POST', `Users/${playerId}/${verb}`, ({ body }) => {
      if (state.kickBanRefusal) {
        return { status: state.kickBanRefusal.status, body: { error: state.kickBanRefusal.error, message: state.kickBanRefusal.message } };
      }
      const reason = (body as { reason?: string } | undefined)?.reason ?? null;
      audit.push(auditEntry(nextAuditId++, action, new Date().toISOString(),
        JSON.stringify(verb === 'ban' ? { reason, permanent: true } : { reason })));
      return { status: 202, body: { actionId: `action-${nextAuditId}`, userId: playerId, gameServers: 1 } };
    });
  }
}

/** A node player 42 holds directly (`granted` false: a direct deny). */
export const directNode = (node: string, granted = true): EffectivePermissionEntryDto =>
  ({ node, value: granted, sourceHolderId: playerId, sourceHolderType: 'User' });

/** A node player 42 inherits from a group. */
export const groupNode = (node: string, groupName: string, groupId: number, granted = true): EffectivePermissionEntryDto =>
  ({ node, value: granted, sourceHolderId: groupId, sourceHolderType: 'PermissionGroup', sourceHolderName: groupName });

/**
 * The Permissions tab's direct grants (PandiO/knk-workspace#407), on top of `mockPlayerProfile`: the profile summary
 * lists `permissions`, `POST Users/42/grants` adds or updates a direct node and `DELETE Users/42/grants?node=` removes
 * one, so the summary the page reads after a change shows it. Returns the live list.
 */
export function mockProfilePermissions(api: MockApi, permissions: EffectivePermissionEntryDto[]): EffectivePermissionEntryDto[] {
  const entries = [...permissions];
  api.on<UserProfileSummaryDto>('GET', `Users/${playerId}/profile-summary`, () => ({
    body: profileSummary({ permissions: { userId: playerId, permissions: [...entries] } }),
  }));
  api.on<PermissionGrantDto>('POST', `Users/${playerId}/grants`, ({ body }) => {
    const request = body as GrantNodeRequest;
    const entry = directNode(request.node, request.value);
    const at = entries.findIndex(e => e.node === request.node && e.sourceHolderType === 'User');
    if (at >= 0) entries[at] = entry;
    else entries.push(entry);
    return { body: { id: 500 + entries.length, holderId: playerId, holderType: 'User', node: request.node, value: request.value, expiresAt: request.expiresAt ?? null } };
  });
  api.on('DELETE', `Users/${playerId}/grants`, ({ query }) => {
    const at = entries.findIndex(e => e.node === query.get('node') && e.sourceHolderType === 'User');
    if (at >= 0) entries.splice(at, 1);
    return { status: 204 };
  });
  return entries;
}

export function playerRow(id: number, username: string, coins: number, isOnline = false): UserListDto {
  return {
    id,
    username,
    uuid: `00000000-0000-0000-0000-${String(id).padStart(12, '0')}`,
    email: `${username.toLowerCase()}@example.com`,
    coins,
    gems: 0,
    experiencePoints: coins * 2,
    isActive: true,
    isOnline,
    lastSeenAt: isOnline ? null : '2026-11-10T18:00:00',
  };
}

/** `POST Users/search` over `rows`: the search term matches name, email or UUID; sorts and pages like the API. */
export function mockPlayerSearch(api: MockApi, rows: UserListDto[]): void {
  api.on<PagedResultDto<UserListDto>>('POST', /^Users\/search$/, ({ body }) => {
    // The moderation list sends the API's `pageNumber` (toApiPagedQuery), not `page`.
    const query = body as PagedQueryDto & { pageNumber?: number };
    const pageNumber = query.pageNumber ?? query.page ?? 1;
    const term = (query.searchTerm ?? '').toLowerCase();
    let items = rows.filter(r => !term || [r.username, r.email ?? '', r.uuid ?? ''].some(v => v.toLowerCase().includes(term)));
    // #565: the state filters ("true" / "false").
    const filters = (query.filters ?? {}) as Record<string, string>;
    const flag = (name: string) => (filters[name] === 'true' ? true : filters[name] === 'false' ? false : undefined);
    const online = flag('online');
    const frozen = flag('frozen');
    const locked = flag('paymentsLocked');
    items = items.filter(r => (online === undefined || r.isOnline === online)
      && (frozen === undefined || (r.isFrozen ?? false) === frozen)
      && (locked === undefined || (r.paymentsLocked ?? false) === locked));
    if (query.sortBy) {
      // The API's keys are lower case (lastseenat, experiencepoints): find the row field that matches.
      const key = Object.keys(rows[0] ?? {}).find(k => k.toLowerCase() === query.sortBy!.toLowerCase()) ?? query.sortBy;
      const value = (r: UserListDto) => (r as unknown as Record<string, string | number>)[key] ?? '';
      items = [...items].sort((a, b) => (value(a) < value(b) ? -1 : value(a) > value(b) ? 1 : 0));
      if (query.sortDescending) items.reverse();
    }
    const start = (pageNumber - 1) * query.pageSize;
    return {
      body: {
        items: items.slice(start, start + query.pageSize),
        totalCount: items.length,
        page: pageNumber,
        pageSize: query.pageSize,
        totalPages: Math.max(1, Math.ceil(items.length / query.pageSize)),
      },
    };
  });
}
