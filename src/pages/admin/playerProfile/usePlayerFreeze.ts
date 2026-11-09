import React from 'react';
import { userManagementClient } from '../../../apiClients/userManagementClient';
import { ActionGate, useActionGate } from '../../../hooks/useActionGate';
import { ConfirmFn, ConfirmWithReasonFn } from '../../../hooks/useConfirm';
import { AuditLogEntryDto, PlayerFreezeStateDto } from '../../../types/dtos/userManagement/UserProfileSummaryDtos';
import { apiRefusalReason } from '../../../utils/apiRefusalReason';
import { toast } from '../../../utils/toast';

/** The API's freeze and unfreeze nodes (StaffPermissions.Freeze / .Unfreeze). */
export const FREEZE_NODE = 'knk.freeze';
export const UNFREEZE_NODE = 'knk.unfreeze';

/** Longest freeze reason the dialog takes (the game shows it in chat). */
export const FREEZE_REASON_MAX_LENGTH = 200;

/**
 * Whether `PUT api/Users/{id}/unfreeze` stores a reason. It takes no body today, so the unfreeze confirm asks no
 * reason (one that is dropped would be a lie). When the API stores one (V3 report, "API needs"), set this to true:
 * the confirm then asks for an optional reason and `unfreeze` sends it.
 */
export const UNFREEZE_TAKES_REASON = false;

export interface PlayerFreeze {
    /** null until read, or when the read failed (`error`). */
    state: PlayerFreezeStateDto | null;
    /** The latest PlayerFrozen audit entry while frozen: when and by whom. */
    frozenEntry: AuditLogEntryDto | null;
    loading: boolean;
    error: string | null;
    busy: boolean;
    freezeGate: ActionGate;
    unfreezeGate: ActionGate;
    reload: () => Promise<void>;
    freeze: () => Promise<void>;
    unfreeze: () => Promise<void>;
}

/**
 * #119 (MOD-3): the player's frozen state and the Freeze / Unfreeze actions of the profile (status strip and the
 * Moderation tab). Freeze asks a required reason in the shared confirm (`confirmWithReason`, made for this case in
 * #33); it is saved on the player, in the audit log, and the game applies the freeze at once (#179).
 */
export function usePlayerFreeze(options: {
    userId: number;
    username: string;
    confirm: ConfirmFn;
    confirmWithReason: ConfirmWithReasonFn;
    /** After a change: re-read the timeline, audit log and summary. */
    onChanged: () => void;
}): PlayerFreeze {
    const { userId, username, confirm, confirmWithReason, onChanged } = options;
    const freezeGate = useActionGate(FREEZE_NODE);
    const unfreezeGate = useActionGate(UNFREEZE_NODE);
    const [state, setState] = React.useState<PlayerFreezeStateDto | null>(null);
    const [frozenEntry, setFrozenEntry] = React.useState<AuditLogEntryDto | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [busy, setBusy] = React.useState(false);
    const latest = React.useRef(0);

    const reload = React.useCallback(async () => {
        if (!Number.isFinite(userId) || userId <= 0) return;
        const call = ++latest.current;
        setLoading(true);
        try {
            const next = await userManagementClient.getFreezeState(userId);
            let entry: AuditLogEntryDto | null = null;
            if (next.isFrozen) {
                try {
                    const page = await userManagementClient.getAuditLog({ targetUserId: userId, action: 'PlayerFrozen', pageSize: 1 });
                    entry = page?.items?.[0] ?? null;
                } catch (err) {
                    console.error('Failed to read when the player was frozen:', err);
                }
            }
            if (call !== latest.current) return;
            setState(next);
            setFrozenEntry(entry);
            setError(null);
        } catch (err) {
            if (call !== latest.current) return;
            console.error('Failed to read the frozen state:', err);
            setState(null);
            setError('Could not read whether this player is frozen.');
        } finally {
            if (call === latest.current) setLoading(false);
        }
    }, [userId]);

    React.useEffect(() => {
        setState(null);
        setFrozenEntry(null);
        void reload();
    }, [reload]);

    const freeze = async () => {
        if (busy || !freezeGate.allowed) return;
        const reason = await confirmWithReason({
            title: `Freeze ${username}?`,
            message: 'In game they can no longer move, chat, use commands or take damage until a staff member unfreezes them. '
                + 'It applies at once while they are online, otherwise when they next join.',
            confirmLabel: 'Freeze',
            danger: true,
            reason: {
                label: 'Reason',
                placeholder: 'Why is this player frozen?',
                hint: 'Saved on the player and in the audit log; staff see it on this profile.',
                maxLength: FREEZE_REASON_MAX_LENGTH,
            },
        });
        if (reason === null) return;
        setBusy(true);
        try {
            await userManagementClient.freeze(userId, reason);
            toast.success(`${username} is frozen`);
            await reload();
            onChanged();
        } catch (err) {
            console.error('Failed to freeze the player:', err);
            toast.error(`Could not freeze ${username}: ${apiRefusalReason(err) ?? 'the request failed.'}`, {});
        } finally {
            setBusy(false);
        }
    };

    const unfreeze = async () => {
        if (busy || !unfreezeGate.allowed) return;
        const message = 'They can move, chat and use commands again; the game lifts the freeze at once.';
        let reason: string | null | undefined;
        if (UNFREEZE_TAKES_REASON) {
            reason = await confirmWithReason({
                title: `Unfreeze ${username}?`, message, confirmLabel: 'Unfreeze',
                reason: { required: false, label: 'Reason', hint: 'Saved in the audit log.', maxLength: FREEZE_REASON_MAX_LENGTH },
            });
            if (reason === null) return;
        } else if (!(await confirm({ title: `Unfreeze ${username}?`, message, confirmLabel: 'Unfreeze' }))) {
            return;
        }
        setBusy(true);
        try {
            await userManagementClient.unfreeze(userId, reason || undefined);
            toast.success(`${username} is unfrozen`);
            await reload();
            onChanged();
        } catch (err) {
            console.error('Failed to unfreeze the player:', err);
            toast.error(`Could not unfreeze ${username}: ${apiRefusalReason(err) ?? 'the request failed.'}`, {});
        } finally {
            setBusy(false);
        }
    };

    return { state, frozenEntry, loading, error, busy, freezeGate, unfreezeGate, reload, freeze, unfreeze };
}
