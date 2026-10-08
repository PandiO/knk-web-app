import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, RefreshCcw, ArrowLeft, ShieldCheck, Users, Award, Coins, EyeOff, X, Plus, History, Gift, Lock, Unlock } from 'lucide-react';
import { logging } from '../../utils';
import { auditActionLabel, auditTags, describeAuditDetails } from '../../utils/auditDetails';
import { dateTimeLocalDaysFromNow } from '../../utils/dateTimeLocal';
import { userManagementClient } from '../../apiClients/userManagementClient';
import { permissionGroupClient } from '../../apiClients/permissionGroupClient';
import { KitClient } from '../../apiClients/kitClient';
import { PlayerDiscoveriesPanel } from '../../components/admin/PlayerDiscoveriesPanel';
import { currencyClient } from '../../apiClients/currencyClient';
import { usePermission } from '../../hooks/useStaffAccess';
import { BalanceLedgerTable } from '../../components/currency/BalanceLedgerTable';
import { AdjustBalanceCard } from '../../components/currency/AdjustBalanceCard';
import {
    CURRENCY_NODES,
    TransferLockDto,
} from '../../types/dtos/currency/CurrencyDtos';
import { PrivateMessagesPanel } from '../../components/admin/PrivateMessagesPanel';
import {
    ActiveMode,
    AuditLogEntryDto,
    BalanceAdjustmentResultDto,
    TitleChangeResultDto,
    UserProfileSummaryDto,
} from '../../types/dtos/userManagement/UserProfileSummaryDtos';
import { PermissionGroupDto } from '../../types/dtos/userManagement/PermissionGroupDto';
import { KitAvailabilityDto } from '../../types/dtos/kit/KitDtos';
import { usePageTitle } from '../../hooks/usePageTitle';

// docs/specs/user-management/DESIGN.md §2 - a read-first composite dashboard for one player,
// distinct from the generic /forms/user edit screen. Phase 2 (docs/specs/user-management/
// IMPLEMENTATION_PLAN.md) adds quick actions (assign/revoke group, grant/deny a node, toggle
// vanish) directly on this page, plus a Recent activity feed off the new audit log.
// docs/specs/kits/IMPLEMENTATION_PLAN.md §6 adds the "Kits" section/Grant action below, the
// web-app's first-class counterpart to the in-game /kit give (DESIGN.md §4.0/§4.6).
// docs/specs/domain-discovery/DESIGN.md §3.9 adds the "Discoveries" panel (knk.admin.discovery).
// docs/specs/private-messages/IMPLEMENTATION_PLAN.md Phase 4 adds the "Private messages" panel.

const ACTIVE_MODES: ActiveMode[] = ['None', 'Staff', 'Owner'];

const activeModeLabel = (mode: ActiveMode): string => {
    switch (mode) {
        case 'Owner': return 'Owner mode';
        case 'Staff': return 'Staff mode';
        default: return 'Visible (no mode)';
    }
};

// KNG-59 safeguard: a direct grant/deny defaults to expiring a day from now, so a permanent one
// takes an explicit "clear the expiry" from the admin.
const GRANT_DEFAULT_EXPIRY_DAYS = 1;
const defaultGrantExpiry = (): string => dateTimeLocalDaysFromNow(GRANT_DEFAULT_EXPIRY_DAYS);

const formatDate = (iso?: string | null): string => {
    if (!iso) return '-';
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString();
};

// The API's own explanation for a refused request (400/403/409), e.g. "Requires the
// knk.admin.user.coins permission." or a BalanceCapExceeded message since KNG-22.
const clientErrorMessage = (err: unknown): string | null => {
    const status = (err as { status?: number } | null)?.status;
    const message = err instanceof Error ? err.message : null;
    return status !== undefined && status >= 400 && status < 500 && message ? message : null;
};

export const PlayerProfilePage: React.FC = () => {
    usePageTitle('Player profile');
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
    const [grantExpiresAt, setGrantExpiresAt] = React.useState(defaultGrantExpiry);
    const [grantingNode, setGrantingNode] = React.useState(false);
    const [grantActionError, setGrantActionError] = React.useState<string | null>(null);
    const [revokingNode, setRevokingNode] = React.useState<string | null>(null);
    const [revokeNodeError, setRevokeNodeError] = React.useState<string | null>(null);

    // "Adjust balance" card (AdjustBalanceCard): the title change its last adjustment caused.
    const [titleChangeNotice, setTitleChangeNotice] = React.useState<TitleChangeResultDto | null>(null);

    // Currency Phase 4: the balance history (knk.admin.currency.history) and the payment lock
    // (knk.admin.currency.lock). The API enforces both nodes; these only decide what shows.
    const { allowed: canReadLedger } = usePermission(CURRENCY_NODES.history);
    const { allowed: canLockTransfers } = usePermission(CURRENCY_NODES.lock);
    const [ledgerRefresh, setLedgerRefresh] = React.useState(0);
    const [transferLock, setTransferLock] = React.useState<TransferLockDto | null>(null);
    const [lockReason, setLockReason] = React.useState('');
    const [changingLock, setChangingLock] = React.useState(false);
    const [lockError, setLockError] = React.useState<string | null>(null);

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

    const loadTransferLock = React.useCallback(async () => {
        if (!Number.isFinite(userId) || userId <= 0) return;
        try {
            setTransferLock(await currencyClient.getTransferLock(userId));
        } catch (err) {
            console.error('Failed to load the transfer lock:', err);
        }
    }, [userId]);

    React.useEffect(() => {
        void load();
        void loadActivity();
        void loadKits();
        void loadTransferLock();
    }, [load, loadActivity, loadKits, loadTransferLock]);

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
            setGrantExpiresAt(defaultGrantExpiry());
            await refreshAfterAction();
        } catch (err) {
            console.error('Failed to grant node:', err);
            setGrantActionError('Could not save this permission node.');
        } finally {
            setGrantingNode(false);
        }
    };

    // KNG-59: remove a node granted/denied directly on the player (group-inherited rows have no
    // remove button - removing those would change the group for every member).
    const handleRevokeNode = async (node: string) => {
        setRevokingNode(node);
        setRevokeNodeError(null);
        try {
            await userManagementClient.revokeNode(userId, node);
            await refreshAfterAction();
        } catch (err) {
            console.error('Failed to remove node:', err);
            setRevokeNodeError(`Could not remove ${node}.`);
        } finally {
            setRevokingNode(null);
        }
    };

    const handleBalanceAdjusted = async (result: BalanceAdjustmentResultDto) => {
        setTitleChangeNotice(result.titleChange ?? null);
        setLedgerRefresh(n => n + 1);
        await refreshAfterAction();
    };

    // Payment lock (currency Phase 4): a locked player can neither send nor receive /pay.
    const handleToggleTransferLock = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!transferLock) return;
        if (!transferLock.locked && !lockReason.trim()) {
            setLockError('A reason is required.');
            return;
        }
        setChangingLock(true);
        setLockError(null);
        try {
            setTransferLock(transferLock.locked
                ? await currencyClient.unlockTransfers(userId)
                : await currencyClient.lockTransfers(userId, lockReason.trim()));
            setLockReason('');
            await loadActivity();
        } catch (err) {
            console.error('Failed to change the transfer lock:', err);
            setLockError(clientErrorMessage(err) ?? 'Could not change the payment lock.');
        } finally {
            setChangingLock(false);
        }
    };

    // Grant Kit (docs/specs/kits/IMPLEMENTATION_PLAN.md §6) — after a successful grant, re-fetch
    // the kit list (so its resolved cooldown/purchase state reflects the grant immediately) and
    // Recent activity (so the KitGranted audit entry GiveKitAsync records shows up right away).
    const handleGrantKit = async (kitId: number) => {
        setGrantingKitId(kitId);
        setGrantKitError(null);
        try {
            await KitClient.getInstance().give(kitId, userId);
            await Promise.all([loadKits(), loadActivity()]);
        } catch (err) {
            console.error('Failed to grant kit:', err);
            setGrantKitError(clientErrorMessage(err) ?? 'Could not grant this kit.');
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

                    {/* Payment lock (currency Phase 4): shown to staff, changeable with knk.admin.currency.lock. */}
                    {transferLock && (
                        <form className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap items-center gap-3 text-sm" onSubmit={(e) => void handleToggleTransferLock(e)}>
                            <span className={`inline-flex items-center font-medium ${transferLock.locked ? 'text-red-700' : 'text-gray-600'}`}>
                                {transferLock.locked ? <Lock className="h-4 w-4 mr-1" /> : <Unlock className="h-4 w-4 mr-1" />}
                                {transferLock.locked ? `Payments locked: ${transferLock.reason ?? ''}` : 'Payments allowed'}
                            </span>
                            {transferLock.locked && transferLock.lockedAt && (
                                <span className="text-xs text-gray-500">since {formatDate(transferLock.lockedAt)}</span>
                            )}
                            {canLockTransfers && !transferLock.locked && (
                                <input
                                    type="text"
                                    maxLength={200}
                                    aria-label="Lock reason"
                                    className="border border-gray-300 rounded-md px-2 py-1.5 text-sm flex-1 min-w-[160px]"
                                    value={lockReason}
                                    onChange={(e) => setLockReason(e.target.value)}
                                    placeholder="Reason to lock this player's payments"
                                />
                            )}
                            {canLockTransfers && (
                                <button type="submit" className="btn-secondary text-sm" disabled={changingLock || (!transferLock.locked && !lockReason.trim())}>
                                    {changingLock ? <Loader2 className="h-4 w-4 animate-spin" /> : transferLock.locked ? 'Unlock payments' : 'Lock payments'}
                                </button>
                            )}
                            {lockError && <span className="text-xs text-red-600 w-full">{lockError}</span>}
                        </form>
                    )}
                </div>

                {/* Adjust balance (currency Phase 4; its own card since the KNG-21 smoke test) */}
                <AdjustBalanceCard
                    userId={userId}
                    balances={account}
                    onStart={() => setTitleChangeNotice(null)}
                    onAdjusted={handleBalanceAdjusted}
                >
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
                </AdjustBalanceCard>

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
                            <p className="text-gray-500">Title salary x Global x Personal x Rank</p>
                            <p className="font-semibold text-gray-900">
                                {salary.titleSalary} &times; {salary.globalMultiplier} &times; {salary.personalMultiplier} &times; {salary.rankMultiplier}
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
                                        <th className="py-2 pr-4" />
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
                                            <td className="py-2 pr-4 text-right">
                                                {p.sourceHolderType === 'User' ? (
                                                    <button
                                                        className="text-gray-400 hover:text-red-600 disabled:opacity-50"
                                                        disabled={revokingNode !== null}
                                                        onClick={() => void handleRevokeNode(p.node)}
                                                        title={`Remove direct ${p.value ? 'grant' : 'deny'}`}
                                                        aria-label={`Remove direct ${p.value ? 'grant' : 'deny'} of ${p.node}`}
                                                    >
                                                        {revokingNode === p.node
                                                            ? <Loader2 className="h-4 w-4 animate-spin" />
                                                            : <X className="h-4 w-4" />}
                                                    </button>
                                                ) : (
                                                    <span
                                                        className="text-xs text-gray-400"
                                                        title="Inherited from a group: remove the node on the group, or remove the group membership above"
                                                    >
                                                        Inherited
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    {revokeNodeError && <p className="text-xs text-red-600 mt-2">{revokeNodeError}</p>}

                    {/* Quick action: grant/deny a node directly on the player (DESIGN.md §3). Saving a node
                        the player already has directly updates its value and expiry (KNG-59). */}
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
                            <label className="block text-xs text-gray-500 mb-1">
                                Expires {grantExpiresAt ? '(clear for permanent)' : <span className="font-medium text-amber-700">(permanent)</span>}
                            </label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="datetime-local"
                                    className="text-sm border border-gray-300 rounded-md px-2 py-1.5"
                                    value={grantExpiresAt}
                                    onChange={(e) => setGrantExpiresAt(e.target.value)}
                                />
                                {grantExpiresAt ? (
                                    <button type="button" className="text-xs text-gray-500 hover:text-red-600 underline" onClick={() => setGrantExpiresAt('')}>
                                        Clear
                                    </button>
                                ) : (
                                    <button type="button" className="text-xs text-gray-500 hover:text-gray-800 underline" onClick={() => setGrantExpiresAt(defaultGrantExpiry())}>
                                        Reset to 1 day
                                    </button>
                                )}
                            </div>
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

                {/* Discoveries (docs/specs/domain-discovery/DESIGN.md §3.9) - only for holders of
                    knk.admin.discovery; each reset adds a DiscoveryReset entry to Recent activity. */}
                <PlayerDiscoveriesPanel key={userId} userId={userId} onReset={loadActivity} />

                {/* Balance history (KNG-23, currency Phase 4): the balance event log filtered to this player. */}
                {canReadLedger && (
                    <div className="bg-white shadow-sm rounded-lg p-6 border border-gray-200">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                            <Coins className="h-5 w-5 mr-2" />
                            Balance history
                        </h2>
                        <BalanceLedgerTable userId={userId} pageSize={20} refreshToken={ledgerRefresh} />
                    </div>
                )}

                {/* Private messages (docs/specs/private-messages/DESIGN.md §3.4) - only for holders of
                    knk.pmlog.read; each read adds a PrivateMessagesViewed entry to Recent activity. */}
                <PrivateMessagesPanel key={userId} userId={userId} onViewed={loadActivity} />

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
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-gray-900">{auditActionLabel(entry)}</p>
                                        <p className="text-xs text-gray-500 mt-0.5">
                                            {entry.actorUsername
                                                ? <>by <span className="font-medium">{entry.actorUsername}</span></>
                                                : <span className="italic">system</span>}
                                        </p>
                                        {/* What changed: amounts, before/after, reason (utils/auditDetails). */}
                                        {describeAuditDetails(entry).map((line, i) => (
                                            <p key={i} className="text-xs text-gray-700 mt-0.5 break-words">{line}</p>
                                        ))}
                                        {auditTags(entry).length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-1">
                                                {auditTags(entry).map(tag => (
                                                    <span key={tag.label} className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                                        tag.tone === 'red' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
                                                    }`}>
                                                        {tag.label}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
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
