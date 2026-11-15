import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { PlayerProfilePage } from '../PlayerProfilePage';
import { userManagementClient } from '../../../apiClients/userManagementClient';
import { currencyClient } from '../../../apiClients/currencyClient';
import { toast } from '../../../utils/toast';
import { fakeRealtime } from '../../../test-utils/fakeRealtime';

// PandiO/knk-workspace#119 (V3): the staff player profile's status strip, tabs, freeze/unfreeze with a reason,
// the per-player timeline and the paged audit log; actions disabled with "Requires <node>" without their node.
// #565: the frozen state from the summary, the unfreeze reason, game sessions in the timeline, Kick and Ban.

jest.mock('react-router-dom', () => jest.requireActual('react-router'), { virtual: true });
jest.mock('../../../apiClients/userManagementClient', () => ({
    userManagementClient: {
        getProfileSummary: jest.fn(),
        getAuditLog: jest.fn(),
        freeze: jest.fn(),
        unfreeze: jest.fn(),
        kick: jest.fn(),
        ban: jest.fn(),
        toggleVanishMode: jest.fn(),
    },
}));
jest.mock('../../../contexts/AuthContext', () => ({
    useAuth: () => ({ user: { id: 1, username: 'Staff' } }),
}));
jest.mock('../../../apiClients/permissionGroupClient', () => ({
    permissionGroupClient: { getAll: () => Promise.resolve([]) },
}));
jest.mock('../../../apiClients/kitClient', () => ({
    KitClient: { getInstance: () => ({ getAvailableForUser: () => Promise.resolve([]) }) },
}));
jest.mock('../../../apiClients/currencyClient', () => ({
    currencyClient: { getTransferLock: jest.fn(), getLedger: jest.fn() },
}));
const mockGetSessions = jest.fn();
jest.mock('../../../apiClients/statisticsClient', () => ({
    StatisticsClient: { getInstance: () => ({ getSessions: (...args: unknown[]) => mockGetSessions(...args) }) },
}));
// The nodes the viewer holds (exact, no wildcards here).
let mockHeld = new Set<string>();
jest.mock('../../../hooks/useStaffAccess', () => ({
    usePermission: (node: string) => {
        const allowed = mockHeld.has(node);
        return { allowed, isChecking: false, status: allowed ? 'allowed' : 'denied', retry: () => undefined };
    },
}));
jest.mock('../../../components/admin/PlayerDiscoveriesPanel', () => ({ PlayerDiscoveriesPanel: () => <div>Discoveries</div> }));
jest.mock('../../../components/admin/PlayerStatisticsPanel', () => ({ PlayerStatisticsPanel: () => <div>Statistics</div> }));
jest.mock('../../../components/admin/PrivateMessagesPanel', () => ({ PrivateMessagesPanel: () => <div>Private messages</div> }));
jest.mock('../../../components/admin/StaffDataDeletionCard', () => ({ StaffDataDeletionCard: () => <div>Data deletion</div> }));
jest.mock('../../../components/admin/PlayerAccessCard', () => ({ PlayerAccessCard: () => <div>Access card</div> }));
jest.mock('../../../components/currency/AdjustBalanceCard', () => ({ AdjustBalanceCard: () => <div>Adjust balance</div> }));
jest.mock('../../../components/currency/BalanceLedgerTable', () => ({ BalanceLedgerTable: () => <div>Ledger table</div> }));

const um = userManagementClient as unknown as Record<string, jest.Mock>;
const cc = currencyClient as unknown as Record<string, jest.Mock>;

const fullSummary = (overrides: Record<string, unknown> = {}) => ({
    account: {
        id: 3, username: 'Steve', uuid: '069a79f4-44e9-4726-a5be-fca90e38aaf5', email: 'steve@example.test', coins: 1234, gems: 5,
        experiencePoints: 4567, emailVerified: true, activeMode: 'Staff', prestigeExperience: 0, personalSalaryMultiplier: 1,
        lastSalaryPayoutAt: '2026-11-08T08:00:00', isFullAccount: true, createdAt: '2026-01-01T00:00:00', isActive: true, admitted: true,
        premiumTierName: 'Knight+', premiumTierExpiresAt: '2026-12-01T00:00:00',
    },
    permissions: { userId: 3, permissions: [{ node: 'knk.gate.open', value: true, sourceHolderId: 3, sourceHolderType: 'User' }] },
    groups: [{ userId: 3, permissionGroupId: 2, permissionGroupName: 'Builder', weight: 10, isPremiumTier: false, isActive: true }],
    title: { titleName: 'Squire', prestigeExperience: 0, nextTitleName: 'Knight', nextTitleMinExperience: 5000 },
    salary: { titleSalary: 100, globalMultiplier: 1, personalMultiplier: 1, rankMultiplier: 1, effectiveHourlyRate: 100,
        lastSalaryPayoutAt: '2026-11-08T08:00:00', nextEligibleAt: '2026-11-08T09:00:00' },
    presence: { online: true, lastSeenAt: null },
    ...overrides,
});

/** #565: the summary's account as frozen (or not) by the API. */
const withFreeze = (frozen: boolean, reason: string | null = null, extra: Record<string, unknown> = {}) => fullSummary({
    account: {
        ...fullSummary().account, isFrozen: frozen, frozenReason: frozen ? reason : null,
        frozenAt: frozen ? '2026-11-08T07:30:00' : null, frozenByUserId: frozen ? 9 : null, frozenByUsername: frozen ? 'Mod' : null,
        ...extra,
    },
});

let LocationProbe: React.FC;
let lastSearch = '';
LocationProbe = () => {
    lastSearch = useLocation().search;
    return null;
};

const renderProfile = (path = '/admin/users/3', hub?: ReturnType<typeof fakeRealtime>) => {
    const tree = (
        <MemoryRouter initialEntries={[path]}>
            <LocationProbe />
            <Routes>
                <Route path="/admin/users/:id" element={<PlayerProfilePage />} />
            </Routes>
        </MemoryRouter>
    );
    return render(hub ? <hub.Provider>{tree}</hub.Provider> : tree);
};

beforeEach(() => {
    jest.clearAllMocks();
    mockHeld = new Set(['knk.freeze', 'knk.unfreeze', 'knk.kick', 'knk.ban', 'knk.admin.user.group', 'knk.admin.user.perm', 'knk.kit.give', 'knk.admin.currency.lock', 'knk.admin.currency.history']);
    um.getProfileSummary.mockResolvedValue(withFreeze(false));
    um.getAuditLog.mockResolvedValue({ items: [], totalCount: 0, pageNumber: 1, pageSize: 25 });
    um.freeze.mockResolvedValue(undefined);
    um.unfreeze.mockResolvedValue(undefined);
    um.kick.mockResolvedValue({ actionId: 'a1', userId: 3, gameServers: 1 });
    um.ban.mockResolvedValue({ actionId: 'a2', userId: 3, gameServers: 1 });
    mockGetSessions.mockResolvedValue({ items: [], totalCount: 0, pageNumber: 1, pageSize: 25 });
    cc.getTransferLock.mockResolvedValue({ locked: false, reason: null, lockedAt: null });
    cc.getLedger.mockResolvedValue({ items: [], totalCount: 0, pageNumber: 1, pageSize: 25 });
});

describe('status strip (#119)', () => {
    it('shows online, mode, frozen, payments locked, premium and the flags, with since/by/why while frozen', async () => {
        um.getProfileSummary.mockResolvedValue(withFreeze(true, 'Griefing spawn', { isActive: false, admitted: false, emailVerified: false }));
        cc.getTransferLock.mockResolvedValue({ locked: true, reason: 'Duping', lockedAt: '2026-11-07T10:00:00' });
        renderProfile();

        const strip = await screen.findByRole('list', { name: 'Player status' });
        await waitFor(() => expect(within(strip).getByTestId('status-frozen')).toBeInTheDocument());
        expect(within(strip).getByTestId('profile-presence')).toHaveTextContent('Online');
        expect(within(strip).getByText('Staff mode')).toBeInTheDocument();
        expect(within(strip).getByTestId('status-payments-locked')).toHaveAttribute('title', 'Duping');
        expect(within(strip).getByTestId('status-premium')).toHaveTextContent('Knight+');
        expect(within(strip).getByText('Deactivated')).toBeInTheDocument();
        expect(within(strip).getByText('Not admitted')).toBeInTheDocument();
        expect(within(strip).getByText('Email not verified')).toBeInTheDocument();

        const banner = await screen.findByTestId('frozen-banner');
        await waitFor(() => expect(banner).toHaveTextContent('by Mod'));
        expect(banner).toHaveTextContent('since');
        expect(banner).toHaveTextContent('Reason: Griefing spawn');
        // #565: since when and by whom come with the summary: no audit lookup per profile load.
        expect(um.getAuditLog).not.toHaveBeenCalledWith(expect.objectContaining({ action: 'PlayerFrozen' }));
    });

    it('shows the frozen state of an older API (no frozenAt) without since and by', async () => {
        um.getProfileSummary.mockResolvedValue(fullSummary({ account: { ...fullSummary().account, isFrozen: true, frozenReason: 'Old' } }));
        renderProfile();
        const banner = await screen.findByTestId('frozen-banner');
        expect(banner).toHaveTextContent('Reason: Old');
        expect(banner).not.toHaveTextContent('since');
    });

    it('says when there is no Minecraft account and shows no presence badge then', async () => {
        um.getProfileSummary.mockResolvedValue(fullSummary({ account: { ...fullSummary().account, uuid: null } }));
        renderProfile();
        expect(await screen.findByText('No Minecraft account')).toBeInTheDocument();
        expect(screen.queryByTestId('profile-presence')).not.toBeInTheDocument();
    });
});

describe('freeze and unfreeze (#119)', () => {
    it('freezes with a required reason in the confirm, then shows the new state', async () => {
        const success = jest.spyOn(toast, 'success');
        renderProfile();
        fireEvent.click(await screen.findByTestId('freeze-button'));

        const dialog = await screen.findByRole('alertdialog', { name: 'Freeze Steve?' });
        fireEvent.click(within(dialog).getByRole('button', { name: 'Freeze' }));
        expect(within(dialog).getByRole('alert')).toHaveTextContent('Enter a reason.');
        expect(um.freeze).not.toHaveBeenCalled();

        um.getProfileSummary.mockResolvedValue(withFreeze(true, 'Griefing spawn'));
        fireEvent.change(within(dialog).getByLabelText(/Reason/), { target: { value: '  Griefing spawn ' } });
        await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Freeze' })); });

        expect(um.freeze).toHaveBeenCalledWith(3, 'Griefing spawn');
        expect(await screen.findByTestId('status-frozen')).toBeInTheDocument();
        expect(success).toHaveBeenCalledWith('Steve is frozen');
        expect(await screen.findByTestId('unfreeze-button')).toBeInTheDocument();
    });

    it('unfreezes with an optional reason (#565), sent to the API', async () => {
        um.getProfileSummary.mockResolvedValue(withFreeze(true, 'x'));
        renderProfile();
        fireEvent.click(await screen.findByTestId('unfreeze-button'));
        const dialog = await screen.findByRole('alertdialog', { name: 'Unfreeze Steve?' });
        fireEvent.change(within(dialog).getByLabelText(/Reason/), { target: { value: ' Appeal accepted ' } });
        um.getProfileSummary.mockResolvedValue(withFreeze(false));
        await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Unfreeze' })); });
        expect(um.unfreeze).toHaveBeenCalledWith(3, 'Appeal accepted');
        expect(await screen.findByTestId('freeze-button')).toBeInTheDocument();
    });

    it('unfreezes without a reason when none is given', async () => {
        um.getProfileSummary.mockResolvedValue(withFreeze(true, 'x'));
        renderProfile();
        fireEvent.click(await screen.findByTestId('unfreeze-button'));
        const dialog = await screen.findByRole('alertdialog', { name: 'Unfreeze Steve?' });
        await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Unfreeze' })); });
        expect(um.unfreeze).toHaveBeenCalledWith(3, undefined);
    });

    it('shows the API refusal and keeps the state when the freeze fails', async () => {
        const error = jest.spyOn(toast, 'error');
        jest.spyOn(console, 'error').mockImplementation(() => undefined);
        um.freeze.mockRejectedValue({ response: { status: 403, data: { message: 'Requires the knk.freeze permission.' } } });
        renderProfile();
        fireEvent.click(await screen.findByTestId('freeze-button'));
        const dialog = await screen.findByRole('alertdialog');
        fireEvent.change(within(dialog).getByLabelText(/Reason/), { target: { value: 'Spam' } });
        await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Freeze' })); });
        expect(error).toHaveBeenCalledWith(expect.stringMatching(/^Could not freeze Steve: /), {});
        expect(screen.getByTestId('freeze-button')).toBeInTheDocument();
    });

    it('disables Freeze with "Requires knk.freeze" without the node, and the other actions likewise', async () => {
        mockHeld = new Set();
        renderProfile();
        const button = await screen.findByTestId('freeze-button');
        expect(button).toBeDisabled();
        expect(button).toHaveAccessibleDescription('Requires knk.freeze');
        expect(screen.getByTestId('kick-button')).toBeDisabled();
        expect(screen.getByTestId('kick-button')).toHaveAccessibleDescription('Requires knk.kick');
        expect(screen.getByTestId('ban-button')).toBeDisabled();
        expect(screen.getByTestId('ban-button')).toHaveAccessibleDescription('Requires knk.ban');

        fireEvent.click(screen.getByRole('tab', { name: 'Permissions' }));
        expect(screen.getByRole('button', { name: /Assign/ })).toBeDisabled();
        expect(screen.getByText('Requires knk.admin.user.group')).toBeInTheDocument();
        expect(screen.getByText('Requires knk.admin.user.perm')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Remove group Builder' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Remove direct grant of knk.gate.open' })).toBeDisabled();

        fireEvent.click(screen.getByRole('tab', { name: 'Economy' }));
        expect(await screen.findByText('Requires knk.admin.currency.lock')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Lock payments' })).toBeDisabled();
        expect(screen.getByText('Requires knk.kit.give')).toBeInTheDocument();
    });
});

describe('tabs (#119)', () => {
    it('opens Overview first, keeps the tab in the URL and moves with the arrow keys', async () => {
        renderProfile();
        expect(await screen.findByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByRole('tabpanel')).toHaveAccessibleName('Overview');
        expect(screen.getByText('Title & Experience')).toBeInTheDocument();
        expect(screen.queryByText('Salary')).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('tab', { name: 'Economy' }));
        expect(screen.getByText('Salary')).toBeInTheDocument();
        expect(lastSearch).toBe('?tab=economy');

        fireEvent.keyDown(screen.getByRole('tab', { name: 'Economy' }), { key: 'ArrowRight' });
        expect(screen.getByRole('tab', { name: 'Permissions' })).toHaveFocus();
        expect(screen.getByText('Groups (1 active)')).toBeInTheDocument();
        fireEvent.keyDown(screen.getByRole('tab', { name: 'Permissions' }), { key: 'End' });
        expect(screen.getByText('Private messages')).toBeInTheDocument();
        fireEvent.keyDown(screen.getByRole('tab', { name: 'Privacy' }), { key: 'ArrowRight' });
        expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
        expect(lastSearch).toBe('');
    });

    it('opens the tab named in the URL; Moderation holds freeze, mode, access and Kick / Ban (#565)', async () => {
        renderProfile('/admin/users/3?tab=moderation');
        expect(await screen.findByTestId('freeze-card')).toHaveTextContent('Not frozen');
        expect(screen.getByRole('group', { name: 'Mode' })).toBeInTheDocument();
        expect(screen.getByText('Access card')).toBeInTheDocument();
        const card = screen.getByTestId('kickban-card');
        expect(card).toHaveTextContent('/pardon');
        expect(within(card).getByRole('button', { name: 'Kick…' })).toBeEnabled();
        expect(within(card).getByRole('button', { name: 'Ban…' })).toBeEnabled();
        expect(screen.queryByText(/The web app can.t send them yet/)).not.toBeInTheDocument();
    });

    it('does not crash on a thin summary and shows every tab', async () => {
        um.getProfileSummary.mockResolvedValue({ account: { id: 3, username: 'Thin' } });
        renderProfile();
        expect(await screen.findByRole('heading', { name: 'Thin' })).toBeInTheDocument();
        for (const name of ['Economy', 'Permissions', 'Moderation', 'Activity', 'Privacy', 'Overview']) {
            fireEvent.click(screen.getByRole('tab', { name }));
            expect(screen.getByRole('tabpanel')).toHaveAccessibleName(name);
        }
        fireEvent.click(screen.getByRole('tab', { name: 'Economy' }));
        expect(screen.getByText('0.00 coins/hr')).toBeInTheDocument();
    });

    it('offers a way back when the profile cannot be read', async () => {
        jest.spyOn(console, 'error').mockImplementation(() => undefined);
        um.getProfileSummary.mockRejectedValue(new Error('404'));
        renderProfile();
        expect(await screen.findByRole('link', { name: 'Back to Player moderation' })).toHaveAttribute('href', '/admin/users');
    });
});

describe('live updates (#119 with #183)', () => {
    it('reads the profile and the frozen state again when someone else changes the user', async () => {
        const hub = fakeRealtime({ userId: 1 });
        renderProfile('/admin/users/3', hub);
        await screen.findByTestId('freeze-button');
        expect(um.getProfileSummary).toHaveBeenCalledTimes(1);

        um.getProfileSummary.mockResolvedValue(withFreeze(true, 'In game'));
        act(() => hub.emit('EntityChanged', { type: 'User', id: 3, op: 'Updated', actorUserId: 7, actorName: 'Other' }));
        expect(await screen.findByTestId('status-frozen', {}, { timeout: 2000 })).toBeInTheDocument();
        expect(um.getProfileSummary).toHaveBeenCalledTimes(2);

        // Another player's change is not this profile's.
        act(() => hub.emit('EntityChanged', { type: 'User', id: 4, op: 'Updated', actorUserId: 7, actorName: 'Other' }));
        await new Promise(resolve => setTimeout(resolve, 900));
        expect(um.getProfileSummary).toHaveBeenCalledTimes(2);
    });
});

describe('Activity: timeline and paged audit log (#119)', () => {
    const entry = (id: number, timestamp: string, action = 'GroupAssigned', details: string | null = null) =>
        ({ id, timestamp, action, targetUserId: 3, actorUsername: 'Mod', details });

    it('merges the audit log, the game sessions and the balance history newest first, with filter chips', async () => {
        um.getAuditLog.mockImplementation((q: { action?: string; pageNumber?: number }) => Promise.resolve(q.action
            ? { items: [], totalCount: 0 }
            : { items: [entry(2, '2026-11-08T12:00:00', 'PlayerFrozen', '{"reason":"Spam"}'), entry(1, '2026-11-08T09:00:00')], totalCount: 2 }));
        cc.getLedger.mockResolvedValue({ items: [{ entryId: 5, transactionId: 5, publicId: 'tx5', createdAt: '2026-11-08T10:00:00', userId: 3,
            currency: 'Coins', operation: 'Add', amount: 500, balanceBefore: 0, balanceAfter: 500, kind: 'AdminGrant', reasonCode: '', reason: 'Lost items',
            initiator: 'Admin', initiatorUsername: 'Mod' }], totalCount: 1 });
        mockGetSessions.mockResolvedValue({ items: [{ sessionKey: 's1', startedAt: '2026-11-08T11:00:00', endedAt: '2026-11-08T11:45:00',
            endReason: 'Kick', serverId: 'survival', activeSeconds: 2400 }], totalCount: 1, pageNumber: 1, pageSize: 25 });
        renderProfile('/admin/users/3?tab=activity');

        const timeline = await screen.findByTestId('timeline');
        await waitFor(() => expect(within(timeline).getAllByTestId('timeline-event')).toHaveLength(4));
        expect(within(timeline).getAllByTestId('timeline-event').map(li => li.querySelector('p')?.textContent))
            .toEqual(['Player frozen', 'Played on survival', '+500 coins', 'Group assigned']);
        expect(cc.getLedger).toHaveBeenCalledWith({ userId: 3, sort: 'createdAt', dir: 'desc', page: 1, pageSize: 25 });
        expect(mockGetSessions).toHaveBeenCalledWith(3, 1, 25);
        expect(within(timeline).getAllByTestId('timeline-event')[1]).toHaveTextContent('Active 40 min');
        expect(within(timeline).getAllByTestId('timeline-event')[1]).toHaveTextContent('Kicked');
        expect(screen.getByTestId('timeline-sources')).toHaveTextContent('From the audit log, the game sessions and the balance history.');

        fireEvent.click(screen.getByRole('button', { name: 'Moderation', pressed: true }));
        expect(within(screen.getByTestId('timeline')).getAllByTestId('timeline-event')).toHaveLength(3);
        fireEvent.click(screen.getByRole('button', { name: 'Game sessions', pressed: true }));
        expect(within(screen.getByTestId('timeline')).getAllByTestId('timeline-event')).toHaveLength(2);
        expect(screen.getByRole('button', { name: 'Moderation', pressed: false })).toBeInTheDocument();
    });

    it('leaves the balance history out without knk.admin.currency.history and says so', async () => {
        mockHeld.delete('knk.admin.currency.history');
        renderProfile('/admin/users/3?tab=activity');
        expect(await screen.findByTestId('timeline-sources')).toHaveTextContent('Balance changes need knk.admin.currency.history.');
        expect(await screen.findByText('Nothing recorded for this player yet.')).toBeInTheDocument();
        expect(cc.getLedger).not.toHaveBeenCalled();
    });

    it('pages the audit log on the server and filters it by action', async () => {
        um.getAuditLog.mockImplementation((q: { pageNumber?: number }) => Promise.resolve({
            items: [entry(100 + (q.pageNumber ?? 1), '2026-11-08T09:00:00', 'KitGranted', '{"kitName":"Starter"}')], totalCount: 60,
        }));
        renderProfile('/admin/users/3?tab=activity');
        const pager = await screen.findByRole('navigation', { name: 'Audit log pages' });
        expect(pager).toHaveTextContent('Page 1 of 3');
        expect(screen.getByRole('table', { name: 'Audit log about this player' })).toHaveTextContent('Kit: Starter');

        fireEvent.click(within(pager).getByRole('button', { name: /Next/ }));
        await waitFor(() => expect(um.getAuditLog).toHaveBeenCalledWith({ targetUserId: 3, action: undefined, pageNumber: 2, pageSize: 25 }));

        fireEvent.change(screen.getByLabelText('Action'), { target: { value: 'PlayerFrozen' } });
        await waitFor(() => expect(um.getAuditLog).toHaveBeenCalledWith({ targetUserId: 3, action: 'PlayerFrozen', pageNumber: 1, pageSize: 25 }));
    });
});

describe('kick and ban (#565)', () => {
    it('kicks with an optional reason and a toast', async () => {
        const success = jest.spyOn(toast, 'success');
        renderProfile();
        fireEvent.click(await screen.findByTestId('kick-button'));
        const dialog = await screen.findByRole('alertdialog', { name: 'Kick Steve?' });
        fireEvent.change(within(dialog).getByLabelText(/Reason/), { target: { value: ' AFK farming ' } });
        await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Kick' })); });
        expect(um.kick).toHaveBeenCalledWith(3, 'AFK farming');
        expect(success).toHaveBeenCalledWith('Steve is being kicked');
    });

    it('kicks without a reason when none is given', async () => {
        renderProfile();
        fireEvent.click(await screen.findByTestId('kick-button'));
        const dialog = await screen.findByRole('alertdialog', { name: 'Kick Steve?' });
        await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Kick' })); });
        expect(um.kick).toHaveBeenCalledWith(3, undefined);
    });

    it('bans only with a reason, says it is permanent and lifted with /pardon', async () => {
        const success = jest.spyOn(toast, 'success');
        renderProfile();
        fireEvent.click(await screen.findByTestId('ban-button'));
        const dialog = await screen.findByRole('alertdialog', { name: 'Ban Steve permanently?' });
        expect(dialog).toHaveTextContent('permanent');
        expect(dialog).toHaveTextContent('/pardon in game');
        fireEvent.click(within(dialog).getByRole('button', { name: 'Ban permanently' }));
        expect(within(dialog).getByRole('alert')).toHaveTextContent('Enter a reason.');
        expect(um.ban).not.toHaveBeenCalled();

        fireEvent.change(within(dialog).getByLabelText(/Reason/), { target: { value: 'X-ray' } });
        await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Ban permanently' })); });
        expect(um.ban).toHaveBeenCalledWith(3, 'X-ray');
        expect(success).toHaveBeenCalledWith('Steve is banned');
    });

    it('shows the API refusal in a toast (no game server connected)', async () => {
        const error = jest.spyOn(toast, 'error');
        jest.spyOn(console, 'error').mockImplementation(() => undefined);
        um.kick.mockRejectedValue({ status: 503, response: { error: 'NoGameServerConnected', message: 'No game server is connected.' } });
        renderProfile();
        fireEvent.click(await screen.findByTestId('kick-button'));
        const dialog = await screen.findByRole('alertdialog', { name: 'Kick Steve?' });
        await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Kick' })); });
        expect(error).toHaveBeenCalledWith('Could not kick Steve: No game server is connected.', {});
    });

    it('offers no Kick or Ban for an account without Minecraft', async () => {
        um.getProfileSummary.mockResolvedValue(fullSummary({ account: { ...fullSummary().account, uuid: null } }));
        renderProfile('/admin/users/3?tab=moderation');
        expect(await screen.findByText(/nothing to kick or ban in game/)).toBeInTheDocument();
        expect(screen.queryByTestId('kick-button')).not.toBeInTheDocument();
        expect(screen.queryByTestId('ban-button')).not.toBeInTheDocument();
    });
});
