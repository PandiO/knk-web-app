import React from 'react';
import { userManagementClient } from '../../../apiClients/userManagementClient';
import { ActionGate, useActionGate } from '../../../hooks/useActionGate';
import { ConfirmFn, ConfirmWithReasonFn } from '../../../hooks/useConfirm';
import { PlayerFreezeStateDto, ProfileAccountDto } from '../../../types/dtos/userManagement/UserProfileSummaryDtos';
import { apiRefusalReason } from '../../../utils/apiRefusalReason';
import { toast } from '../../../utils/toast';

/** The API's freeze and unfreeze nodes (StaffPermissions.Freeze / .Unfreeze). */
export const FREEZE_NODE = 'knk.freeze';
export const UNFREEZE_NODE = 'knk.unfreeze';

/** Longest freeze reason the dialog takes (the game shows it in chat). */
export const FREEZE_REASON_MAX_LENGTH = 200;

/**
 * Whether `PUT api/Users/{id}/unfreeze` stores a reason. Since #565 it takes an optional `{ reason }` and writes it into
 * the PlayerUnfrozen audit entry, so the unfreeze confirm asks for an optional reason and `unfreeze` sends it.
 */
export const UNFREEZE_TAKES_REASON = true;

export interface PlayerFreeze {
    /** null until the profile summary is read (or when it failed). */
    state: PlayerFreezeStateDto | null;
    /** True until the summary is read. */
    loading: boolean;
    error: string | null;
    busy: boolean;
    freezeGate: ActionGate;
    unfreezeGate: ActionGate;
    /** Reads the profile summary again (the frozen state comes with it). */
    reload: () => Promise<void>;
    freeze: () => Promise<void>;
    unfreeze: () => Promise<void>;
}

/** #565: the frozen state from the profile summary's account (since when and by whom: absent from an older API). */
export function freezeStateOf(account: ProfileAccountDto | null | undefined): PlayerFreezeStateDto | null {
    if (!account) return null;
    return {
        isFrozen: account.isFrozen === true,
        frozenReason: account.frozenReason ?? null,
        frozenAt: account.frozenAt ?? null,
        frozenByUserId: account.frozenByUserId ?? null,
        frozenByUsername: account.frozenByUsername ?? null,
    };
}

/**
 * #119 (MOD-3): the player's frozen state and the Freeze / Unfreeze actions of the profile (status strip and the
 * Moderation tab). Freeze asks a required reason in the shared confirm (`confirmWithReason`, made for this case in
 * #33); it is saved on the player, in the audit log, and the game applies the freeze at once (#179). Since #565 the
 * state, since when and by whom, comes with the profile summary (`account`), so the profile makes no extra read of
 * the user or the audit log; unfreeze asks an optional reason for the audit log.
 */
export function usePlayerFreeze(options: {
    userId: number;
    username: string;
    /** The profile summary's account; null while it loads. */
    account: ProfileAccountDto | null;
    /** True while the summary is read for the first time. */
    loading?: boolean;
    /** Reads the profile summary again. */
    reloadSummary: () => Promise<void>;
    confirm: ConfirmFn;
    confirmWithReason: ConfirmWithReasonFn;
    /** After a change: re-read the timeline and audit log. */
    onChanged: () => void;
}): PlayerFreeze {
    const { userId, username, account, loading = false, reloadSummary, confirm, confirmWithReason, onChanged } = options;
    const freezeGate = useActionGate(FREEZE_NODE);
    const unfreezeGate = useActionGate(UNFREEZE_NODE);
    const [busy, setBusy] = React.useState(false);
    const state = React.useMemo(() => freezeStateOf(account), [account]);

    const reload = React.useCallback(async () => {
        if (!Number.isFinite(userId) || userId <= 0) return;
        await reloadSummary();
    }, [userId, reloadSummary]);

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

    return { state, loading: loading && !state, error: null, busy, freezeGate, unfreezeGate, reload, freeze, unfreeze };
}
