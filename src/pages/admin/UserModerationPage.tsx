import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, Search, Users, Clock, TrendingDown, List, Coins, SlidersHorizontal, ShieldAlert, MapPinOff, Ticket } from 'lucide-react';
import { userManagementClient } from '../../apiClients/userManagementClient';
import { permissionGroupClient } from '../../apiClients/permissionGroupClient';
import { userClient } from '../../apiClients/userClient';
import { PermissionGroupDto, ExpiringMembershipDto } from '../../types/dtos/userManagement/PermissionGroupDto';
import { AuditLogEntryDto } from '../../types/dtos/userManagement/UserProfileSummaryDtos';
import { UserListDto } from '../../types/dtos/auth/UserDtos';
import { toApiPagedQuery } from '../../utils/entityApiMapping';
import { usePermission } from '../../hooks/useStaffAccess';
import { useTabParam } from '../../hooks/useTabParam';
import { CURRENCY_NODES } from '../../types/dtos/currency/CurrencyDtos';
import { INVITATION_NODES } from '../../types/dtos/invitations/InvitationDtos';
import { LOCATION_RETENTION_NODES } from '../../types/dtos/locationRetention/LocationRetentionDtos';
import { DataTable, DataTableColumn } from '../../components/DataTable';
import { Pager } from '../../components/Pager';
import { Field } from '../../components/Field';
import { formatDateTime, formatNumber } from '../../utils/format';
import { PresenceChangedPayload, usePresenceChanges } from '../../realtime/liveUpdates';

// docs/specs/user-management/DESIGN.md §5, IMPLEMENTATION_PLAN.md Phase 3 - a moderation-oriented
// list separate from the generic ObjectDashboard/PagedEntityTable system, since "users in group
// X", "premium expiring soon", and "recently demoted" are cross-entity queries the generic
// column-filter system can't express (DESIGN.md §5's own reasoning, not re-litigated here). Also
// closes Phase 1/2's carried-forward "no generic-dashboard entry point into PlayerProfilePage"
// item: every row here links to /admin/users/:id.

type Tab = 'all' | 'group' | 'expiring' | 'demoted';
const TAB_KEYS: readonly Tab[] = ['all', 'group', 'expiring', 'demoted'];

/**
 * #39 (CRUD-4), #187: every list is a DataTable whose rows open the player's profile. The name is a real link
 * (middle-click, Ctrl/Cmd-click, keyboard); a click anywhere else on the row opens it too.
 */
const profilePath = (userId: number | string | null | undefined): string | undefined =>
    userId == null ? undefined : `/admin/users/${userId}`;

const onlineBadge = (isOnline?: boolean) => isOnline ? (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-success-muted text-success-strong">Online</span>
) : (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-surface-alt text-muted">Offline</span>
);

const filterClass = 'input px-3 py-2 min-w-[220px]';

/** #183: one player's new online state on the rows that show them (other rows unchanged). */
export const applyPresence = <T extends Pick<UserListDto, 'id' | 'isOnline' | 'lastSeenAt'>>(
    rows: T[] | null,
    change: PresenceChangedPayload,
): T[] | null => {
    if (!rows || change.userId == null || !rows.some(row => row.id === change.userId)) return rows;
    return rows.map(row => row.id === change.userId
        ? { ...row, isOnline: change.online === true, lastSeenAt: change.lastSeenAt ?? row.lastSeenAt }
        : row);
};

export const UserModerationPage: React.FC = () => {
    const navigate = useNavigate();
    // #39: the tab is in the URL (?tab=group), so Back from a player's profile comes back to it.
    const [tab, setTab] = useTabParam(TAB_KEYS, 'all');
    const { allowed: canReadLedger } = usePermission(CURRENCY_NODES.history);
    const { allowed: canEditPolicy } = usePermission(CURRENCY_NODES.policy);
    const { allowed: canSeeAlerts } = usePermission(CURRENCY_NODES.alerts);
    const { allowed: canReviewLocations } = usePermission(LOCATION_RETENTION_NODES.view);
    const { allowed: canManageInvites } = usePermission(INVITATION_NODES.manage);

    const [groups, setGroups] = React.useState<PermissionGroupDto[]>([]);
    const [groupsLoading, setGroupsLoading] = React.useState(true);

    React.useEffect(() => {
        permissionGroupClient.getAll()
            .then(setGroups)
            .catch((err) => console.error('Failed to load permission groups:', err))
            .finally(() => setGroupsLoading(false));
    }, []);

    // ----- "All players" tab (developer feedback: the view had no way to just see everyone) -
    // reuses the existing generic POST /api/Users/search (PagedQueryDto), same endpoint the
    // ObjectDashboard/PagedEntityTable system uses elsewhere, since a flat "every user" list
    // doesn't need any of this page's cross-entity moderation logic. -----
    const ALL_PAGE_SIZE = 20;
    const [allSearchTerm, setAllSearchTerm] = React.useState('');
    const [allPage, setAllPage] = React.useState(1);
    const [allResults, setAllResults] = React.useState<UserListDto[] | null>(null);
    const [allTotalCount, setAllTotalCount] = React.useState(0);
    const [allLoading, setAllLoading] = React.useState(false);
    const [allError, setAllError] = React.useState<string | null>(null);

    // The term of the last search run (the box may have changed since), for a live re-read (#183).
    const allTermRef = React.useRef('');
    const runAllSearch = React.useCallback(async (page: number, searchTerm: string, quiet = false) => {
        if (!quiet) {
            setAllLoading(true);
            setAllError(null);
        }
        allTermRef.current = searchTerm;
        try {
            // The backend's PagedQueryDto only binds a "pageNumber" JSON field, not "page" - a
            // bare { page, ... } body silently pins the server at its default page (1) no matter
            // what's requested. toApiPagedQuery is the same page->pageNumber translation
            // entityApiMapping.ts's generic search wrapper already applies; this call site talks
            // to userClient directly so it has to apply it too.
            const result = await userClient.searchPaged(toApiPagedQuery({ page, pageSize: ALL_PAGE_SIZE, searchTerm: searchTerm || undefined }));
            setAllResults(result.items);
            setAllTotalCount(result.totalCount);
            // Backend's raw PagedResult wire shape is {pageNumber, pageSize, totalCount}, not
            // {page,...} - result.page (typed per the shared PagedResultDto interface) is
            // actually undefined at runtime here since userClient.searchPaged() returns the raw
            // response, unlike entityApiMapping.ts's normalizePagedResult which remaps it.
            // Trusting the page we requested rather than an unreliable response field.
            setAllPage(page);
        } catch (err) {
            console.error('Failed to load all players:', err);
            if (!quiet) setAllError('Could not load players.');
        } finally {
            if (!quiet) setAllLoading(false);
        }
    }, []);

    // Auto-run on first visit, like "recently demoted" - no filter selection needed to see a
    // useful result.
    React.useEffect(() => {
        if (tab === 'all' && allResults === null && !allLoading) {
            void runAllSearch(1, allSearchTerm);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab, allResults, allLoading]);

    const openProfile = (userId: number | string | null | undefined) => {
        const path = profilePath(userId);
        if (path) navigate(path);
    };

    const allColumns: DataTableColumn<UserListDto>[] = [
        { key: 'username', header: 'Username', className: 'font-medium' },
        { key: 'email', header: 'Email' },
        { key: 'status', header: 'Status', cell: u => onlineBadge(u.isOnline) },
        { key: 'coins', header: 'Coins', align: 'right', cell: u => formatNumber(u.coins) },
        { key: 'experiencePoints', header: 'XP', align: 'right', cell: u => formatNumber(u.experiencePoints) },
    ];
    const groupColumns: DataTableColumn<UserListDto>[] = [
        { key: 'username', header: 'Username', className: 'font-medium' },
        { key: 'status', header: 'Status', cell: u => onlineBadge(u.isOnline) },
        { key: 'lastSeenAt', header: 'Last seen', cell: u => formatDateTime(u.lastSeenAt) },
    ];
    const expiringColumns: DataTableColumn<ExpiringMembershipDto>[] = [
        { key: 'username', header: 'Username', className: 'font-medium' },
        { key: 'expiresAt', header: 'Expires', cell: m => formatDateTime(m.expiresAt) },
    ];
    const demotedColumns: DataTableColumn<AuditLogEntryDto>[] = [
        { key: 'player', header: 'Player', className: 'font-medium', cell: e => e.targetUsername ?? `#${e.targetUserId}` },
        { key: 'timestamp', header: 'When', cell: e => formatDateTime(e.timestamp) },
        { key: 'details', header: 'Details', className: 'font-mono text-xs' },
    ];
    const tableProps = { density: 'compact' as const, className: 'border border-line rounded-md' };

    // ----- "By group" tab (also covers "currently online", combined with a group filter -
    // there is no server-wide online list, only GET /api/Users/search?groupId=&onlineOnly=) -----
    const [selectedGroupId, setSelectedGroupId] = React.useState<string>('');
    const [onlineOnly, setOnlineOnly] = React.useState(false);
    const [groupResults, setGroupResults] = React.useState<UserListDto[] | null>(null);
    const [groupLoading, setGroupLoading] = React.useState(false);
    const [groupError, setGroupError] = React.useState<string | null>(null);

    // The filter of the shown results (the pickers may have changed since), for a live re-read (#183).
    const groupQueryRef = React.useRef<{ groupId: number; onlineOnly: boolean } | null>(null);
    const loadGroup = React.useCallback(async (groupId: number, online: boolean, quiet: boolean) => {
        if (!quiet) {
            setGroupLoading(true);
            setGroupError(null);
        }
        try {
            const result = await userManagementClient.searchByGroup(groupId, online || undefined);
            groupQueryRef.current = { groupId, onlineOnly: online };
            setGroupResults(result);
        } catch (err) {
            console.error('Failed to search users by group:', err);
            if (!quiet) setGroupError('Could not load users for this group.');
        } finally {
            if (!quiet) setGroupLoading(false);
        }
    }, []);
    const runGroupSearch = React.useCallback(async () => {
        if (!selectedGroupId) return;
        await loadGroup(Number(selectedGroupId), onlineOnly, false);
    }, [selectedGroupId, onlineOnly, loadGroup]);

    // #183 (Realtime S4): the Online/Offline badges follow the game while the web hub is connected.
    // One player: their rows change in place (rows are never added or removed under the cursor; Search
    // re-runs the filter). Many at once, or after a hub reconnect: the shown lists are read again quietly.
    usePresenceChanges(change => {
        if (change?.userId != null) {
            setAllResults(rows => applyPresence(rows, change));
            setGroupResults(rows => applyPresence(rows, change));
            return;
        }
        if (allResults !== null) void runAllSearch(allPage, allTermRef.current, true);
        const shownGroup = groupQueryRef.current;
        if (groupResults !== null && shownGroup) void loadGroup(shownGroup.groupId, shownGroup.onlineOnly, true);
    });

    // ----- "Expiring premium" tab -----
    const premiumGroups = groups.filter((g) => g.isPremiumTier);
    const [expiringGroupId, setExpiringGroupId] = React.useState<string>('');
    const [withinDays, setWithinDays] = React.useState<number>(7);
    const [expiringResults, setExpiringResults] = React.useState<ExpiringMembershipDto[] | null>(null);
    const [expiringLoading, setExpiringLoading] = React.useState(false);
    const [expiringError, setExpiringError] = React.useState<string | null>(null);

    const runExpiringSearch = React.useCallback(async () => {
        if (!expiringGroupId || withinDays <= 0) return;
        setExpiringLoading(true);
        setExpiringError(null);
        try {
            const result = await permissionGroupClient.getExpiringMemberships(Number(expiringGroupId), withinDays);
            setExpiringResults(result);
        } catch (err) {
            console.error('Failed to load expiring memberships:', err);
            setExpiringError('Could not load expiring memberships for this group.');
        } finally {
            setExpiringLoading(false);
        }
    }, [expiringGroupId, withinDays]);

    // ----- "Recently demoted" tab -----
    const [demotedResults, setDemotedResults] = React.useState<AuditLogEntryDto[] | null>(null);
    const [demotedLoading, setDemotedLoading] = React.useState(false);
    const [demotedError, setDemotedError] = React.useState<string | null>(null);

    const runDemotedSearch = React.useCallback(async () => {
        setDemotedLoading(true);
        setDemotedError(null);
        try {
            const result = await userManagementClient.getAuditLog({ action: 'TitleChanged', direction: 'demotion', pageSize: 50 });
            setDemotedResults(result.items);
        } catch (err) {
            console.error('Failed to load recently demoted players:', err);
            setDemotedError('Could not load recently demoted players.');
        } finally {
            setDemotedLoading(false);
        }
    }, []);

    // Auto-run "recently demoted" on first visit to that tab, since it has no filter inputs to
    // wait on (unlike the group/expiring tabs, which need a selection first).
    React.useEffect(() => {
        if (tab === 'demoted' && demotedResults === null && !demotedLoading) {
            void runDemotedSearch();
        }
    }, [tab, demotedResults, demotedLoading, runDemotedSearch]);

    const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
        { key: 'all', label: 'All players', icon: <List className="h-4 w-4 mr-2" /> },
        { key: 'group', label: 'By group / online', icon: <Users className="h-4 w-4 mr-2" /> },
        { key: 'expiring', label: 'Premium expiring soon', icon: <Clock className="h-4 w-4 mr-2" /> },
        { key: 'demoted', label: 'Recently demoted', icon: <TrendingDown className="h-4 w-4 mr-2" /> },
    ];

    return (
        <div className="min-h-screen">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                        <h1 className="text-2xl font-bold text-fg">Player moderation</h1>
                        <p className="mt-1 text-sm text-muted">
                            Browse every player, or search for moderation tasks — group membership, expiring
                            premium tiers, and recent title demotions. Click any row to open that player&apos;s profile.
                        </p>
                    </div>
                    {/* Currency ledger Phases 4-5 (KNG-23): shown only to holders of the pages' nodes. */}
                    <div className="flex flex-wrap gap-2">
                        {canReadLedger && (
                            <Link to="/admin/users/balance-log" className="btn-secondary text-sm whitespace-nowrap">
                                <Coins className="h-4 w-4 mr-2" />
                                Balance log
                            </Link>
                        )}
                        {canEditPolicy && (
                            <Link to="/admin/economy/policy" className="btn-secondary text-sm whitespace-nowrap">
                                <SlidersHorizontal className="h-4 w-4 mr-2" />
                                Currency policy
                            </Link>
                        )}
                        {canSeeAlerts && (
                            <Link to="/admin/economy/alerts" className="btn-secondary text-sm whitespace-nowrap">
                                <ShieldAlert className="h-4 w-4 mr-2" />
                                Currency alerts
                            </Link>
                        )}
                        {canManageInvites && (
                            <Link to="/admin/invitations" className="btn-secondary text-sm whitespace-nowrap">
                                <Ticket className="h-4 w-4 mr-2" />
                                Invitations
                            </Link>
                        )}
                        {canReviewLocations && (
                            <Link to="/admin/locations/orphans" className="btn-secondary text-sm whitespace-nowrap">
                                <MapPinOff className="h-4 w-4 mr-2" />
                                Orphaned Locations
                            </Link>
                        )}
                    </div>
                </div>

                <div className="panel">
                    <div className="border-b border-line flex flex-wrap">
                        {tabs.map((t) => (
                            <button
                                key={t.key}
                                onClick={() => setTab(t.key)}
                                className={`inline-flex items-center px-4 py-3 text-sm font-medium border-b-2 -mb-px ${
                                    tab === t.key
                                        ? 'border-primary text-fg'
                                        : 'border-transparent text-muted hover:text-fg'
                                }`}
                            >
                                {t.icon}
                                {t.label}
                            </button>
                        ))}
                    </div>

                    <div className="p-6">
                        {tab === 'all' && (
                            <div className="space-y-4">
                                <div className="flex flex-wrap items-end gap-3">
                                    <Field label="Search username / email / UUID" labelClassName="block text-xs font-medium text-muted mb-1">
                                        <input
                                            type="text"
                                            className={filterClass}
                                            value={allSearchTerm}
                                            onChange={(e) => setAllSearchTerm(e.target.value)}
                                            onKeyDown={(e) => { if (e.key === 'Enter') void runAllSearch(1, allSearchTerm); }}
                                            placeholder="Leave blank to list everyone"
                                        />
                                    </Field>
                                    <button
                                        className="btn-primary text-sm inline-flex items-center"
                                        disabled={allLoading}
                                        onClick={() => void runAllSearch(1, allSearchTerm)}
                                    >
                                        {allLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                                        Search
                                    </button>
                                </div>
                                {allError && <p className="text-sm field-error" role="alert">{allError}</p>}
                                {allResults && (
                                    <div>
                                        <DataTable
                                            {...tableProps}
                                            caption="All players"
                                            columns={allColumns}
                                            rows={allResults}
                                            rowKey={u => String(u.id)}
                                            rowHref={u => profilePath(u.id)}
                                            onRowClick={u => openProfile(u.id)}
                                            empty="No matching players."
                                        />
                                        {allResults.length > 0 && (
                                            <Pager
                                                label="All players pages"
                                                noun="players"
                                                page={allPage}
                                                pageSize={ALL_PAGE_SIZE}
                                                totalCount={allTotalCount}
                                                disabled={allLoading}
                                                onPageChange={page => void runAllSearch(page, allSearchTerm)}
                                            />
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {tab === 'group' && (
                            <div className="space-y-4">
                                <div className="flex flex-wrap items-end gap-3">
                                    <Field label="Permission group" labelClassName="block text-xs font-medium text-muted mb-1">
                                        <select
                                            className={filterClass}
                                            value={selectedGroupId}
                                            onChange={(e) => setSelectedGroupId(e.target.value)}
                                            disabled={groupsLoading}
                                        >
                                            <option value="">Select a group&hellip;</option>
                                            {groups.map((g) => (
                                                <option key={g.id} value={g.id ?? ''}>{g.name}</option>
                                            ))}
                                        </select>
                                    </Field>
                                    <Field label="Currently online only" inline className="pb-2">
                                        <input
                                            type="checkbox"
                                            checked={onlineOnly}
                                            onChange={(e) => setOnlineOnly(e.target.checked)}
                                            className="rounded border-field text-primary focus:ring-primary"
                                        />
                                    </Field>
                                    <button
                                        className="btn-primary text-sm inline-flex items-center"
                                        disabled={!selectedGroupId || groupLoading}
                                        onClick={() => void runGroupSearch()}
                                    >
                                        {groupLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                                        Search
                                    </button>
                                </div>
                                {groupError && <p className="text-sm field-error" role="alert">{groupError}</p>}
                                {groupResults && (
                                    <DataTable
                                        {...tableProps}
                                        caption="Players in the group"
                                        columns={groupColumns}
                                        rows={groupResults}
                                        rowKey={u => String(u.id)}
                                        rowHref={u => profilePath(u.id)}
                                        onRowClick={u => openProfile(u.id)}
                                        empty="No matching players."
                                    />
                                )}
                            </div>
                        )}

                        {tab === 'expiring' && (
                            <div className="space-y-4">
                                <div className="flex flex-wrap items-end gap-3">
                                    <Field label="Premium group" labelClassName="block text-xs font-medium text-muted mb-1">
                                        <select
                                            className={filterClass}
                                            value={expiringGroupId}
                                            onChange={(e) => setExpiringGroupId(e.target.value)}
                                            disabled={groupsLoading}
                                        >
                                            <option value="">Select a premium group&hellip;</option>
                                            {premiumGroups.map((g) => (
                                                <option key={g.id} value={g.id ?? ''}>{g.name}</option>
                                            ))}
                                        </select>
                                    </Field>
                                    <Field label="Within (days)" labelClassName="block text-xs font-medium text-muted mb-1">
                                        <input
                                            type="number"
                                            min={1}
                                            className="input px-3 py-2 w-24"
                                            value={withinDays}
                                            onChange={(e) => setWithinDays(Number(e.target.value))}
                                        />
                                    </Field>
                                    <button
                                        className="btn-primary text-sm inline-flex items-center"
                                        disabled={!expiringGroupId || withinDays <= 0 || expiringLoading}
                                        onClick={() => void runExpiringSearch()}
                                    >
                                        {expiringLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                                        Search
                                    </button>
                                </div>
                                {premiumGroups.length === 0 && !groupsLoading && (
                                    <p className="text-sm text-muted">No premium-tier groups are configured.</p>
                                )}
                                {expiringError && <p className="text-sm field-error" role="alert">{expiringError}</p>}
                                {expiringResults && (
                                    <DataTable
                                        {...tableProps}
                                        caption="Memberships expiring soon"
                                        columns={expiringColumns}
                                        rows={expiringResults}
                                        rowKey={m => String(m.userId)}
                                        rowHref={m => profilePath(m.userId)}
                                        onRowClick={m => openProfile(m.userId)}
                                        empty="No memberships expiring in this window."
                                    />
                                )}
                            </div>
                        )}

                        {tab === 'demoted' && (
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <button
                                        className="btn-secondary text-sm inline-flex items-center"
                                        disabled={demotedLoading}
                                        onClick={() => void runDemotedSearch()}
                                    >
                                        {demotedLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                                        Refresh
                                    </button>
                                </div>
                                {demotedError && <p className="text-sm field-error" role="alert">{demotedError}</p>}
                                {demotedResults && (
                                    <DataTable
                                        {...tableProps}
                                        caption="Recently demoted players"
                                        columns={demotedColumns}
                                        rows={demotedResults}
                                        rowKey={e => String(e.id)}
                                        rowHref={e => profilePath(e.targetUserId)}
                                        onRowClick={e => openProfile(e.targetUserId)}
                                        empty="No recent demotions."
                                    />
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
