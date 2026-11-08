import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { UserModerationPage } from '../UserModerationPage';
import { userClient } from '../../../apiClients/userClient';
import { userManagementClient } from '../../../apiClients/userManagementClient';
import { permissionGroupClient } from '../../../apiClients/permissionGroupClient';
import { applyPresence } from '../UserModerationPage';
import { fakeRealtime } from '../../../test-utils/fakeRealtime';

// PandiO/knk-workspace#183 (Realtime S4): the Online/Offline badges follow PresenceChanged while the web hub is
// connected. Router and clients mocked as in UserModerationPage.urlState.test.tsx.
let mockInitialSearch = '';
const mockSetSearchParams = jest.fn();
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => {
    const { useState } = jest.requireActual('react');
    return {
        Link: ({ to, children, onClick, ...rest }: { to: string; children: React.ReactNode; onClick?: (event: unknown) => void }) => (
            <a href={to} onClick={(event) => { onClick?.(event); event.preventDefault(); }} {...rest}>{children}</a>
        ),
        useNavigate: () => mockNavigate,
        useSearchParams: () => {
            const [params, setParams] = useState(() => new URLSearchParams(mockInitialSearch));
            const set = (update: (previous: URLSearchParams) => URLSearchParams, options?: unknown) => {
                mockSetSearchParams(update, options);
                setParams((previous: URLSearchParams) => update(previous));
            };
            return [params, set];
        },
    };
}, { virtual: true });

jest.mock('../../../apiClients/userClient', () => ({
    userClient: { searchPaged: jest.fn() },
}));
jest.mock('../../../apiClients/permissionGroupClient', () => ({
    permissionGroupClient: { getAll: jest.fn(), getExpiringMemberships: jest.fn() },
}));
jest.mock('../../../apiClients/userManagementClient', () => ({
    userManagementClient: { searchByGroup: jest.fn(), getAuditLog: jest.fn() },
}));
jest.mock('../../../hooks/useStaffAccess', () => ({
    usePermission: () => ({ allowed: false, loading: false }),
}));

const searchPaged = userClient.searchPaged as jest.Mock;
const searchByGroup = userManagementClient.searchByGroup as jest.Mock;

const player = (id: number, username: string, isOnline: boolean) =>
    ({ id, username, email: null, isOnline, lastSeenAt: null, coins: 0, gems: 0, experiencePoints: 0, isActive: true });

const statusOf = (name: string) => {
    const row = screen.getByRole('link', { name }).closest('tr')!;
    return within(row).getByText(/^(Online|Offline)$/).textContent;
};

describe('applyPresence', () => {
    it("changes only that player's rows, and leaves the list alone otherwise", () => {
        const rows = [player(1, 'A', false), player(2, 'B', false)];
        const next = applyPresence(rows, { userId: 2, online: true, lastSeenAt: '2026-11-05T20:00:00Z' })!;
        expect(next.map(r => r.isOnline)).toEqual([false, true]);
        expect(next[1].lastSeenAt).toBe('2026-11-05T20:00:00Z');
        expect(next[0]).toBe(rows[0]);
        expect(applyPresence(rows, { userId: 9, online: true })).toBe(rows);
        expect(applyPresence(rows, { userId: null })).toBe(rows);
        expect(applyPresence(null, { userId: 1, online: true })).toBeNull();
    });
});

describe('UserModerationPage live presence (#183)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockInitialSearch = '';
        (permissionGroupClient.getAll as jest.Mock).mockResolvedValue([{ id: 3, name: 'Builders', isPremiumTier: false }]);
        searchPaged.mockResolvedValue({ items: [player(12, 'Pandi', false), player(13, 'Cinix', true)], totalCount: 2 });
    });

    it("turns a player's badge Online and Offline in place", async () => {
        const hub = fakeRealtime({ userId: 1 });
        render(<hub.Provider><UserModerationPage /></hub.Provider>);
        await screen.findByRole('link', { name: 'Pandi' });
        expect(statusOf('Pandi')).toBe('Offline');

        act(() => hub.emit('PresenceChanged', { userId: 12, online: true, serverId: 'survival' }));
        expect(statusOf('Pandi')).toBe('Online');
        expect(statusOf('Cinix')).toBe('Online');

        act(() => hub.emit('PresenceChanged', { userId: 13, online: false, lastSeenAt: '2026-11-05T20:00:00Z' }));
        expect(statusOf('Cinix')).toBe('Offline');
        expect(searchPaged).toHaveBeenCalledTimes(1); // no re-read for one player
    });

    it('re-reads the shown page quietly after many changes or a reconnect, with the search it ran', async () => {
        const hub = fakeRealtime();
        render(<hub.Provider><UserModerationPage /></hub.Provider>);
        await screen.findByRole('link', { name: 'Pandi' });
        fireEvent.change(screen.getByRole('textbox', { name: 'Search username / email / UUID' }), { target: { value: 'typed, not searched' } });

        searchPaged.mockResolvedValue({ items: [player(12, 'Pandi', true)], totalCount: 1 });
        act(() => hub.reconnect());

        await waitFor(() => expect(searchPaged).toHaveBeenCalledTimes(2));
        expect(searchPaged).toHaveBeenLastCalledWith(expect.objectContaining({ pageNumber: 1, searchTerm: undefined }));
        expect(screen.getByRole('link', { name: 'Pandi' })).toBeInTheDocument(); // no spinner in between
        await waitFor(() => expect(statusOf('Pandi')).toBe('Online'));
    });

    it('updates the group list too, re-reading it with the filter it was run with', async () => {
        const hub = fakeRealtime();
        mockInitialSearch = 'tab=group';
        searchByGroup.mockResolvedValue([player(20, 'Builder', false)]);
        render(<hub.Provider><UserModerationPage /></hub.Provider>);

        const select = await screen.findByRole('combobox', { name: 'Permission group' });
        await waitFor(() => expect(within(select).getByRole('option', { name: 'Builders' })).toBeInTheDocument());
        fireEvent.change(select, { target: { value: '3' } });
        fireEvent.click(screen.getByRole('button', { name: /^Search/ }));
        await screen.findByRole('link', { name: 'Builder' });

        act(() => hub.emit('PresenceChanged', { userId: 20, online: true }));
        expect(statusOf('Builder')).toBe('Online');

        fireEvent.click(screen.getByRole('checkbox', { name: 'Currently online only' }));
        act(() => hub.emit('PresenceChanged', { userId: null }));
        await waitFor(() => expect(searchByGroup).toHaveBeenCalledTimes(2));
        expect(searchByGroup).toHaveBeenLastCalledWith(3, undefined);
    });
});
