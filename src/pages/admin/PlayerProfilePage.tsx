import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { Loader2, ShieldCheck, Users, Award, Coins, X, Plus, Gift, Lock, Unlock, Snowflake, EyeOff, Gavel } from 'lucide-react';
import { logging } from '../../utils';
import { dateTimeLocalDaysFromNow } from '../../utils/dateTimeLocal';
import { userManagementClient } from '../../apiClients/userManagementClient';
import { permissionGroupClient } from '../../apiClients/permissionGroupClient';
import { KitClient } from '../../apiClients/kitClient';
import { PlayerDiscoveriesPanel } from '../../components/admin/PlayerDiscoveriesPanel';
import { PlayerStatisticsPanel } from '../../components/admin/PlayerStatisticsPanel';
import { currencyClient } from '../../apiClients/currencyClient';
import { usePermission } from '../../hooks/useStaffAccess';
import { useActionGate } from '../../hooks/useActionGate';
import { useConfirm } from '../../hooks/useConfirm';
import { useTabParam } from '../../hooks/useTabParam';
import { usePageTitle } from '../../hooks/usePageTitle';
import { useAuth } from '../../contexts/AuthContext';
import { BalanceLedgerTable } from '../../components/currency/BalanceLedgerTable';
import { AdjustBalanceCard } from '../../components/currency/AdjustBalanceCard';
import { CURRENCY_NODES, TransferLockDto } from '../../types/dtos/currency/CurrencyDtos';
import { PrivateMessagesPanel } from '../../components/admin/PrivateMessagesPanel';
import { StaffDataDeletionCard } from '../../components/admin/StaffDataDeletionCard';
import { PlayerAccessCard } from '../../components/admin/PlayerAccessCard';
import {
    ActiveMode,
    BalanceAdjustmentResultDto,
    TitleChangeResultDto,
    UserProfileSummaryDto,
} from '../../types/dtos/userManagement/UserProfileSummaryDtos';
import { PermissionGroupDto } from '../../types/dtos/userManagement/PermissionGroupDto';
import { KitAvailabilityDto } from '../../types/dtos/kit/KitDtos';
import { apiRefusalReason } from '../../utils/apiRefusalReason';
import { useLiveEntityChanges, usePresenceChanges } from '../../realtime/liveUpdates';
import { formatDateTime, formatNumber } from '../../utils/format';
import { rememberRecentPlayer } from '../../utils/recentPlayers';
import { normalizeProfileSummary } from './playerProfile/normalizeProfile';
import { activeModeLabel, GatedHint, PlayerStatusStrip } from './playerProfile/PlayerStatusStrip';
import { ProfileTab, ProfileTabs, tabId, tabPanelId } from './playerProfile/ProfileTabs';
import { PlayerTimeline } from './playerProfile/PlayerTimeline';
import { PlayerAuditLog } from './playerProfile/PlayerAuditLog';
import { usePlayerFreeze } from './playerProfile/usePlayerFreeze';

// docs/specs/user-management/DESIGN.md §2 - a read-first composite dashboard for one player,
// distinct from the generic /forms/user edit screen. Phase 2 (docs/specs/user-management/
// IMPLEMENTATION_PLAN.md) adds quick actions (assign/revoke group, grant/deny a node, toggle
// vanish) directly on this page. docs/specs/kits/IMPLEMENTATION_PLAN.md §6 adds the Kits card and
// its Grant action, docs/specs/domain-discovery/DESIGN.md §3.9 the Discoveries panel and
// docs/specs/private-messages/IMPLEMENTATION_PLAN.md Phase 4 the Private messages panel.
//
// PandiO/knk-workspace#119 (MOD-3, MOD-4): a status strip in the header (online, mode, frozen, payments
// locked, premium tier, flags) with Freeze / Unfreeze, and the cards on six tabs (the tab is in the URL,
// ?tab=economy) instead of one 7,500 px page. Activity holds the per-player timeline and the paged audit log.
// Actions show disabled with "Requires <node>" without their node (#280's rule for buttons).

type TabKey = 'overview' | 'economy' | 'permissions' | 'moderation' | 'activity' | 'privacy';
const TAB_KEYS: readonly TabKey[] = ['overview', 'economy', 'permissions', 'moderation', 'activity', 'privacy'];
const TABS: ProfileTab<TabKey>[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'economy', label: 'Economy' },
    { key: 'permissions', label: 'Permissions' },
    { key: 'moderation', label: 'Moderation' },
    { key: 'activity', label: 'Activity' },
    { key: 'privacy', label: 'Privacy' },
];
const TAB_ID_PREFIX = 'player-profile';

const ACTIVE_MODES: ActiveMode[] = ['None', 'Staff', 'Owner'];

/** The API's nodes for the profile's actions (StaffPermissions in knk-web-api). */
export const PROFILE_ACTION_NODES = {
    groups: 'knk.admin.user.group',
    grants: 'knk.admin.user.perm',
    kits: 'knk.kit.give',
} as const;

// KNG-59 safeguard: a direct grant/deny defaults to expiring a day from now, so a permanent one
// takes an explicit "clear the expiry" from the admin.
const GRANT_DEFAULT_EXPIRY_DAYS = 1;
const defaultGrantExpiry = (): string => dateTimeLocalDaysFromNow(GRANT_DEFAULT_EXPIRY_DAYS);

const card = 'panel p-4 sm:p-6';
const cardTitle = 'text-lg font-semibold text-fg mb-4 flex items-center';
const th = 'py-2 pr-4 font-medium text-muted';
const fieldInput = 'input text-sm px-2 py-1.5';

export const PlayerProfilePage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const userId = Number(id);
    const { user: viewer } = useAuth();
    const [tab, setTab] = useTabParam(TAB_KEYS, 'overview');
    const [confirm, confirmModal, confirmWithReason] = useConfirm();

    const [summary, setSummary] = React.useState<UserProfileSummaryDto | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    /** Bumped after every change: the timeline and the audit log read again. */
    const [activityToken, setActivityToken] = React.useState(0);
    const bumpActivity = React.useCallback(() => setActivityToken(n => n + 1), []);

    // Quick actions (Phase 2) — each re-fetches the profile summary and activity after a
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
    const lockGate = useActionGate(CURRENCY_NODES.lock);
    const groupGate = useActionGate(PROFILE_ACTION_NODES.groups);
    const grantGate = useActionGate(PROFILE_ACTION_NODES.grants);
    const kitGate = useActionGate(PROFILE_ACTION_NODES.kits);
    const [ledgerRefresh, setLedgerRefresh] = React.useState(0);
    const [transferLock, setTransferLock] = React.useState<TransferLockDto | null>(null);
    const [lockReason, setLockReason] = React.useState('');
    const [changingLock, setChangingLock] = React.useState(false);
    const [lockError, setLockError] = React.useState<string | null>(null);

    const [togglingMode, setTogglingMode] = React.useState(false);
    const [modeActionError, setModeActionError] = React.useState<string | null>(null);

    // Kits (docs/specs/kits/IMPLEMENTATION_PLAN.md §6) — this player's per-kit gating/cooldown/cost/purchase
    // state exactly as the in-game /kit list shows it, with a Grant button per row that bypasses that state via
    // the same staff-override GiveKitAsync path /kit give uses (DESIGN.md §4.0/§4.1/§4.6).
    const [kits, setKits] = React.useState<KitAvailabilityDto[]>([]);
    const [kitsLoading, setKitsLoading] = React.useState(true);
    const [kitsError, setKitsError] = React.useState<string | null>(null);
    const [grantingKitId, setGrantingKitId] = React.useState<number | null>(null);
    const [grantKitError, setGrantKitError] = React.useState<string | null>(null);

    const groupHintId = React.useId();
    const grantHintId = React.useId();
    const kitHintId = React.useId();
    const lockHintId = React.useId();

    const load = React.useCallback(async () => {
        if (!Number.isFinite(userId) || userId <= 0) {
            setError('Invalid user id.');
            setLoading(false);
            return;
        }
        try {
            setLoading(true);
            const result = normalizeProfileSummary(await userManagementClient.getProfileSummary(userId));
            if (!result) throw new Error('The profile summary has no account.');
            setSummary(result);
            setError(null);
        } catch (err) {
            console.error('Failed to load player profile:', err);
            logging.errorHandler.next('ErrorMessage.PlayerProfile.LoadFailed');
            setError('Could not load this player’s profile. They may not exist, or the request failed.');
        } finally {
            setLoading(false);
        }
    }, [userId]);

    // A different player starts from nothing (no stale header while the next one loads).
    React.useEffect(() => {
        setSummary(null);
        setTransferLock(null);
    }, [userId]);

    // #183 (Realtime S4): the online badge follows the game while the web hub is connected. One
    // player's change is applied at once; many at once or a hub reconnect re-reads only the presence.
    usePresenceChanges(change => {
        if (change?.userId != null) {
            if (change.userId !== userId) return;
            setSummary(previous => previous
                ? { ...previous, presence: { online: change.online === true, lastSeenAt: change.lastSeenAt ?? previous.presence?.lastSeenAt ?? null } }
                : previous);
            return;
        }
        if (!Number.isFinite(userId) || userId <= 0) return;
        userManagementClient.getProfileSummary(userId)
            .then(result => setSummary(previous => previous ? { ...previous, presence: result?.presence ?? previous.presence } : previous))
            .catch(err => console.error('Failed to re-read the online state:', err));
    });

    const loadKits = React.useCallback(async () => {
        if (!Number.isFinite(userId) || userId <= 0) return;
        try {
            setKitsLoading(true);
            setKitsError(null);
            const result = await KitClient.getInstance().getAvailableForUser(userId);
            setKits(Array.isArray(result) ? result : []);
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
        void loadKits();
        void loadTransferLock();
    }, [load, loadKits, loadTransferLock]);

    React.useEffect(() => {
        permissionGroupClient.getAll()
            .then(groups => setAllGroups(Array.isArray(groups) ? groups : []))
            .catch((err) => console.error('Failed to load permission groups:', err));
    }, []);

    const refreshAfterAction = React.useCallback(async () => {
        bumpActivity();
        await load();
    }, [load, bumpActivity]);

    const username = summary?.account.username ?? `User #${id}`;
    const freeze = usePlayerFreeze({ userId, username, confirm, confirmWithReason, onChanged: bumpActivity });
    const reloadFreeze = freeze.reload;

    // #183 (S4): another staff member, or the game (/freeze in game), changed this user: read the profile again.
    // A hub reconnect re-reads the frozen state and the activity (the presence handler above re-reads the badge).
    useLiveEntityChanges('User', change => {
        if (!change.reconnect || change.actors.length > 0) void load();
        void reloadFreeze();
        void loadTransferLock();
        bumpActivity();
    }, { id: Number.isFinite(userId) ? userId : null });

    usePageTitle(summary ? `${summary.account.username} · Player profile` : 'Player profile');

    // MOD-5 "recent players": this viewer's last opened profiles, for the moderation page (this browser only).
    const viewerId = viewer?.id;
    const shownId = summary?.account.id;
    const shownName = summary?.account.username;
    React.useEffect(() => {
        if (shownId != null && shownName) rememberRecentPlayer(viewerId, { id: shownId, username: shownName });
    }, [viewerId, shownId, shownName]);

    const handleAssignGroup = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedGroupId || !groupGate.allowed) return;
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
            setGroupActionError(apiRefusalReason(err) ?? 'Could not assign this group.');
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
            setGroupActionError(apiRefusalReason(err) ?? 'Could not remove this group.');
        } finally {
            setRemovingGroupId(null);
        }
    };

    const handleGrantNode = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!grantNode.trim() || !grantGate.allowed) return;
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
            setGrantActionError(apiRefusalReason(err) ?? 'Could not save this permission node.');
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
            setRevokeNodeError(apiRefusalReason(err) ?? `Could not remove ${node}.`);
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
        if (!transferLock || !lockGate.allowed) return;
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
            bumpActivity();
        } catch (err) {
            console.error('Failed to change the transfer lock:', err);
            setLockError(apiRefusalReason(err) ?? 'Could not change the payment lock.');
        } finally {
            setChangingLock(false);
        }
    };

    // Grant Kit (docs/specs/kits/IMPLEMENTATION_PLAN.md §6) — after a successful grant, re-fetch the kit list
    // (so its resolved cooldown/purchase state reflects the grant immediately) and the activity (the KitGranted
    // audit entry GiveKitAsync records).
    const handleGrantKit = async (kitId: number) => {
        if (!kitGate.allowed) return;
        setGrantingKitId(kitId);
        setGrantKitError(null);
        try {
            await KitClient.getInstance().give(kitId, userId);
            bumpActivity();
            await loadKits();
        } catch (err) {
            console.error('Failed to grant kit:', err);
            setGrantKitError(apiRefusalReason(err) ?? 'Could not grant this kit.');
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
            setModeActionError(apiRefusalReason(err) ?? 'Could not change this player’s mode.');
        } finally {
            setTogglingMode(false);
        }
    };

    if (!summary && loading) {
        return (
            <div className="flex min-h-[50vh] items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" aria-label="Loading the profile" />
            </div>
        );
    }

    if (!summary) {
        return (
            <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
                <p className="text-muted">{error || 'Player not found.'}</p>
                <Link className="btn-secondary text-sm" to="/admin/users">Back to Player moderation</Link>
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
    const frozen = freeze.state?.isFrozen === true;
    const freezeActionGate = frozen ? freeze.unfreezeGate : freeze.freezeGate;

    const overview = (
        <>
            <section className={card} aria-labelledby="account-heading">
                <h2 id="account-heading" className={cardTitle}>Account</h2>
                <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                    {[
                        ['Coins', formatNumber(account.coins)],
                        ['Gems', formatNumber(account.gems)],
                        ['Experience', formatNumber(account.experiencePoints)],
                        ['Account type', account.isFullAccount ? 'Full account' : 'Minecraft-only'],
                        ['Created', formatDateTime(account.createdAt)],
                        ['Status', account.isActive ? 'Active' : 'Deactivated'],
                        ['Email', account.email ? `${account.email}${account.emailVerified ? '' : ' (not verified)'}` : '-'],
                        ['UUID', account.uuid ?? '-'],
                    ].map(([label, value]) => (
                        <div key={label} className="min-w-0">
                            <dt className="text-muted">{label}</dt>
                            <dd className={`break-words font-semibold text-fg ${label === 'UUID' ? 'font-mono text-xs' : ''}`}>{value}</dd>
                        </div>
                    ))}
                </dl>
            </section>

            <section className={card} aria-labelledby="title-heading">
                <h2 id="title-heading" className={cardTitle}>
                    <Award className="mr-2 h-5 w-5" aria-hidden="true" />
                    Title &amp; Experience
                </h2>
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <p className="text-xl font-semibold text-fg">{title.titleName || 'No title'}</p>
                        <p className="text-sm text-muted">{formatNumber(account.experiencePoints)} XP total</p>
                    </div>
                    {title.nextTitleName ? (
                        <div className="text-right text-sm text-muted">
                            <p>Next: <span className="font-medium text-fg">{title.nextTitleName}</span></p>
                            <p>{formatNumber(Math.max(0, (title.nextTitleMinExperience ?? 0) - account.experiencePoints))} XP to go</p>
                        </div>
                    ) : (
                        <div className="text-right text-sm text-muted">
                            <p>Highest title reached</p>
                            <p>{formatNumber(title.prestigeExperience)} prestige XP</p>
                        </div>
                    )}
                </div>
            </section>

            {premiumGroups.length > 0 && (
                <section className={card} aria-labelledby="premium-heading">
                    <h2 id="premium-heading" className={cardTitle}>Premium Tier</h2>
                    <div className="flex flex-wrap gap-3">
                        {premiumGroups.map(g => (
                            <span
                                key={g.permissionGroupId}
                                className={`inline-flex items-center rounded-full px-3 py-1.5 text-sm font-medium ${g.isActive
                                    ? 'bg-info-muted text-info-strong'
                                    : 'bg-surface-alt text-muted line-through'}`}
                            >
                                {g.permissionGroupName}
                                {g.expiresAt && <span className="ml-2 text-xs font-normal">until {formatDateTime(g.expiresAt)}</span>}
                            </span>
                        ))}
                    </div>
                </section>
            )}

            {/* Player statistics (KNG-34) - only for holders of knk.admin.statistics.view. */}
            <PlayerStatisticsPanel key={`statistics-${userId}`} userId={userId} />
        </>
    );

    const economy = (
        <>
            {/* Payment lock (currency Phase 4): changeable with knk.admin.currency.lock. */}
            {transferLock && (
                <section className={card} aria-labelledby="payments-heading">
                    <h2 id="payments-heading" className={cardTitle}>Payments</h2>
                    <form className="flex flex-wrap items-center gap-3 text-sm" onSubmit={(e) => void handleToggleTransferLock(e)}>
                        <span className={`inline-flex items-center font-medium ${transferLock.locked ? 'text-danger-strong' : 'text-muted'}`}>
                            {transferLock.locked ? <Lock className="mr-1 h-4 w-4" aria-hidden="true" /> : <Unlock className="mr-1 h-4 w-4" aria-hidden="true" />}
                            {transferLock.locked ? `Payments locked: ${transferLock.reason ?? ''}` : 'Payments allowed'}
                        </span>
                        {transferLock.locked && transferLock.lockedAt && (
                            <span className="text-xs text-muted">since {formatDateTime(transferLock.lockedAt)}</span>
                        )}
                        {!transferLock.locked && (
                            <input
                                type="text"
                                maxLength={200}
                                aria-label="Lock reason"
                                className={`${fieldInput} min-w-[160px] flex-1`}
                                value={lockReason}
                                disabled={!lockGate.allowed}
                                onChange={(e) => setLockReason(e.target.value)}
                                placeholder="Reason to lock this player's payments"
                            />
                        )}
                        <button
                            type="submit"
                            className="btn-secondary text-sm"
                            disabled={!lockGate.allowed || changingLock || (!transferLock.locked && !lockReason.trim())}
                            title={lockGate.hint ?? undefined}
                            aria-describedby={lockGate.hint ? lockHintId : undefined}
                        >
                            {changingLock ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : transferLock.locked ? 'Unlock payments' : 'Lock payments'}
                        </button>
                        <GatedHint id={lockHintId} hint={lockGate.hint} />
                        {lockError && <span className="field-error w-full text-xs">{lockError}</span>}
                    </form>
                </section>
            )}

            {/* Adjust balance (currency Phase 4; its own card since the KNG-21 smoke test) */}
            <AdjustBalanceCard
                userId={userId}
                balances={account}
                onStart={() => setTitleChangeNotice(null)}
                onAdjusted={handleBalanceAdjusted}
            >
                {titleChangeNotice && (
                    <div className={`mt-3 rounded-md p-3 text-sm ${titleChangeNotice.direction === 'promotion'
                        ? 'border border-warning-line bg-warning-soft text-warning-strong'
                        : 'border border-danger-line bg-danger-soft text-danger-strong'}`}>
                        <p className="font-semibold">
                            {titleChangeNotice.direction === 'promotion' ? '✦ Promoted!' : 'Demoted'}
                            {(titleChangeNotice.crossedTitles?.length ?? 0) > 1
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

            <section className={card} aria-labelledby="salary-heading">
                <h2 id="salary-heading" className={cardTitle}>
                    <Coins className="mr-2 h-5 w-5" aria-hidden="true" />
                    Salary
                </h2>
                <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                    <div>
                        <dt className="text-muted">Title salary x Global x Personal x Rank</dt>
                        <dd className="font-semibold text-fg">
                            {salary.titleSalary} &times; {salary.globalMultiplier} &times; {salary.personalMultiplier} &times; {salary.rankMultiplier}
                        </dd>
                    </div>
                    <div>
                        <dt className="text-muted">Effective rate</dt>
                        <dd className="font-semibold text-fg">{salary.effectiveHourlyRate.toFixed(2)} coins/hr</dd>
                    </div>
                    <div>
                        <dt className="text-muted">Last payout</dt>
                        <dd className="font-semibold text-fg">{formatDateTime(salary.lastSalaryPayoutAt)}</dd>
                    </div>
                    <div>
                        <dt className="text-muted">Next eligible</dt>
                        <dd className="font-semibold text-fg">{formatDateTime(salary.nextEligibleAt)}</dd>
                    </div>
                </dl>
            </section>

            {/* Kits (docs/specs/kits/IMPLEMENTATION_PLAN.md §6, DESIGN.md §4.6) */}
            <section className={card} aria-labelledby="kits-heading">
                <h2 id="kits-heading" className={cardTitle}>
                    <Gift className="mr-2 h-5 w-5" aria-hidden="true" />
                    Kits
                </h2>
                <GatedHint id={kitHintId} hint={kitGate.hint} />
                {kitsLoading ? (
                    <div className="flex items-center text-sm text-muted">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                        Loading…
                    </div>
                ) : kitsError ? (
                    <p className="field-error text-sm">{kitsError}</p>
                ) : kits.length === 0 ? (
                    <p className="text-sm text-muted">No kits are configured yet.</p>
                ) : (
                    <div className="relative overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-line text-left">
                                    <th className={th}>Kit</th>
                                    <th className={th}>Status</th>
                                    <th className={th}>Cooldown</th>
                                    <th className={th}>Cost</th>
                                    <th className={th}><span className="sr-only">Actions</span></th>
                                </tr>
                            </thead>
                            <tbody>
                                {kits.map((kit) => {
                                    const cooldownActive = !!kit.cooldownExpiresAt && new Date(kit.cooldownExpiresAt).getTime() > Date.now();
                                    return (
                                        <tr key={kit.kitId} className="border-b border-line">
                                            <td className="py-2 pr-4">
                                                <p className="font-medium text-fg">{kit.name}</p>
                                                {kit.description && <p className="text-xs text-muted">{kit.description}</p>}
                                            </td>
                                            <td className="py-2 pr-4">
                                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${kit.canClaim
                                                    ? 'bg-success-muted text-success-strong'
                                                    : 'bg-surface-alt text-muted'}`}>
                                                    {kit.canClaim ? 'Available' : (kit.denialReason || 'Not available')}
                                                </span>
                                            </td>
                                            <td className="py-2 pr-4 text-fg">
                                                {cooldownActive ? `Until ${formatDateTime(kit.cooldownExpiresAt)}` : '-'}
                                            </td>
                                            <td className="py-2 pr-4 text-fg">
                                                {kit.isSinglePurchasePremium
                                                    ? (kit.isPurchased ? 'Purchased' : `${kit.premiumPriceGems ?? 0} gems (not purchased)`)
                                                    : (kit.costAmount ? `${kit.costAmount} ${kit.costCurrency ?? ''}`.trim() : 'Free')}
                                            </td>
                                            <td className="py-2 pr-4 text-right">
                                                <button
                                                    className="btn-primary inline-flex items-center px-3 py-1.5 text-xs disabled:opacity-50"
                                                    disabled={!kitGate.allowed || grantingKitId === kit.kitId}
                                                    onClick={() => void handleGrantKit(kit.kitId)}
                                                    title={kitGate.hint ?? 'Grant this kit regardless of gating/cooldown/cost (same as /kit give)'}
                                                    aria-describedby={kitGate.hint ? kitHintId : undefined}
                                                >
                                                    {grantingKitId === kit.kitId
                                                        ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />
                                                        : <Gift className="mr-1.5 h-4 w-4" aria-hidden="true" />}
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
                {grantKitError && <p className="field-error mt-3 text-xs">{grantKitError}</p>}
            </section>

            {/* Balance history (KNG-23, currency Phase 4): the balance event log filtered to this player. */}
            {canReadLedger && (
                <section className={card} aria-labelledby="ledger-heading">
                    <h2 id="ledger-heading" className={cardTitle}>
                        <Coins className="mr-2 h-5 w-5" aria-hidden="true" />
                        Balance history
                    </h2>
                    <BalanceLedgerTable userId={userId} pageSize={20} refreshToken={ledgerRefresh} />
                </section>
            )}
        </>
    );

    const permissionsTab = (
        <>
            <section className={card} aria-labelledby="groups-heading">
                <h2 id="groups-heading" className={cardTitle}>
                    <Users className="mr-2 h-5 w-5" aria-hidden="true" />
                    Groups ({activeGroups.length} active)
                </h2>
                {groups.length === 0 ? (
                    <p className="mb-4 text-sm text-muted">No group memberships.</p>
                ) : (
                    <div className="relative mb-4 overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-line text-left">
                                    <th className={th}>Group</th>
                                    <th className={th}>Weight</th>
                                    <th className={th}>Premium</th>
                                    <th className={th}>Expires</th>
                                    <th className={th}>Status</th>
                                    <th className={th}><span className="sr-only">Actions</span></th>
                                </tr>
                            </thead>
                            <tbody>
                                {groups.map(g => (
                                    <tr key={g.permissionGroupId} className="border-b border-line">
                                        <td className="py-2 pr-4 font-medium text-fg">{g.permissionGroupName || `#${g.permissionGroupId}`}</td>
                                        <td className="py-2 pr-4 text-fg">{g.weight}</td>
                                        <td className="py-2 pr-4 text-fg">{g.isPremiumTier ? 'Yes' : '-'}</td>
                                        <td className="py-2 pr-4 text-fg">{g.expiresAt ? formatDateTime(g.expiresAt) : 'Never'}</td>
                                        <td className="py-2 pr-4">
                                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${g.isActive
                                                ? 'bg-success-muted text-success-strong'
                                                : 'bg-surface-alt text-muted'}`}>
                                                {g.isActive ? 'Active' : 'Expired'}
                                            </span>
                                        </td>
                                        <td className="py-2 pr-4 text-right">
                                            <button
                                                className="text-muted hover:text-danger disabled:opacity-50"
                                                disabled={!groupGate.allowed || removingGroupId === g.permissionGroupId}
                                                onClick={() => void handleRemoveGroup(g.permissionGroupId)}
                                                title={groupGate.hint ?? 'Remove group'}
                                                aria-label={`Remove group ${g.permissionGroupName || `#${g.permissionGroupId}`}`}
                                            >
                                                {removingGroupId === g.permissionGroupId
                                                    ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                                                    : <X className="h-4 w-4" aria-hidden="true" />}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Quick action: assign group (DESIGN.md §3) */}
                <form className="flex flex-wrap items-end gap-3 border-t border-line pt-4" onSubmit={(e) => void handleAssignGroup(e)}>
                    <div>
                        <label htmlFor="assign-group" className="mb-1 block text-xs text-muted">Assign group</label>
                        <select
                            id="assign-group"
                            className={`${fieldInput} min-w-[10rem]`}
                            value={selectedGroupId}
                            disabled={!groupGate.allowed}
                            onChange={(e) => setSelectedGroupId(e.target.value)}
                        >
                            <option value="">Select a group…</option>
                            {availableGroupsToAssign.map((g) => (
                                <option key={g.id} value={g.id!}>{g.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="assign-group-expires" className="mb-1 block text-xs text-muted">Expires (optional)</label>
                        <input
                            id="assign-group-expires"
                            type="datetime-local"
                            className={fieldInput}
                            value={groupExpiresAt}
                            disabled={!groupGate.allowed}
                            onChange={(e) => setGroupExpiresAt(e.target.value)}
                        />
                    </div>
                    <button
                        type="submit"
                        className="btn-primary text-sm"
                        disabled={!groupGate.allowed || !selectedGroupId || assigningGroup}
                        title={groupGate.hint ?? undefined}
                        aria-describedby={groupGate.hint ? groupHintId : undefined}
                    >
                        {assigningGroup ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Plus className="mr-2 h-4 w-4" aria-hidden="true" />}
                        Assign
                    </button>
                    <GatedHint id={groupHintId} hint={groupGate.hint} />
                    {groupActionError && <span className="field-error text-xs">{groupActionError}</span>}
                </form>
            </section>

            <section className={card} aria-labelledby="permissions-heading">
                <h2 id="permissions-heading" className={cardTitle}>
                    <ShieldCheck className="mr-2 h-5 w-5" aria-hidden="true" />
                    Effective Permissions ({permissions.permissions.length})
                </h2>
                {permissions.permissions.length === 0 ? (
                    <p className="mb-4 text-sm text-muted">No declared permission nodes for this player.</p>
                ) : (
                    <div className="relative overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-line text-left">
                                    <th className={th}>Node</th>
                                    <th className={th}>Value</th>
                                    <th className={th}>Source</th>
                                    <th className={th}><span className="sr-only">Actions</span></th>
                                </tr>
                            </thead>
                            <tbody>
                                {permissions.permissions.map(p => (
                                    <tr key={p.node} className="border-b border-line">
                                        <td className="py-2 pr-4 font-mono text-xs text-fg">{p.node}</td>
                                        <td className="py-2 pr-4">
                                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${p.value
                                                ? 'bg-success-muted text-success-strong'
                                                : 'bg-danger-muted text-danger-strong'}`}>
                                                {p.value ? 'Granted' : 'Denied'}
                                            </span>
                                        </td>
                                        <td className="py-2 pr-4 text-fg">
                                            {p.sourceHolderType === 'User'
                                                ? 'Direct grant'
                                                : (p.sourceHolderName || `Group #${p.sourceHolderId}`)}
                                        </td>
                                        <td className="py-2 pr-4 text-right">
                                            {p.sourceHolderType === 'User' ? (
                                                <button
                                                    className="text-muted hover:text-danger disabled:opacity-50"
                                                    disabled={!grantGate.allowed || revokingNode !== null}
                                                    onClick={() => void handleRevokeNode(p.node)}
                                                    title={grantGate.hint ?? `Remove direct ${p.value ? 'grant' : 'deny'}`}
                                                    aria-label={`Remove direct ${p.value ? 'grant' : 'deny'} of ${p.node}`}
                                                >
                                                    {revokingNode === p.node
                                                        ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                                                        : <X className="h-4 w-4" aria-hidden="true" />}
                                                </button>
                                            ) : (
                                                <span
                                                    className="text-xs text-muted"
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
                {revokeNodeError && <p className="field-error mt-2 text-xs">{revokeNodeError}</p>}

                {/* Quick action: grant/deny a node directly on the player (DESIGN.md §3). Saving a node
                    the player already has directly updates its value and expiry (KNG-59). */}
                <form className="mt-4 flex flex-wrap items-end gap-3 border-t border-line pt-4" onSubmit={(e) => void handleGrantNode(e)}>
                    <div className="min-w-[12rem] flex-1">
                        <label htmlFor="grant-node" className="mb-1 block text-xs text-muted">Grant/deny node</label>
                        <input
                            id="grant-node"
                            type="text"
                            placeholder="e.g. knk.gate.open"
                            className={`${fieldInput} w-full font-mono`}
                            value={grantNode}
                            disabled={!grantGate.allowed}
                            onChange={(e) => setGrantNode(e.target.value)}
                        />
                    </div>
                    <div>
                        <label htmlFor="grant-value" className="mb-1 block text-xs text-muted">Value</label>
                        <select
                            id="grant-value"
                            className={fieldInput}
                            value={grantValue}
                            disabled={!grantGate.allowed}
                            onChange={(e) => setGrantValue(e.target.value as 'true' | 'false')}
                        >
                            <option value="true">Grant</option>
                            <option value="false">Deny</option>
                        </select>
                    </div>
                    <div>
                        <label htmlFor="grant-expires" className="mb-1 block text-xs text-muted">
                            Expires {grantExpiresAt ? '(clear for permanent)' : <span className="font-medium text-warning-strong">(permanent)</span>}
                        </label>
                        <div className="flex items-center gap-2">
                            <input
                                id="grant-expires"
                                type="datetime-local"
                                className={fieldInput}
                                value={grantExpiresAt}
                                disabled={!grantGate.allowed}
                                onChange={(e) => setGrantExpiresAt(e.target.value)}
                            />
                            {grantExpiresAt ? (
                                <button type="button" className="text-xs text-muted underline hover:text-danger" onClick={() => setGrantExpiresAt('')}>
                                    Clear
                                </button>
                            ) : (
                                <button type="button" className="text-xs text-muted underline hover:text-fg" onClick={() => setGrantExpiresAt(defaultGrantExpiry())}>
                                    Reset to 1 day
                                </button>
                            )}
                        </div>
                    </div>
                    <button
                        type="submit"
                        className="btn-primary text-sm"
                        disabled={!grantGate.allowed || !grantNode.trim() || grantingNode}
                        title={grantGate.hint ?? undefined}
                        aria-describedby={grantGate.hint ? grantHintId : undefined}
                    >
                        {grantingNode ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Plus className="mr-2 h-4 w-4" aria-hidden="true" />}
                        Save
                    </button>
                    <GatedHint id={grantHintId} hint={grantGate.hint} />
                    {grantActionError && <span className="field-error text-xs">{grantActionError}</span>}
                </form>
            </section>
        </>
    );

    const moderation = (
        <>
            <section className={card} aria-labelledby="freeze-heading" data-testid="freeze-card">
                <h2 id="freeze-heading" className={cardTitle}>
                    <Snowflake className="mr-2 h-5 w-5" aria-hidden="true" />
                    Freeze
                </h2>
                {freeze.loading && !freeze.state ? (
                    <p className="flex items-center text-sm text-muted"><Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />Loading…</p>
                ) : freeze.error ? (
                    <p className="field-error text-sm" role="alert">{freeze.error}</p>
                ) : (
                    <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                        <div className="min-w-0">
                            <p className="font-medium text-fg">
                                {frozen
                                    ? `Frozen${freeze.frozenEntry ? ` since ${formatDateTime(freeze.frozenEntry.timestamp)}` : ''}`
                                    : 'Not frozen'}
                            </p>
                            <p className="mt-0.5 break-words text-muted">
                                {frozen
                                    ? `Reason: ${freeze.state?.frozenReason?.trim() || 'none recorded'}`
                                    : 'A frozen player can’t move, chat, use commands or take damage in game. Freezing asks for a reason.'}
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                className={frozen ? 'btn-secondary text-sm' : 'btn-danger text-sm'}
                                disabled={!freezeActionGate.allowed || freeze.busy}
                                title={freezeActionGate.hint ?? undefined}
                                onClick={() => void (frozen ? freeze.unfreeze() : freeze.freeze())}
                            >
                                {freeze.busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                                {frozen ? 'Unfreeze' : 'Freeze…'}
                            </button>
                            {freezeActionGate.hint && <span className="text-xs text-muted">{freezeActionGate.hint}</span>}
                        </div>
                    </div>
                )}
            </section>

            <section className={card} aria-labelledby="mode-heading">
                <h2 id="mode-heading" className={cardTitle}>
                    <EyeOff className="mr-2 h-5 w-5" aria-hidden="true" />
                    Mode
                </h2>
                {/* Quick action: vanish/owner-staff mode toggle (DESIGN.md §3) */}
                <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Mode">
                    {ACTIVE_MODES.map((mode) => (
                        <button
                            key={mode}
                            type="button"
                            aria-pressed={account.activeMode === mode}
                            disabled={togglingMode || account.activeMode === mode}
                            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-default ${account.activeMode === mode
                                ? 'border-warning-line bg-warning-muted text-warning-strong'
                                : 'border-line bg-surface text-muted hover:bg-surface-alt'}`}
                            onClick={() => void handleToggleMode(mode)}
                        >
                            {activeModeLabel(mode)}
                        </button>
                    ))}
                    {togglingMode && <Loader2 className="h-4 w-4 animate-spin text-muted" aria-hidden="true" />}
                    {modeActionError && <span className="field-error text-xs">{modeActionError}</span>}
                </div>
            </section>

            {/* Admission and web login: Admit / Detach web login (KNG-214) */}
            <PlayerAccessCard account={account} onChanged={refreshAfterAction} />

            <section className={card} aria-labelledby="kickban-heading">
                <h2 id="kickban-heading" className={cardTitle}>
                    <Gavel className="mr-2 h-5 w-5" aria-hidden="true" />
                    Kick and ban
                </h2>
                <p className="text-sm text-muted">
                    Kick and ban are game commands (<span className="font-mono">/kick</span>, <span className="font-mono">/ban</span>,
                    or the player menu in game). The web app can&apos;t send them yet.
                </p>
            </section>
        </>
    );

    const activity = (
        <>
            <PlayerTimeline userId={userId} includeLedger={canReadLedger} refreshToken={activityToken} />
            <PlayerAuditLog userId={userId} refreshToken={activityToken} />
            {/* Discoveries (docs/specs/domain-discovery/DESIGN.md §3.9) - only for holders of
                knk.admin.discovery; each reset adds a DiscoveryReset entry to the audit log.
                Keyed per player so it starts fresh (KNG-39: two panels keyed by the bare userId made React
                lose the old Discoveries panel, which stayed mounted and stacked up on every profile switch). */}
            <PlayerDiscoveriesPanel key={`discoveries-${userId}`} userId={userId} onReset={bumpActivity} />
        </>
    );

    const privacy = (
        <>
            {/* Private messages (docs/specs/private-messages/DESIGN.md §3.4) - only for holders of
                knk.pmlog.read; each read adds a PrivateMessagesViewed entry to the audit log. */}
            <PrivateMessagesPanel key={`private-messages-${userId}`} userId={userId} onViewed={bumpActivity} />
            {/* GDPR data deletion (KNG-34, 2026-10-03) - only for holders of knk.admin.privacy.request:
                file a request for the player (no email step, 5-day grace period) or cancel one. */}
            <StaffDataDeletionCard key={`deletion-${userId}`} userId={userId} username={account.username} onChanged={bumpActivity} />
            <p className="text-sm text-muted">
                Private messages and data deletion each show only with their own node (knk.pmlog.read,
                knk.admin.privacy.request).
            </p>
        </>
    );

    const panels: Record<TabKey, React.ReactNode> = {
        overview, economy, permissions: permissionsTab, moderation, activity, privacy,
    };

    return (
        <div className="mx-auto max-w-5xl space-y-4 sm:space-y-6">
            <header className={card}>
                <div className="mb-3 min-w-0">
                    <h1 className="break-words text-2xl font-bold text-fg">{account.username}</h1>
                    <p className="mt-1 break-words text-sm text-muted">
                        User #{account.id}
                        {account.uuid && <span className="font-mono"> &middot; {account.uuid}</span>}
                        {account.email && <span> &middot; {account.email}</span>}
                    </p>
                </div>
                <PlayerStatusStrip
                    summary={summary}
                    freeze={freeze}
                    transferLock={transferLock}
                    onReload={() => { void refreshAfterAction(); void reloadFreeze(); void loadTransferLock(); }}
                    reloading={loading}
                />
            </header>

            <ProfileTabs tabs={TABS} current={tab} onChange={setTab} idPrefix={TAB_ID_PREFIX} label="Player profile sections" />

            <div
                role="tabpanel"
                id={tabPanelId(TAB_ID_PREFIX, tab)}
                aria-labelledby={tabId(TAB_ID_PREFIX, tab)}
                className="space-y-4 sm:space-y-6"
                data-testid={`profile-panel-${tab}`}
            >
                {panels[tab]}
            </div>
            {confirmModal}
        </div>
    );
};
