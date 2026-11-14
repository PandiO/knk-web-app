import type { UserListDto } from '../../src/types/dtos/auth/UserDtos';
import type { PagedQueryDto, PagedResultDto } from '../../src/types/dtos/common/PagedQuery';
import type { LedgerLineDto, LedgerPageDto, TransferLockDto } from '../../src/types/dtos/currency/CurrencyDtos';
import type { KitAvailabilityDto } from '../../src/types/dtos/kit/KitDtos';
import type { PermissionGroupDto } from '../../src/types/dtos/userManagement/PermissionGroupDto';
import type {
  AuditAction,
  AuditLogEntryDto,
  AuditLogPagedResultDto,
  UserProfileSummaryDto,
} from '../../src/types/dtos/userManagement/UserProfileSummaryDtos';
import type { MockApi } from '../support/mockApi';

/**
 * The staff player profile (`/admin/users/:id`) and the moderation list (`/admin/users`), typed with the
 * app's DTOs (PandiO/knk-workspace#119, backfill #511). `mockPlayerProfile` keeps the frozen state, so a
 * freeze or unfreeze the page sends is what the next read returns.
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
  frozen?: { reason: string } | null;
  audit?: AuditLogEntryDto[];
  ledger?: LedgerLineDto[];
}

/** Every call the profile page makes for player 42, answered from `state`; freeze/unfreeze change the state. */
export function mockPlayerProfile(api: MockApi, state: PlayerProfileMock = {}): void {
  const summary = state.summary ?? profileSummary();
  let frozen = state.frozen ?? null;
  const audit = [...(state.audit ?? [])];
  const ledger = state.ledger ?? [];
  let nextAuditId = 1000;

  api.json<UserProfileSummaryDto>('GET', `Users/${playerId}/profile-summary`, summary);
  api.on<{ id: number; username: string; isFrozen: boolean; frozenReason: string | null }>('GET', `Users/${playerId}`, () => ({
    body: { id: playerId, username: summary.account.username, isFrozen: frozen !== null, frozenReason: frozen?.reason ?? null },
  }));
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
    frozen = { reason };
    audit.push(auditEntry(nextAuditId++, 'PlayerFrozen', new Date().toISOString(), JSON.stringify({ reason })));
    return { status: 204 };
  });
  api.on('PUT', `Users/${playerId}/unfreeze`, () => {
    frozen = null;
    audit.push(auditEntry(nextAuditId++, 'PlayerUnfrozen', new Date().toISOString()));
    return { status: 204 };
  });
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
    if (query.sortBy) {
      const key = query.sortBy.charAt(0).toLowerCase() + query.sortBy.slice(1);
      const value = (r: UserListDto) => (r as unknown as Record<string, string | number>)[key];
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
