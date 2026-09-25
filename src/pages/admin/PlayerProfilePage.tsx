import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, RefreshCcw, ArrowLeft, ShieldCheck, Users, Award, Coins, EyeOff, X, Plus, History, Gift } from 'lucide-react';
import { logging } from '../../utils';
import { userManagementClient } from '../../apiClients/userManagementClient';
import { permissionGroupClient } from '../../apiClients/permissionGroupClient';
import { KitClient } from '../../apiClients/kitClient';
import {
    ActiveMode,
    AuditLogEntryDto,
    TitleChangeResultDto,
    UserProfileSummaryDto,
} from '../../types/dtos/userManagement/UserProfileSummaryDtos';
import { PermissionGroupDto } from '../../types/dtos/userManagement/PermissionGroupDto';
import { KitAvailabilityDto } from '../../types/dtos/kit/KitDtos';

// docs/specs/user-management/DESIGN.md §2 - a read-first composite dashboard for one player,
// distinct from the generic /forms/user edit screen. Phase 2 (docs/specs/user-management/
// IMPLEMENTATION_PLAN.md) adds quick actions (assign/revoke group, grant/deny a node, toggle
// vanish) directly on this page, plus a Recent activity feed off the new audit log.
// docs/specs/kits/IMPLEMENTATION_PLAN.md §6 adds the "Kits" section/Grant action below, the
// web-app's first-class counterpart to the in-game /kit give (DESIGN.md §4.0/§4.6).

const ACTIVE_MODES: ActiveMode[] = ['None', 'Staff', 'Owner'];

const auditActionLabel = (entry: AuditLogEntryDto): string => {
    switch (entry.action) {
        case 'GroupAssigned': return 'Group assigned';
        case 'GroupRemoved': return 'Group removed';
        case 'GrantAdded': return 'Permission granted';
        case 'GrantUpdated': return 'Permission updated';
        case 'GrantRemoved': return 'Permission removed';
        case 'TitleChanged': return 'Title changed';
        case 'VanishToggled': return 'Mode changed';
        case 'SalaryPayout': return 'Salary paid out';
        case 'BalanceAdjusted': return 'Balances adjusted';
        // KitGranted is DESIGN.md §4.1's proposed AuditLogService action for GiveKitAsync - not
        // yet written server-side (kits/IMPLEMENTATION_PLAN.md §2 status: still a
        // TODO(kits-phase2) in GiveKitAsync), but the label is here so this feed renders it
        // correctly the moment that call is wired in, with no further web-app change needed.
        case 'KitGranted': return 'Kit granted';
        default: return entry.action;
    }
};

const activeModeLabel = (mode: ActiveMode): string => {
    switch (mode) {
        case 'Owner': return 'Owner mode';
        case 'Staff': return 'Staff mode';
        default: return 'Visible (no mode)';
    }
};

const formatDate = (iso?: string | null): string => {
    if (!iso) return '-';
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString();
};

export const PlayerProfilePage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const userId = Number(id);

    const [summary, setSummary] = React.useState<UserProfileSummaryDto | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    // Quick actions (Phase 2) — each re-fetches the profile summary and activity feed after a
    // successful write so the admin sees the resolved effect immediately (DESIGN.md §3).
    const [allGroups, setAllGroups] = React.useState<PermissionGroupDto[]>([]);
    const [selectedGroupId, setSelectedGroupId] = React.useState<string>('');
    const [groupExpiresAt, setGroupExpiresAt] = React.useState<string>('');
    const [assigningGroup, setAssigningGroup] = React.useState(false);
    const [removingGroupId, setRemovingGroupId] = React.useState<number | null>(null);
    const [groupActionError, setGroupActionError] = React.useState<string | null>(null);

    const [grantNode, setGrantNode] = React.useState('');
    const [grantValue, setGrantValue] = React.useState<'true' | 'false'>('true');
    const [grantExpiresAt, setGrantExpiresAt] = React.useState('');
    const [grantingNode, setGrantingNode] = React.useState(false);
    const [grantActionError, setGrantActionError] = React.useState<string | null>(null);

    // Balance/XP quick action (developer request 2026-09-25) — the web counterpart to the new
    // /knk user in-game command; both call the same PUT /api/users/{id}/balances.
    const [balanceProperty, setBalanceProperty] = React.useState<'coins' | 'gems' | 'experiencePoints'>('coins');
    const [balanceAction, setBalanceAction] = React.useState<'set' | 'add' | 'remove'>('add');
    const [balanceAmount, setBalanceAmount] = React.useState('');
    const [balanceReason, setBalanceReason] = React.useState('');
    const [adjustingBalance, setAdjustingBalance] = React.useState(false);
    const [balanceActionError, setBalanceActionError] = React.useState<string | null>(null);
    const [titleChangeNotice, setTitleChangeNotice] = React.useState<TitleChangeResultDto | null>(null);

    const [togglingMode, setTogglingMode] = React.useState(false);
    const [modeActionError, setModeActionError] = React.useState<string | null>(null);

    const [activity, setActivity] = React.useState<AuditLogEntryDto[]>([]);
    const [activityLoading, setActivityLoading] = React.useState(true);
    const [activityError, setActivityError] = React.useState<string | null>(null);

    // Kits (docs/specs/kits/IMPLEMENTATION_PLAN.md §6) — lists this player's per-kit
    // gating/cooldown/cost/purchase state exactly as the in-game /kit list does, with a Grant
    // button per row that bypasses that state via the same staff-override GiveKitAsync path
    // /kit give uses (DESIGN.md §4.0/§4.1/§4.6).
    const [kits, setKits] = React.useState<KitAvailabilityDto[]>([]);
    const [kitsLoading, setKitsLoading] = React.useState(true);
    const [kitsError, setKitsError] = React.useState<string | null>(null);
    const [grantingKitId, setGrantingKitId] = React.useState<number | null>(null);
    const [grantKitError, setGrantKitError] = React.useState<string | null>(null);

    const load = React.useCallback(async () => {
        if (!Number.isFinite(userId) || userId <= 0) {
            setError('Invalid user id.');
            setLoading(false);
            return;
        }
        try {
            setLoading(true);
            setError(null);
            const result = await userManagementClient.getProfileSummary(userId);
            setSummary(result);
        } catch (err) {
            console.error('Failed to load player profile:', err);
            logging.errorHandler.next('ErrorMessage.PlayerProfile.LoadFailed');
            setError('Could not load this player’s profile. They may not exist, or the request failed.');
        } finally {
            setLoading(false);
        }
    }, [userId]);

    const loadActivity = React.useCallback(async () => {
        if (!Number.isFinite(userId) || userId <= 0) return;
        try {
            setActivityLoading(true);
            setActivityError(null);
            const result = await userManagementClient.getAuditLog({ targetUserId: userId, pageSize: 20 });
            setActivity(result.items);
        } catch (err) {
            console.error('Failed to load audit log:', err);
            setActivityError('Could not load recent activity.');
        } finally {
            setActivityLoading(false);
        }
    }, [userId]);

    const loadKits = React.useCallback(async () => {
        if (!Number.isFinite(userId) || userId <= 0) return;
        try {
            setKitsLoading(true);
            setKitsError(null);
            const result = await KitClient.getInstance().getAvailableForUser(userId);
            setKits(result);
        } catch (err) {
            console.error('Failed to load available kits:', err);
            setKitsError('Could not load kits.');
        } finally {
            setKitsLoading(false);
        }
    }, [userId]);

    React.useEffect(() => {
        void load();
        void loadActivity();
        void loadKits();
    }, [load, loadActivity, loadKits]);

    React.useEffect(() => {
        permissionGroupClient.getAll()
            .then(setAllGroups)
            .catch((err) => console.error('Failed to load permission groups:', err));
    }, []);

    const refreshAfterAction = React.useCallback(async () => {
        await Promise.all([load(), loadActivity()]);
    }, [load, loadActivity]);

    const handleAssignGroup = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedGroupId) return;
        setAssigningGroup(true);
        setGroupActionError(null);
        try {
            await userManagementClient.assignGroup(userId, {
                permissionGroupId: Number(selectedGroupId),
                expiresAt: groupExpiresAt ? new Date(groupExpiresAt).toISOString() : null,
            });
            setSelectedGroupId('');
            setGroupExpiresAt('');
            await refreshAfterAction();
        } catch (err) {
            console.error('Failed to assign group:', err);
            setGroupActionError('Could not assign this group.');
        } finally {
            setAssigningGroup(false);
        }
    };

    const handleRemoveGroup = async (permissionGroupId: number) => {
        setRemovingGroupId(permissionGroupId);
        setGroupActionError(null);
        try {
            await userManagementClient.removeGroup(userId, permissionGroupId);
            await refreshAfterAction();
        } catch (err) {
            console.error('Failed to remove group:', err);
            setGroupActionError('Could not remove this group.');
        } finally {
            setRemovingGroupId(null);
        }
    };

    const handleGrantNode = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!grantNode.trim()) return;
        setGrantingNode(true);
        setGrantActionError(null);
        try {
            await userManagementClient.grantNode(userId, {
                node: grantNode.trim(),
                value: grantValue === 'true',
                expiresAt: grantExpiresAt ? new Date(grantExpiresAt).toISOString() : null,
            });
            setGrantNode('');
            setGrantExpiresAt('');
            await refreshAfterAction();
        } catch (err) {
            console.error('Failed to grant node:', err);
            setGrantActionError('Could not save this permission node.');
        } finally {
            setGrantingNode(false);
        }
    };

    const handleAdjustBalance = async (e: React.FormEvent) => {
        e.preventDefault();
        const amount = Number(balanceAmount);
        if (!balanceAmount.trim() || Number.isNaN(amount) || amount < 0) return;
        if (!balanceReason.trim()) {
            setBalanceActionError('A reason is required.');
            return;
        }
        setAdjustingBalance(true);
        setBalanceActionError(null);
        setTitleChangeNotice(null);
        try {
            const current = account[balanceProperty];
            const delta = balanceAction === 'set' ? amount - current : balanceAction === 'remove' ? -amount : amount;
            if (delta !== 0) {
                const result = await userManagementClient.adjustBalances(userId, {
                    coinsDelta: balanceProperty === 'coins' ? delta : 0,
                    gemsDelta: balanceProperty === 'gems' ? delta : 0,
                    experienceDelta: balanceProperty === 'experiencePoints' ? delta : 0,
                    reason: balanceReason.trim(),
                });
                if (result.titleChange) {
                    setTitleChangeNotice(result.titleChange);
                }
            }
            setBalanceAmount('');
            setBalanceReason('');
            await refreshAfterAction();
        } catch (err) {
            console.error('Failed to adjust balance:', err);
            setBalanceActionError('Could not adjust this balance — check the amount doesn\'t go below zero.');
        } finally {
            setAdjustingBalance(false);
        }
    };

    // Grant Kit (docs/specs/kits/IMPLEMENTATION_PLAN.md §6) — after a successful grant, re-fetch
    // the kit list (so its resolved cooldown/purchase state reflects the grant immediately) and
    // Recent activity (surfaces the KitGranted entry for free once GiveKitAsync's own
    // TODO(kits-phase2) AuditLogService.Record call is wired in server-side - see this session's
    // §6 status note for the current state of that gap).
    const handleGrantKit = async (kitId: number) => {
        setGrantingKitId(kitId);
        setGrantKitError(null);
        try {
            await KitClient.getInstance().give(kitId, userId);
            await Promise.all([loadKits(), loadActivity()]);
        } catch (err) {
            console.error('Failed to grant kit:', err);
            setGrantKitError('Could not grant this kit.');
        } finally {
            setGrantingKitId(null);
        }
    };

    const handleToggleMode = async (mode: ActiveMode) => {
        setTogglingMode(true);
        setModeActionError(null);
        try {
            await userManagementClient.toggleVanishMode(userId, mode);
            await refreshAfterAction();
        } catch (err) {
            console.error('Failed to toggle mode:', err);
            setModeActionError('Could not change this player’s mode.');
        } finally {
            setTogglingMode(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-12 w-12 text-primary animate-spin" />
            </div>
        );
    }

    if (error || !summary) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-4">
                <p className="text-gray-600">{error || 'Player not found.'}</p>
                <button className="btn-secondary text-sm" onClick={() => navigate(-1)}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                </button>
            </div>
        );
    }

    const { account, permissions, groups, title, salary } = summary;
    const activeGroups = groups.filter(g => g.isActive);
    const premiumGroups = groups.filter(g => g.isPremiumTier);
    // Groups the player doesn't already hold an active membership in — re-assigning an active
    // one is still supported server-side (UpsertAsync updates the expiry), but hiding it here
    // keeps the picker focused on the common case.
    const availableGroupsToAssign = allGroups.filter(
        (g) => g.id != null && !activeGroups.some((m) => m.permissionGroupId === g.id)
    );

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
                <div className="bg-white shadow-sm rounded-lg p-6 border border-gray-200">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <button className="text-sm text-gray-500 hover:text-gray-700 mb-2 inline-flex items-center" onClick={() => navigate(-1)}>
                                <ArrowLeft className="h-4 w-4 mr-1" />
                                Back
                            </button>
                            <h1 className="text-2xl font-bold text-gray-900">{account.username}</h1>
                            <p className="mt-1 text-sm text-gray-500">
                                User #{account.id}
                                {account.uuid && <span className="font-mono"> &middot; {account.uuid}</span>}
                                {account.email && <span> &middot; {account.email}</span>}
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            {account.activeMode !== 'None' && (
                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                                    <EyeOff className="h-3.5 w-3.5 mr-1" />
                                    {activeModeLabel(account.activeMode)}
                                </span>
                            )}
                            <button className="btn-secondary text-sm" onClick={() => void refreshAfterAction()}>
                                <RefreshCcw className="h-4 w-4 mr-2" />
                                Reload
                            </button>
                        </div>
                    </div>

                    {/* Quick action: vanish/owner-staff mode toggle (DESIGN.md §3) */}
                    <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-2 flex-wrap">
                        <span className="text-sm text-gray-500 mr-1">Mode:</span>
                        {ACTIVE_MODES.map((mode) => (
                            <button
                                key={mode}
                                disabled={togglingMode || account.activeMode === mode}
                                className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-colors disabled:cursor-default ${
                                    account.activeMode === mode
                                        ? 'bg-amber-100 text-amber-800 border-amber-200'
                                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                                }`}
                                onClick={() => void handleToggleMode(mode)}
                            >
                                {activeModeLabel(mode)}
                            </button>
                        ))}
                        {togglingMode && <Loader2 className="h-4 w-4 text-gray-400 animate-spin" />}
                        {modeActionError && <span className="text-xs text-red-600">{modeActionError}</span>}
                    </div>
                </div>

                {/* Account */}
                <div className="bg-white shadow-sm rounded-lg p-6 border border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Account</h2>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                        <div>
                            <p className="text-gray-500">Coins</p>
                            <p className="font-semibold text-gray-900">{account.coins}</p>
                        </div>
                        <div>
                            <p className="text-gray-500">Gems</p>
                            <p className="font-semibold text-gray-900">{account.gems}</p>
                        </div>
                        <div>
                            <p className="text-gray-500">Experience</p>
                            <p className="font-semibold text-gray-900">{account.experiencePoints}</p>
                        </div>
                        <div>
                            <p className="text-gray-500">Account type</p>
                            <p className="font-semibold text-gray-900">{account.isFullAccount ? 'Full account' : 'Minecraft-only'}</p>
                        </div>
                        <div>
                            <p className="text-gray-500">Created</p>
                            <p className="font-semibold text-gray-900">{formatDate(account.createdAt)}</p>
                        </div>
                        <div>
                            <p className="text-gray-500">Status</p>
                            <p className="font-semibold text-gray-900">{account.isActive ? 'Active' : 'Deactivated'}</p>
                        </div>
                    </div>

                    {/* Quick action: adjust coins/gems/XP (developer request 2026-09-25) - the
                        same PUT /api/users/{id}/balances the new /knk user in-game command uses,
                        so a non-zero XP delta resolves/audit-logs a title change here too. */}
                    <form className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap items-end gap-3" onSubmit={(e) => void handleAdjustBalance(e)}>
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Property</label>
                            <select
                                className="border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                                value={balanceProperty}
                                onChange={(e) => setBalanceProperty(e.target.value as typeof balanceProperty)}
                            >
                                <option value="coins">Coins</option>
                                <option value="gems">Gems</option>
                                <option value="experiencePoints">XP</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Action</label>
                            <select
                                className="border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                                value={balanceAction}
                                onChange={(e) => setBalanceAction(e.target.value as typeof balanceAction)}
                            >
                                <option value="add">Add</option>
                                <option value="remove">Remove</option>
                                <option value="set">Set to</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Amount</label>
                            <input
                                type="number"
                                min={0}
                                className="border border-gray-300 rounded-md px-2 py-1.5 text-sm w-28"
                                value={balanceAmount}
                                onChange={(e) => setBalanceAmount(e.target.value)}
                                placeholder="0"
                            />
                        </div>
                        <div className="flex-1 min-w-[160px]">
                            <label className="block text-xs text-gray-500 mb-1">Reason</label>
                            <input
                                type="text"
                                className="border border-gray-300 rounded-md px-2 py-1.5 text-sm w-full"
                                value={balanceReason}
                                onChange={(e) => setBalanceReason(e.target.value)}
                                placeholder="Required"
                            />
                        </div>
                        <button type="submit" className="btn-primary text-sm" disabled={!balanceAmount.trim() || !balanceReason.trim() || adjustingBalance}>
                            {adjustingBalance ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Apply'}
                        </button>
                        {balanceActionError && <span className="text-xs text-red-600 w-full">{balanceActionError}</span>}
                    </form>
                    {titleChangeNotice && (
                        <div className={`mt-3 rounded-md p-3 text-sm ${titleChangeNotice.direction === 'promotion' ? 'bg-amber-50 border border-amber-200 text-amber-900' : 'bg-red-50 border border-red-200 text-red-900'}`}>
                            <p className="font-semibold">
                                {titleChangeNotice.direction === 'promotion' ? '✦ Promoted!' : 'Demoted'}
                                {titleChangeNotice.crossedTitles.length > 1
                                    ? ` — ${titleChangeNotice.crossedTitles.map((t) => t.titleName).join(' → ')} (${titleChangeNotice.crossedTitles.length} tiers at once)`
                                    : ` — ${titleChangeNotice.fromTitleName} → ${titleChangeNotice.toTitleName}`}
                            </p>
                            {(titleChangeNotice.coinBonusGranted > 0 || titleChangeNotice.gemBonusGranted > 0 || titleChangeNotice.expBonusGranted > 0) && (
                                <p className="mt-1">
                                    {titleChangeNotice.coinBonusGranted > 0 && <>+{titleChangeNotice.coinBonusGranted} coins  </>}
                                    {titleChangeNotice.gemBonusGranted > 0 && <>+{titleChangeNotice.gemBonusGranted} gems  </>}
                                    {titleChangeNotice.expBonusGranted > 0 && <>+{titleChangeNotice.expBonusGranted} bonus XP</>}
                                </p>
                            )}
                        </div>
                    )}
                </div>

                {/* Title / XP */}
                <div className="bg-white shadow-sm rounded-lg p-6 border border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                        <Award className="h-5 w-5 mr-2" />
                        Title &amp; Experience
                    </h2>
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div>
                            <p className="text-xl font-semibold text-gray-900">{title.titleName || 'No title'}</p>
                            <p className="text-sm text-gray-500">{account.experiencePoints} XP total</p>
                        </div>
                        {title.nextTitleName ? (
                            <div className="text-sm text-gray-600 text-right">
                                <p>Next: <span className="font-medium text-gray-900">{title.nextTitleName}</span></p>
                                <p>{Math.max(0, (title.nextTitleMinExperience ?? 0) - account.experiencePoints)} XP to go</p>
                            </div>
                        ) : (
                            <div className="text-sm text-gray-600 text-right">
                                <p>Highest title reached</p>
                                <p>{title.prestigeExperience} prestige XP</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Premium tier */}
                {premiumGroups.length > 0 && (
                    <div className="bg-white shadow-sm rounded-lg p-6 border border-gray-200">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Premium Tier</h2>
                        <div className="flex flex-wrap gap-3">
                            {premiumGroups.map(g => (
                                <span
                                    key={g.permissionGroupId}
                                    className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium ${
                                        g.isActive ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-500 line-through'
                                    }`}
                                >
                                    {g.permissionGroupName}
                                    {g.expiresAt && <span className="ml-2 text-xs font-normal">until {formatDate(g.expiresAt)}</span>}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Groups */}
                <div className="bg-white shadow-sm rounded-lg p-6 border border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                        <Users className="h-5 w-5 mr-2" />
                        Groups ({activeGroups.length} active)
                    </h2>
                    {groups.length === 0 ? (
                        <p className="text-sm text-gray-500 mb-4">No group memberships.</p>
                    ) : (
                        <div className="overflow-x-auto mb-4">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left border-b border-gray-200">
                                        <th className="py-2 pr-4">Group</th>
                                        <th className="py-2 pr-4">Weight</th>
                                        <th className="py-2 pr-4">Premium</th>
                                        <th className="py-2 pr-4">Expires</th>
                                        <th className="py-2 pr-4">Status</th>
                                        <th className="py-2 pr-4" />
                                    </tr>
                                </thead>
                                <tbody>
                                    {groups.map(g => (
                                        <tr key={g.permissionGroupId} className="border-b border-gray-100">
                                            <td className="py-2 pr-4 font-medium text-gray-900">{g.permissionGroupName || `#${g.permissionGroupId}`}</td>
                                            <td className="py-2 pr-4 text-gray-700">{g.weight}</td>
                                            <td className="py-2 pr-4 text-gray-700">{g.isPremiumTier ? 'Yes' : '-'}</td>
                                            <td className="py-2 pr-4 text-gray-700">{g.expiresAt ? formatDate(g.expiresAt) : 'Never'}</td>
                                            <td className="py-2 pr-4">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                                    g.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
                                                }`}>
                                                    {g.isActive ? 'Active' : 'Expired'}
                                                </span>
                                            </td>
                                            <td className="py-2 pr-4 text-right">
                                                <button
                                                    className="text-gray-400 hover:text-red-600 disabled:opacity-50"
                                                    disabled={removingGroupId === g.permissionGroupId}
                                                    onClick={() => void handleRemoveGroup(g.permissionGroupId)}
                                                    title="Remove group"
                                                >
                                                    {removingGroupId === g.permissionGroupId
                                                        ? <Loader2 className="h-4 w-4 animate-spin" />
                                                        : <X className="h-4 w-4" />}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Quick action: assign group (DESIGN.md §3) */}
                    <form className="flex flex-wrap items-end gap-3 pt-4 border-t border-gray-100" onSubmit={(e) => void handleAssignGroup(e)}>
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Assign group</label>
                            <select
                                className="text-sm border border-gray-300 rounded-md px-2 py-1.5 min-w-[10rem]"
                                value={selectedGroupId}
                                onChange={(e) => setSelectedGroupId(e.target.value)}
                            >
                                <option value="">Select a group…</option>
                                {availableGroupsToAssign.map((g) => (
                                    <option key={g.id} value={g.id!}>{g.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Expires (optional)</label>
                            <input
                                type="datetime-local"
                                className="text-sm border border-gray-300 rounded-md px-2 py-1.5"
                                value={groupExpiresAt}
                                onChange={(e) => setGroupExpiresAt(e.target.value)}
                            />
                        </div>
                        <button type="submit" className="btn-primary text-sm" disabled={!selectedGroupId || assigningGroup}>
                            {assigningGroup ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                            Assign
                        </button>
                        {groupActionError && <span className="text-xs text-red-600">{groupActionError}</span>}
                    </form>
                </div>

                {/* Salary */}
                <div className="bg-white shadow-sm rounded-lg p-6 border border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                        <Coins className="h-5 w-5 mr-2" />
                        Salary
                    </h2>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm mb-4">
                        <div>
                            <p className="text-gray-500">Global x Personal x Rank</p>
                            <p className="font-semibold text-gray-900">
                                {salary.globalMultiplier} &times; {salary.personalMultiplier} &times; {salary.rankMultiplier}
                            </p>
                        </div>
                        <div>
                            <p className="text-gray-500">Effective rate</p>
                            <p className="font-semibold text-gray-900">{salary.effectiveHourlyRate.toFixed(2)} coins/hr</p>
                        </div>
                        <div>
                            <p className="text-gray-500">Last payout</p>
                            <p className="font-semibold text-gray-900">{formatDate(salary.lastSalaryPayoutAt)}</p>
                        </div>
                        <div>
                            <p className="text-gray-500">Next eligible</p>
                            <p className="font-semibold text-gray-900">{formatDate(salary.nextEligibleAt)}</p>
                        </div>
                    </div>
                </div>

                {/* Permissions */}
                <div className="bg-white shadow-sm rounded-lg p-6 border border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                        <ShieldCheck className="h-5 w-5 mr-2" />
                        Effective Permissions ({permissions.permissions.length})
                    </h2>
                    {permissions.permissions.length === 0 ? (
                        <p className="text-sm text-gray-500 mb-4">No declared permission nodes for this player.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left border-b border-gray-200">
                                        <th className="py-2 pr-4">Node</th>
                                        <th className="py-2 pr-4">Value</th>
                                        <th className="py-2 pr-4">Source</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {permissions.permissions.map(p => (
                                        <tr key={p.node} className="border-b border-gray-100">
                                            <td className="py-2 pr-4 font-mono text-xs text-gray-900">{p.node}</td>
                                            <td className="py-2 pr-4">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                                    p.value ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                                }`}>
                                                    {p.value ? 'Granted' : 'Denied'}
                                                </span>
                                            </td>
                                            <td className="py-2 pr-4 text-gray-700">
                                                {p.sourceHolderType === 'User'
                                                    ? 'Direct grant'
                                                    : (p.sourceHolderName || `Group #${p.sourceHolderId}`)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Quick action: grant/deny a node directly on the player (DESIGN.md §3) */}
                    <form className="flex flex-wrap items-end gap-3 pt-4 border-t border-gray-100" onSubmit={(e) => void handleGrantNode(e)}>
                        <div className="flex-1 min-w-[12rem]">
                            <label className="block text-xs text-gray-500 mb-1">Grant/deny node</label>
                            <input
                                type="text"
                                placeholder="e.g. knk.gate.open"
                                className="w-full text-sm border border-gray-300 rounded-md px-2 py-1.5 font-mono"
                                value={grantNode}
                                onChange={(e) => setGrantNode(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Value</label>
                            <select
                                className="text-sm border border-gray-300 rounded-md px-2 py-1.5"
                                value={grantValue}
                                onChange={(e) => setGrantValue(e.target.value as 'true' | 'false')}
                            >
                                <option value="true">Grant</option>
                                <option value="false">Deny</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Expires (optional)</label>
                            <input
                                type="datetime-local"
                                className="text-sm border border-gray-300 rounded-md px-2 py-1.5"
                                value={grantExpiresAt}
                                onChange={(e) => setGrantExpiresAt(e.target.value)}
                            />
                        </div>
                        <button type="submit" className="btn-primary text-sm" disabled={!grantNode.trim() || grantingNode}>
                            {grantingNode ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                            Save
                        </button>
                        {grantActionError && <span className="text-xs text-red-600">{grantActionError}</span>}
                    </form>
                </div>

                {/* Kits (docs/specs/kits/IMPLEMENTATION_PLAN.md §6, DESIGN.md §4.6) */}
                <div className="bg-white shadow-sm rounded-lg p-6 border border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                        <Gift className="h-5 w-5 mr-2" />
                        Kits
                    </h2>
                    {kitsLoading ? (
                        <div className="flex items-center text-sm text-gray-500">
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Loading…
                        </div>
                    ) : kitsError ? (
                        <p className="text-sm text-red-600">{kitsError}</p>
                    ) : kits.length === 0 ? (
                        <p className="text-sm text-gray-500">No kits are configured yet.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left border-b border-gray-200">
                                        <th className="py-2 pr-4">Kit</th>
                                        <th className="py-2 pr-4">Status</th>
                                        <th className="py-2 pr-4">Cooldown</th>
                                        <th className="py-2 pr-4">Cost</th>
                                        <th className="py-2 pr-4" />
                                    </tr>
                                </thead>
                                <tbody>
                                    {kits.map((kit) => {
                                        const cooldownActive = !!kit.cooldownExpiresAt && new Date(kit.cooldownExpiresAt).getTime() > Date.now();
                                        return (
                                            <tr key={kit.kitId} className="border-b border-gray-100">
                                                <td className="py-2 pr-4">
                                                    <p className="font-medium text-gray-900">{kit.name}</p>
                                                    {kit.description && <p className="text-xs text-gray-500">{kit.description}</p>}
                                                </td>
                                                <td className="py-2 pr-4">
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                                        kit.canClaim ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                                                    }`}>
                                                        {kit.canClaim ? 'Available' : (kit.denialReason || 'Not available')}
                                                    </span>
                                                </td>
                                                <td className="py-2 pr-4 text-gray-700">
                                                    {cooldownActive ? `Until ${formatDate(kit.cooldownExpiresAt)}` : '-'}
                                                </td>
                                                <td className="py-2 pr-4 text-gray-700">
                                                    {kit.isSinglePurchasePremium
                                                        ? (kit.isPurchased ? 'Purchased' : `${kit.premiumPriceGems ?? 0} gems (not purchased)`)
                                                        : (kit.costAmount ? `${kit.costAmount} ${kit.costCurrency ?? ''}`.trim() : 'Free')}
                                                </td>
                                                <td className="py-2 pr-4 text-right">
                                                    <button
                                                        className="btn-primary text-xs px-3 py-1.5 inline-flex items-center disabled:opacity-50"
                                                        disabled={grantingKitId === kit.kitId}
                                                        onClick={() => void handleGrantKit(kit.kitId)}
                                                        title="Grant this kit regardless of gating/cooldown/cost (same as /kit give)"
                                                    >
                                                        {grantingKitId === kit.kitId
                                                            ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                                                            : <Gift className="h-4 w-4 mr-1.5" />}
                                                        Grant
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                    {grantKitError && <p className="mt-3 text-xs text-red-600">{grantKitError}</p>}
                </div>

                {/* Recent activity (docs/specs/user-management/IMPLEMENTATION_PLAN.md Phase 2) */}
                <div className="bg-white shadow-sm rounded-lg p-6 border border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                        <History className="h-5 w-5 mr-2" />
                        Recent Activity
                    </h2>
                    {activityLoading ? (
                        <div className="flex items-center text-sm text-gray-500">
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Loading…
                        </div>
                    ) : activityError ? (
                        <p className="text-sm text-red-600">{activityError}</p>
                    ) : activity.length === 0 ? (
                        <p className="text-sm text-gray-500">No recorded activity for this player yet.</p>
                    ) : (
                        <ul className="divide-y divide-gray-100">
                            {activity.map((entry) => (
                                <li key={entry.id} className="py-3 flex items-start justify-between gap-4">
                                    <div>
                                        <p className="text-sm font-medium text-gray-900">{auditActionLabel(entry)}</p>
                                        <p className="text-xs text-gray-500 mt-0.5">
                                            {entry.actorUsername
                                                ? <>by <span className="font-medium">{entry.actorUsername}</span></>
                                                : <span className="italic">system</span>}
                                        </p>
                                    </div>
                                    <span className="text-xs text-gray-400 whitespace-nowrap">{formatDate(entry.timestamp)}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
};
