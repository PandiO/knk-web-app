import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { UserModerationPage } from '../UserModerationPage';
import { userClient } from '../../../apiClients/userClient';
import { permissionGroupClient } from '../../../apiClients/permissionGroupClient';
import { rememberRecentPlayer } from '../../../utils/recentPlayers';

// PandiO/knk-workspace#119 (MOD-5): player search by name, email or UUID (also without dashes), sort, the search
// in the URL, and the recently opened players.
let mockInitialSearch = '';
const mockSetSearchParams = jest.fn();
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => {
    const { useState } = jest.requireActual('react');
    return {
        Link: ({ to, children, ...rest }: { to: string; children: React.ReactNode }) => <a href={to} {...rest}>{children}</a>,
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
jest.mock('../../../contexts/AuthContext', () => ({
    useAuth: () => ({ user: { id: 1, username: 'Staff' } }),
}));
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
const lastQuery = () => searchPaged.mock.calls[searchPaged.mock.calls.length - 1][0];
/** The URL after every setSearchParams so far, from an empty start. */
const urlNow = () => mockSetSearchParams.mock.calls.reduce((params, [update]) => update(params), new URLSearchParams(mockInitialSearch)).toString();

describe('UserModerationPage search (#119)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        window.localStorage.clear();
        mockInitialSearch = '';
        (permissionGroupClient.getAll as jest.Mock).mockResolvedValue([]);
        searchPaged.mockResolvedValue({
            items: [{ id: 12, username: 'Pandi', email: 'p@example.org', isOnline: false, lastSeenAt: '2026-11-08T09:00:00', coins: 5, experiencePoints: 1 }],
            totalCount: 41,
        });
    });

    it('sends a dashless UUID with its dashes and writes the term to the URL', async () => {
        render(<UserModerationPage />);
        await screen.findByRole('link', { name: 'Pandi' });
        expect(mockSetSearchParams).not.toHaveBeenCalled();

        const box = screen.getByLabelText('Search username / email / UUID');
        fireEvent.change(box, { target: { value: ' 069A79F444E94726A5BEFCA90E38AAF5 ' } });
        expect(screen.getByText('Searching by UUID.')).toBeInTheDocument();
        fireEvent.keyDown(box, { key: 'Enter' });
        expect(lastQuery()).toEqual(expect.objectContaining({ pageNumber: 1, searchTerm: '069a79f4-44e9-4726-a5be-fca90e38aaf5' }));
        expect(urlNow()).toBe('q=069A79F444E94726A5BEFCA90E38AAF5');
        expect(mockSetSearchParams.mock.calls[0][1]).toEqual({ replace: true });
    });

    it('sorts on the server by username, email or coins and keeps the sort while paging', async () => {
        render(<UserModerationPage />);
        await screen.findByRole('link', { name: 'Pandi' });
        const table = screen.getByRole('table', { name: 'All players' });

        fireEvent.click(within(table).getByRole('button', { name: /Coins/ }));
        await waitFor(() => expect(lastQuery()).toEqual(expect.objectContaining({ sortBy: 'coins', sortDescending: false, pageNumber: 1 })));
        await waitFor(() => expect(within(table).getByRole('columnheader', { name: /Coins/ })).toHaveAttribute('aria-sort', 'ascending'));
        fireEvent.click(within(table).getByRole('button', { name: /Coins/ }));
        await waitFor(() => expect(lastQuery()).toEqual(expect.objectContaining({ sortBy: 'coins', sortDescending: true })));
        expect(urlNow()).toBe('sort=coins&dir=desc');
        await waitFor(() => expect(within(table).getByRole('columnheader', { name: /Coins/ })).toHaveAttribute('aria-sort', 'descending'));

        fireEvent.click(screen.getByRole('button', { name: /Next/ }));
        await waitFor(() => expect(lastQuery()).toEqual(expect.objectContaining({ sortBy: 'coins', sortDescending: true, pageNumber: 2 })));
        expect(urlNow()).toBe('sort=coins&dir=desc&page=2');
        // XP and status are not sortable on the server.
        expect(within(table).queryByRole('button', { name: /XP/ })).not.toBeInTheDocument();
        expect(within(table).getByRole('columnheader', { name: 'Last seen' })).toBeInTheDocument();
    });

    it('starts from the search in the URL (Back from a profile)', async () => {
        mockInitialSearch = '?q=Pan&page=2&sort=email&dir=desc';
        render(<UserModerationPage />);
        await screen.findByRole('link', { name: 'Pandi' });
        expect(searchPaged).toHaveBeenCalledTimes(1);
        expect(lastQuery()).toEqual(expect.objectContaining({ searchTerm: 'Pan', pageNumber: 2, sortBy: 'email', sortDescending: true }));
        expect(screen.getByLabelText('Search username / email / UUID')).toHaveValue('Pan');
        expect(screen.getByRole('navigation', { name: 'All players pages' })).toHaveTextContent('Page 2 of 3');
    });

    it('lists the recently opened profiles of this viewer as links, and clears them', async () => {
        rememberRecentPlayer(1, { id: 7, username: 'Alex' });
        rememberRecentPlayer(1, { id: 8, username: 'Steve' });
        rememberRecentPlayer(2, { id: 9, username: 'OtherViewers' });
        render(<UserModerationPage />);
        const recent = await screen.findByRole('list', { name: 'Recently opened players' });
        expect(within(recent).getAllByRole('link').map(a => [a.textContent, a.getAttribute('href')]))
            .toEqual([['Steve', '/admin/users/8'], ['Alex', '/admin/users/7']]);

        fireEvent.click(within(screen.getByTestId('recent-players')).getByRole('button', { name: 'Clear' }));
        expect(screen.queryByTestId('recent-players')).not.toBeInTheDocument();
        expect(window.localStorage.getItem('knk.recentPlayers.1')).toBeNull();
    });
});
