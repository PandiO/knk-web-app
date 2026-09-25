import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Search, Users, Clock, TrendingDown, List, ChevronLeft, ChevronRight } from 'lucide-react';
import { userManagementClient } from '../../apiClients/userManagementClient';
import { permissionGroupClient } from '../../apiClients/permissionGroupClient';
import { userClient } from '../../apiClients/userClient';
import { PermissionGroupDto, ExpiringMembershipDto } from '../../types/dtos/userManagement/PermissionGroupDto';
import { AuditLogEntryDto } from '../../types/dtos/userManagement/UserProfileSummaryDtos';
import { UserListDto } from '../../types/dtos/auth/UserDtos';
import { toApiPagedQuery } from '../../utils/entityApiMapping';

// docs/specs/user-management/DESIGN.md §5, IMPLEMENTATION_PLAN.md Phase 3 - a moderation-oriented
// list separate from the generic ObjectDashboard/PagedEntityTable system, since "users in group
// X", "premium expiring soon", and "recently demoted" are cross-entity queries the generic
// column-filter system can't express (DESIGN.md §5's own reasoning, not re-litigated here). Also
// closes Phase 1/2's carried-forward "no generic-dashboard entry point into PlayerProfilePage"
// item: every row here links to /admin/users/:id.

type Tab = 'all' | 'group' | 'expiring' | 'demoted';

const formatDate = (iso?: string | null): string => {
    if (!iso) return '-';
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString();
};

export const UserModerationPage: React.FC = () => {
    const navigate = useNavigate();
    const [tab, setTab] = React.useState<Tab>('all');

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

    const runAllSearch = React.useCallback(async (page: number, searchTerm: string) => {
        setAllLoading(true);
        setAllError(null);
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
            setAllError('Could not load players.');
        } finally {
            setAllLoading(false);
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

    const allTotalPages = Math.max(1, Math.ceil(allTotalCount / ALL_PAGE_SIZE));

    // ----- "By group" tab (also covers "currently online", combined with a group filter -
    // there is no server-wide online list, only GET /api/Users/search?groupId=&onlineOnly=) -----
    const [selectedGroupId, setSelectedGroupId] = React.useState<string>('');
    const [onlineOnly, setOnlineOnly] = React.useState(false);
    const [groupResults, setGroupResults] = React.useState<UserListDto[] | null>(null);
    const [groupLoading, setGroupLoading] = React.useState(false);
    const [groupError, setGroupError] = React.useState<string | null>(null);

    const runGroupSearch = React.useCallback(async () => {
        if (!selectedGroupId) return;
        setGroupLoading(true);
        setGroupError(null);
        try {
            const result = await userManagementClient.searchByGroup(Number(selectedGroupId), onlineOnly || undefined);
            setGroupResults(result);
        } catch (err) {
            console.error('Failed to search users by group:', err);
            setGroupError('Could not load users for this group.');
        } finally {
            setGroupLoading(false);
        }
    }, [selectedGroupId, onlineOnly]);

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
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Player moderation</h1>
                    <p className="mt-1 text-sm text-gray-500">
                        Browse every player, or search for moderation tasks — group membership, expiring
                        premium tiers, and recent title demotions. Click any row to open that player&apos;s profile.
                    </p>
                </div>

                <div className="bg-white shadow-sm rounded-lg border border-gray-200">
                    <div className="border-b border-gray-200 flex flex-wrap">
                        {tabs.map((t) => (
                            <button
                                key={t.key}
                                onClick={() => setTab(t.key)}
                                className={`inline-flex items-center px-4 py-3 text-sm font-medium border-b-2 -mb-px ${
                                    tab === t.key
                                        ? 'border-primary text-gray-900'
                                        : 'border-transparent text-gray-500 hover:text-gray-700'
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
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Search username / email / UUID</label>
                                        <input
                                            type="text"
                                            className="border border-gray-300 rounded-md px-3 py-2 text-sm min-w-[240px]"
                                            value={allSearchTerm}
                                            onChange={(e) => setAllSearchTerm(e.target.value)}
                                            onKeyDown={(e) => { if (e.key === 'Enter') void runAllSearch(1, allSearchTerm); }}
                                            placeholder="Leave blank to list everyone"
                                        />
                                    </div>
                                    <button
                                        className="btn-primary text-sm inline-flex items-center"
                                        disabled={allLoading}
                                        onClick={() => void runAllSearch(1, allSearchTerm)}
                                    >
                                        {allLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                                        Search
                                    </button>
                                </div>
                                {allError && <p className="text-sm text-red-600">{allError}</p>}
                                {allResults && (
                                    allResults.length === 0 ? (
                                        <p className="text-sm text-gray-500">No matching players.</p>
                                    ) : (
                                        <>
                                            <table className="min-w-full text-sm">
                                                <thead>
                                                    <tr className="text-left text-gray-500 border-b border-gray-200">
                                                        <th className="py-2 pr-4">Username</th>
                                                        <th className="py-2 pr-4">Email</th>
                                                        <th className="py-2 pr-4">Status</th>
                                                        <th className="py-2 pr-4">Coins</th>
                                                        <th className="py-2 pr-4">XP</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {allResults.map((u) => (
                                                        <tr
                                                            key={u.id}
                                                            className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                                                            onClick={() => u.id != null && navigate(`/admin/users/${u.id}`)}
                                                        >
                                                            <td className="py-2 pr-4 font-medium text-gray-900">{u.username}</td>
                                                            <td className="py-2 pr-4 text-gray-500">{u.email ?? '-'}</td>
                                                            <td className="py-2 pr-4">
                                                                {u.isOnline ? (
                                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Online</span>
                                                                ) : (
                                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">Offline</span>
                                                                )}
                                                            </td>
                                                            <td className="py-2 pr-4 text-gray-500">{u.coins}</td>
                                                            <td className="py-2 pr-4 text-gray-500">{u.experiencePoints}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                            <div className="flex items-center justify-between pt-2">
                                                <p className="text-xs text-gray-500">
                                                    Page {allPage} of {allTotalPages} ({allTotalCount} total)
                                                </p>
                                                <div className="flex gap-2">
                                                    <button
                                                        className="btn-secondary text-xs inline-flex items-center px-2 py-1"
                                                        disabled={allLoading || allPage <= 1}
                                                        onClick={() => void runAllSearch(allPage - 1, allSearchTerm)}
                                                    >
                                                        <ChevronLeft className="h-3.5 w-3.5" />
                                                    </button>
                                                    <button
                                                        className="btn-secondary text-xs inline-flex items-center px-2 py-1"
                                                        disabled={allLoading || allPage >= allTotalPages}
                                                        onClick={() => void runAllSearch(allPage + 1, allSearchTerm)}
                                                    >
                                                        <ChevronRight className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                        </>
                                    )
                                )}
                            </div>
                        )}

                        {tab === 'group' && (
                            <div className="space-y-4">
                                <div className="flex flex-wrap items-end gap-3">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Permission group</label>
                                        <select
                                            className="border border-gray-300 rounded-md px-3 py-2 text-sm min-w-[220px]"
                                            value={selectedGroupId}
                                            onChange={(e) => setSelectedGroupId(e.target.value)}
                                            disabled={groupsLoading}
                                        >
                                            <option value="">Select a group&hellip;</option>
                                            {groups.map((g) => (
                                                <option key={g.id} value={g.id ?? ''}>{g.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <label className="inline-flex items-center gap-2 text-sm text-gray-700 pb-2">
                                        <input
                                            type="checkbox"
                                            checked={onlineOnly}
                                            onChange={(e) => setOnlineOnly(e.target.checked)}
                                        />
                                        Currently online only
                                    </label>
                                    <button
                                        className="btn-primary text-sm inline-flex items-center"
                                        disabled={!selectedGroupId || groupLoading}
                                        onClick={() => void runGroupSearch()}
                                    >
                                        {groupLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                                        Search
                                    </button>
                                </div>
                                {groupError && <p className="text-sm text-red-600">{groupError}</p>}
                                {groupResults && (
                                    groupResults.length === 0 ? (
                                        <p className="text-sm text-gray-500">No matching players.</p>
                                    ) : (
                                        <table className="min-w-full text-sm">
                                            <thead>
                                                <tr className="text-left text-gray-500 border-b border-gray-200">
                                                    <th className="py-2 pr-4">Username</th>
                                                    <th className="py-2 pr-4">Status</th>
                                                    <th className="py-2 pr-4">Last seen</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {groupResults.map((u) => (
                                                    <tr
                                                        key={u.id}
                                                        className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                                                        onClick={() => u.id != null && navigate(`/admin/users/${u.id}`)}
                                                    >
                                                        <td className="py-2 pr-4 font-medium text-gray-900">{u.username}</td>
                                                        <td className="py-2 pr-4">
                                                            {u.isOnline ? (
                                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Online</span>
                                                            ) : (
                                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">Offline</span>
                                                            )}
                                                        </td>
                                                        <td className="py-2 pr-4 text-gray-500">{formatDate(u.lastSeenAt)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )
                                )}
                            </div>
                        )}

                        {tab === 'expiring' && (
                            <div className="space-y-4">
                                <div className="flex flex-wrap items-end gap-3">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Premium group</label>
                                        <select
                                            className="border border-gray-300 rounded-md px-3 py-2 text-sm min-w-[220px]"
                                            value={expiringGroupId}
                                            onChange={(e) => setExpiringGroupId(e.target.value)}
                                            disabled={groupsLoading}
                                        >
                                            <option value="">Select a premium group&hellip;</option>
                                            {premiumGroups.map((g) => (
                                                <option key={g.id} value={g.id ?? ''}>{g.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Within (days)</label>
                                        <input
                                            type="number"
                                            min={1}
                                            className="border border-gray-300 rounded-md px-3 py-2 text-sm w-24"
                                            value={withinDays}
                                            onChange={(e) => setWithinDays(Number(e.target.value))}
                                        />
                                    </div>
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
                                    <p className="text-sm text-gray-500">No premium-tier groups are configured.</p>
                                )}
                                {expiringError && <p className="text-sm text-red-600">{expiringError}</p>}
                                {expiringResults && (
                                    expiringResults.length === 0 ? (
                                        <p className="text-sm text-gray-500">No memberships expiring in this window.</p>
                                    ) : (
                                        <table className="min-w-full text-sm">
                                            <thead>
                                                <tr className="text-left text-gray-500 border-b border-gray-200">
                                                    <th className="py-2 pr-4">Username</th>
                                                    <th className="py-2 pr-4">Expires</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {expiringResults.map((m) => (
                                                    <tr
                                                        key={m.userId}
                                                        className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                                                        onClick={() => navigate(`/admin/users/${m.userId}`)}
                                                    >
                                                        <td className="py-2 pr-4 font-medium text-gray-900">{m.username}</td>
                                                        <td className="py-2 pr-4 text-gray-500">{formatDate(m.expiresAt)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )
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
                                {demotedError && <p className="text-sm text-red-600">{demotedError}</p>}
                                {demotedResults && (
                                    demotedResults.length === 0 ? (
                                        <p className="text-sm text-gray-500">No recent demotions.</p>
                                    ) : (
                                        <table className="min-w-full text-sm">
                                            <thead>
                                                <tr className="text-left text-gray-500 border-b border-gray-200">
                                                    <th className="py-2 pr-4">Player</th>
                                                    <th className="py-2 pr-4">When</th>
                                                    <th className="py-2 pr-4">Details</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {demotedResults.map((entry) => (
                                                    <tr
                                                        key={entry.id}
                                                        className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                                                        onClick={() => navigate(`/admin/users/${entry.targetUserId}`)}
                                                    >
                                                        <td className="py-2 pr-4 font-medium text-gray-900">{entry.targetUsername ?? `#${entry.targetUserId}`}</td>
                                                        <td className="py-2 pr-4 text-gray-500">{formatDate(entry.timestamp)}</td>
                                                        <td className="py-2 pr-4 text-gray-500 font-mono text-xs">{entry.details}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
