import React from 'react';
import { userManagementClient } from '../../../apiClients/userManagementClient';
import { ActionGate, useActionGate } from '../../../hooks/useActionGate';
import { ConfirmWithReasonFn } from '../../../hooks/useConfirm';
import { apiRefusalReason } from '../../../utils/apiRefusalReason';
import { toast } from '../../../utils/toast';

/** The API's kick and ban nodes (StaffPermissions.Kick / .Ban, PandiO/knk-workspace#565). */
export const KICK_NODE = 'knk.kick';
export const BAN_NODE = 'knk.ban';

/** Longest kick or ban reason (PlayerModerationService.MaxReasonLength; the game shows it on the kick/ban screen). */
export const KICK_BAN_REASON_MAX_LENGTH = 200;

export interface PlayerKickBan {
    busy: 'kick' | 'ban' | null;
    kickGate: ActionGate;
    banGate: ActionGate;
    kick: () => Promise<void>;
    ban: () => Promise<void>;
}

/**
 * #565: Kick and Ban on the player profile (developer decisions 2026-11-15). Kick asks an optional reason, ban a
 * required one and says it is permanent and lifted only with /pardon in game. The API audits the action and sends it
 * to the game servers (PlayerKick / PlayerBan), which carry it out; it refuses a kick of an offline player (409) and
 * both while no game server is connected (503), and the toast names the refusal.
 */
export function usePlayerKickBan(options: {
    userId: number;
    username: string;
    confirmWithReason: ConfirmWithReasonFn;
    /** After a change: re-read the timeline and audit log. */
    onChanged: () => void;
}): PlayerKickBan {
    const { userId, username, confirmWithReason, onChanged } = options;
    const kickGate = useActionGate(KICK_NODE);
    const banGate = useActionGate(BAN_NODE);
    const [busy, setBusy] = React.useState<'kick' | 'ban' | null>(null);

    const kick = async () => {
        if (busy || !kickGate.allowed) return;
        const reason = await confirmWithReason({
            title: `Kick ${username}?`,
            message: 'The game server disconnects them now; they can join again straight away. Only works while they are online.',
            confirmLabel: 'Kick',
            danger: true,
            reason: {
                required: false,
                label: 'Reason',
                placeholder: 'Shown to the player when they are kicked',
                hint: 'Shown to the player and saved in the audit log.',
                maxLength: KICK_BAN_REASON_MAX_LENGTH,
            },
        });
        if (reason === null) return;
        setBusy('kick');
        try {
            await userManagementClient.kick(userId, reason || undefined);
            toast.success(`${username} is being kicked`);
            onChanged();
        } catch (err) {
            console.error('Failed to kick the player:', err);
            toast.error(`Could not kick ${username}: ${apiRefusalReason(err) ?? 'the request failed.'}`, {});
        } finally {
            setBusy(null);
        }
    };

    const ban = async () => {
        if (busy || !banGate.allowed) return;
        const reason = await confirmWithReason({
            title: `Ban ${username} permanently?`,
            message: 'The game server adds them to its ban list and kicks them if they are online. The ban is permanent: '
                + 'there is no unban in the web app; a staff member lifts it with /pardon in game.',
            confirmLabel: 'Ban permanently',
            danger: true,
            reason: {
                label: 'Reason',
                placeholder: 'Why is this player banned?',
                hint: 'Shown to the player on the ban screen and saved in the audit log.',
                maxLength: KICK_BAN_REASON_MAX_LENGTH,
            },
        });
        if (reason === null) return;
        setBusy('ban');
        try {
            await userManagementClient.ban(userId, reason);
            toast.success(`${username} is banned`);
            onChanged();
        } catch (err) {
            console.error('Failed to ban the player:', err);
            toast.error(`Could not ban ${username}: ${apiRefusalReason(err) ?? 'the request failed.'}`, {});
        } finally {
            setBusy(null);
        }
    };

    return { busy, kickGate, banGate, kick, ban };
}
