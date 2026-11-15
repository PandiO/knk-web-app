import { act, renderHook } from '@testing-library/react';
import { usePlayerKickBan, KICK_NODE, BAN_NODE, KICK_BAN_REASON_MAX_LENGTH } from '../usePlayerKickBan';
import { freezeStateOf, UNFREEZE_TAKES_REASON } from '../usePlayerFreeze';
import { userManagementClient } from '../../../../apiClients/userManagementClient';
import { toast } from '../../../../utils/toast';

// PandiO/knk-workspace#565: Kick and Ban on the player profile, and the frozen state read from the profile summary.

jest.mock('../../../../apiClients/userManagementClient', () => ({
    userManagementClient: { kick: jest.fn(), ban: jest.fn() },
}));
let mockHeld = new Set<string>();
jest.mock('../../../../hooks/useStaffAccess', () => ({
    usePermission: (node: string) => {
        const allowed = mockHeld.has(node);
        return { allowed, isChecking: false, status: allowed ? 'allowed' : 'denied', retry: () => undefined };
    },
}));

const um = userManagementClient as unknown as Record<string, jest.Mock>;

const setup = (answer: string | null) => {
    const confirmWithReason = jest.fn().mockResolvedValue(answer);
    const onChanged = jest.fn();
    const hook = renderHook(() => usePlayerKickBan({ userId: 3, username: 'Steve', confirmWithReason, onChanged }));
    return { hook, confirmWithReason, onChanged };
};

beforeEach(() => {
    jest.clearAllMocks();
    mockHeld = new Set([KICK_NODE, BAN_NODE]);
    um.kick.mockResolvedValue({ actionId: 'a', userId: 3, gameServers: 1 });
    um.ban.mockResolvedValue({ actionId: 'b', userId: 3, gameServers: 1 });
});

describe('usePlayerKickBan', () => {
    it('uses the nodes knk.kick and knk.ban and a 200-character reason', () => {
        expect([KICK_NODE, BAN_NODE, KICK_BAN_REASON_MAX_LENGTH]).toEqual(['knk.kick', 'knk.ban', 200]);
    });

    it('kick asks an optional reason, sends it (blank = none) and reports the change', async () => {
        const success = jest.spyOn(toast, 'success').mockImplementation(() => undefined as never);
        const { hook, confirmWithReason, onChanged } = setup('');
        await act(() => hook.result.current.kick());
        expect(confirmWithReason).toHaveBeenCalledWith(expect.objectContaining({
            title: 'Kick Steve?', danger: true, reason: expect.objectContaining({ required: false, maxLength: 200 }),
        }));
        expect(um.kick).toHaveBeenCalledWith(3, undefined);
        expect(success).toHaveBeenCalledWith('Steve is being kicked');
        expect(onChanged).toHaveBeenCalled();
    });

    it('ban asks a required reason, says permanent and /pardon, and sends it', async () => {
        const { hook, confirmWithReason } = setup('X-ray');
        await act(() => hook.result.current.ban());
        const options = confirmWithReason.mock.calls[0][0];
        expect(options.title).toBe('Ban Steve permanently?');
        expect(options.message).toMatch(/permanent/);
        expect(options.message).toMatch(/\/pardon in game/);
        expect(options.reason.required).toBeUndefined(); // required by default
        expect(um.ban).toHaveBeenCalledWith(3, 'X-ray');
    });

    it('does nothing when the confirm is cancelled', async () => {
        const { hook, onChanged } = setup(null);
        await act(() => hook.result.current.kick());
        await act(() => hook.result.current.ban());
        expect(um.kick).not.toHaveBeenCalled();
        expect(um.ban).not.toHaveBeenCalled();
        expect(onChanged).not.toHaveBeenCalled();
    });

    it('without the node: gated with "Requires …" and never asks', async () => {
        mockHeld = new Set();
        const { hook, confirmWithReason } = setup('x');
        expect(hook.result.current.kickGate).toMatchObject({ allowed: false, hint: 'Requires knk.kick' });
        expect(hook.result.current.banGate).toMatchObject({ allowed: false, hint: 'Requires knk.ban' });
        await act(() => hook.result.current.ban());
        expect(confirmWithReason).not.toHaveBeenCalled();
    });

    it('names the API refusal in an error toast', async () => {
        jest.spyOn(console, 'error').mockImplementation(() => undefined);
        const error = jest.spyOn(toast, 'error').mockImplementation(() => undefined as never);
        um.kick.mockRejectedValue({ status: 409, response: { error: 'PlayerNotOnline', message: 'Steve is not online, so there is nothing to kick.' } });
        const { hook, onChanged } = setup('');
        await act(() => hook.result.current.kick());
        expect(error).toHaveBeenCalledWith(expect.stringMatching(/^Could not kick Steve: .*not online/), {});
        expect(onChanged).not.toHaveBeenCalled();
        expect(hook.result.current.busy).toBeNull();
    });
});

describe('freezeStateOf (#565)', () => {
    it('reads the frozen state, since when and by whom from the summary account', () => {
        expect(freezeStateOf({ isFrozen: true, frozenReason: 'Spam', frozenAt: '2026-11-08T07:30:00', frozenByUserId: 9,
            frozenByUsername: 'Mod' } as never)).toEqual({
            isFrozen: true, frozenReason: 'Spam', frozenAt: '2026-11-08T07:30:00', frozenByUserId: 9, frozenByUsername: 'Mod',
        });
    });

    it('treats an older API (no freeze fields) as not frozen, and no account as unknown', () => {
        expect(freezeStateOf({ id: 1, username: 'x' } as never)).toEqual({
            isFrozen: false, frozenReason: null, frozenAt: null, frozenByUserId: null, frozenByUsername: null,
        });
        expect(freezeStateOf(null)).toBeNull();
    });

    it('asks an unfreeze reason now that the API stores it', () => {
        expect(UNFREEZE_TAKES_REASON).toBe(true);
    });
});
