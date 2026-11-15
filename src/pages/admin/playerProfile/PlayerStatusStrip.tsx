import React from 'react';
import { Ban, DoorOpen, EyeOff, Loader2, Lock, RefreshCcw, Snowflake, Sun } from 'lucide-react';
import { ActiveMode, UserProfileSummaryDto } from '../../../types/dtos/userManagement/UserProfileSummaryDtos';
import { TransferLockDto } from '../../../types/dtos/currency/CurrencyDtos';
import { formatDateTime } from '../../../utils/format';
import { PlayerFreeze } from './usePlayerFreeze';
import { PlayerKickBan } from './usePlayerKickBan';

type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const TONE: Record<Tone, string> = {
    success: 'bg-success-muted text-success-strong',
    warning: 'bg-warning-muted text-warning-strong',
    danger: 'bg-danger-muted text-danger-strong',
    info: 'bg-info-muted text-info-strong',
    neutral: 'bg-surface-alt text-muted border border-line',
};

export const StatusChip: React.FC<{ tone: Tone; children: React.ReactNode; title?: string; testId?: string }> = ({ tone, children, title, testId }) => (
    <li
        data-testid={testId}
        title={title}
        className={`inline-flex max-w-full items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${TONE[tone]}`}
    >
        {children}
    </li>
);

export const activeModeLabel = (mode: ActiveMode): string => {
    switch (mode) {
        case 'Owner': return 'Owner mode';
        case 'Staff': return 'Staff mode';
        default: return 'Visible (no mode)';
    }
};

/** A button the user may lack the node for: disabled with the "Requires <node>" hint next to it (#280). */
export const GatedHint: React.FC<{ id: string; hint: string | null }> = ({ id, hint }) =>
    hint ? <span id={id} className="text-xs text-muted" data-testid="action-hint">{hint}</span> : null;

interface Props {
    summary: UserProfileSummaryDto;
    freeze: PlayerFreeze;
    /** #565: Kick and Ban next to Freeze (only for a player with a Minecraft account). */
    kickBan?: PlayerKickBan;
    transferLock: TransferLockDto | null;
    onReload: () => void;
    reloading?: boolean;
}

/**
 * #119 (MOD-4, MOD-3 phase 1): the profile header's status strip. What staff need at a glance (online, mode,
 * frozen, payments locked, premium tier and the account flags) as chips, with Freeze / Unfreeze, Kick and Ban (#565)
 * next to them and, while frozen, since when, by whom and why (from the profile summary since #565).
 */
export const PlayerStatusStrip: React.FC<Props> = ({ summary, freeze, kickBan, transferLock, onReload, reloading = false }) => {
    const { account, groups } = summary;
    const presence = summary.presence;
    const frozen = freeze.state?.isFrozen === true;
    const hintId = React.useId();
    const kickHintId = React.useId();
    const banHintId = React.useId();
    const gate = frozen ? freeze.unfreezeGate : freeze.freezeGate;
    const activePremium = groups.filter(g => g.isPremiumTier && g.isActive);
    const premiumName = account.premiumTierName ?? activePremium[0]?.permissionGroupName ?? null;
    const premiumUntil = account.premiumTierName ? account.premiumTierExpiresAt : activePremium[0]?.expiresAt;

    return (
        <div className="space-y-3" data-testid="status-strip">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <ul aria-label="Player status" className="flex min-w-0 flex-wrap items-center gap-2">
                    {account.uuid && presence && (
                        <StatusChip
                            tone={presence.online ? 'success' : 'neutral'}
                            testId="profile-presence"
                            title={!presence.online && presence.lastSeenAt ? `Last seen ${formatDateTime(presence.lastSeenAt)}` : undefined}
                        >
                            {presence.online
                                ? 'Online'
                                : presence.lastSeenAt ? `Offline · last seen ${formatDateTime(presence.lastSeenAt)}` : 'Offline'}
                        </StatusChip>
                    )}
                    {!account.uuid && <StatusChip tone="neutral">No Minecraft account</StatusChip>}
                    {account.activeMode !== 'None' && (
                        <StatusChip tone="warning">
                            <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
                            {activeModeLabel(account.activeMode)}
                        </StatusChip>
                    )}
                    {frozen && (
                        <StatusChip tone="danger" testId="status-frozen">
                            <Snowflake className="h-3.5 w-3.5" aria-hidden="true" />
                            Frozen
                        </StatusChip>
                    )}
                    {freeze.error && <StatusChip tone="neutral" title={freeze.error}>Frozen: unknown</StatusChip>}
                    {transferLock?.locked && (
                        <StatusChip tone="danger" title={transferLock.reason ?? undefined} testId="status-payments-locked">
                            <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                            Payments locked
                        </StatusChip>
                    )}
                    {premiumName && (
                        <StatusChip tone="info" testId="status-premium">
                            {premiumName}
                            {premiumUntil && <span className="font-normal">until {formatDateTime(premiumUntil)}</span>}
                        </StatusChip>
                    )}
                    {!account.isActive && <StatusChip tone="danger">Deactivated</StatusChip>}
                    {account.admitted === false && (
                        <StatusChip tone="warning" title="The game server's admission gate stops this account (no invitation)">Not admitted</StatusChip>
                    )}
                    {!account.isFullAccount && <StatusChip tone="neutral" title="No web login">Minecraft-only</StatusChip>}
                    {account.isFullAccount && account.email && !account.emailVerified && (
                        <StatusChip tone="neutral">Email not verified</StatusChip>
                    )}
                </ul>
                <div className="flex flex-wrap items-center justify-end gap-2">
                    {freeze.state && (
                        <>
                            <button
                                type="button"
                                className={frozen ? 'btn-secondary text-sm' : 'btn-danger text-sm'}
                                disabled={!gate.allowed || freeze.busy}
                                title={gate.hint ?? undefined}
                                aria-describedby={gate.hint ? hintId : undefined}
                                onClick={() => void (frozen ? freeze.unfreeze() : freeze.freeze())}
                                data-testid={frozen ? 'unfreeze-button' : 'freeze-button'}
                            >
                                {freeze.busy
                                    ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                                    : frozen ? <Sun className="mr-2 h-4 w-4" aria-hidden="true" /> : <Snowflake className="mr-2 h-4 w-4" aria-hidden="true" />}
                                {frozen ? 'Unfreeze' : 'Freeze'}
                            </button>
                            <GatedHint id={hintId} hint={gate.hint} />
                        </>
                    )}
                    {kickBan && account.uuid && (
                        <>
                            <button
                                type="button"
                                className="btn-secondary text-sm"
                                disabled={!kickBan.kickGate.allowed || kickBan.busy !== null}
                                title={kickBan.kickGate.hint ?? undefined}
                                aria-describedby={kickBan.kickGate.hint ? kickHintId : undefined}
                                onClick={() => void kickBan.kick()}
                                data-testid="kick-button"
                            >
                                {kickBan.busy === 'kick'
                                    ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                                    : <DoorOpen className="mr-2 h-4 w-4" aria-hidden="true" />}
                                Kick
                            </button>
                            <GatedHint id={kickHintId} hint={kickBan.kickGate.hint} />
                            <button
                                type="button"
                                className="btn-danger text-sm"
                                disabled={!kickBan.banGate.allowed || kickBan.busy !== null}
                                title={kickBan.banGate.hint ?? undefined}
                                aria-describedby={kickBan.banGate.hint ? banHintId : undefined}
                                onClick={() => void kickBan.ban()}
                                data-testid="ban-button"
                            >
                                {kickBan.busy === 'ban'
                                    ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                                    : <Ban className="mr-2 h-4 w-4" aria-hidden="true" />}
                                Ban
                            </button>
                            <GatedHint id={banHintId} hint={kickBan.banGate.hint} />
                        </>
                    )}
                    <button type="button" className="btn-secondary text-sm" onClick={onReload} disabled={reloading}>
                        <RefreshCcw className={`mr-2 h-4 w-4 ${reloading ? 'animate-spin' : ''}`} aria-hidden="true" />
                        Reload
                    </button>
                </div>
            </div>
            {frozen && (
                <div role="status" className="rounded-md border border-danger-line bg-danger-soft px-3 py-2 text-sm text-danger-strong" data-testid="frozen-banner">
                    <p className="font-medium">
                        Frozen
                        {freeze.state?.frozenAt && <> since {formatDateTime(freeze.state.frozenAt)}</>}
                        {freeze.state?.frozenAt && <> by {freeze.state.frozenByUsername ?? 'the game server or the system'}</>}
                    </p>
                    <p className="mt-0.5 break-words">Reason: {freeze.state?.frozenReason?.trim() || 'none recorded'}</p>
                </div>
            )}
        </div>
    );
};
