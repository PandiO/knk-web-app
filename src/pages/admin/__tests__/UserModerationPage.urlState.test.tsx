import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { UserModerationPage } from '../UserModerationPage';
import { userClient } from '../../../apiClients/userClient';
import { userManagementClient } from '../../../apiClients/userManagementClient';
import { permissionGroupClient } from '../../../apiClients/permissionGroupClient';

// PandiO/knk-workspace#39: the moderation page's tab is in the URL and player names are links.
// useSearchParams keeps the query in component state, starting from mockInitialSearch.
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
const getAuditLog = userManagementClient.getAuditLog as jest.Mock;

describe('UserModerationPage URL state (#39)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockInitialSearch = '';
        (permissionGroupClient.getAll as jest.Mock).mockResolvedValue([]);
        searchPaged.mockResolvedValue({ items: [{ id: 12, username: 'Pandi', email: null, isOnline: false, coins: 0, experiencePoints: 0 }], totalCount: 1 });
        getAuditLog.mockResolvedValue({
            items: [{ id: 1, targetUserId: 30, targetUsername: 'Demoted', action: 'TitleChanged', createdAt: '2026-10-30T10:00:00Z' }],
            totalCount: 1,
        });
    });

    it('lists every player with the name as a link to the profile; the row still opens it', async () => {
        render(<UserModerationPage />);
        const link = await screen.findByRole('link', { name: 'Pandi' });
        expect(link).toHaveAttribute('href', '/admin/users/12');

        // #187 (DataTable): a plain click on the link opens the profile in the app, once (not again for the row).
        fireEvent.click(link);
        expect(mockNavigate).toHaveBeenCalledTimes(1);
        expect(mockNavigate).toHaveBeenCalledWith('/admin/users/12');

        // Ctrl-click is the browser's (a new tab), not the app's.
        mockNavigate.mockClear();
        fireEvent.click(link, { ctrlKey: true });
        expect(mockNavigate).not.toHaveBeenCalled();

        // A click elsewhere on the row opens it too.
        fireEvent.click(within(screen.getByRole('table', { name: 'All players' })).getByText('Offline'));
        expect(mockNavigate).toHaveBeenCalledWith('/admin/users/12');
    });

    it('opens the tab named in the URL', async () => {
        mockInitialSearch = '?tab=demoted';
        render(<UserModerationPage />);
        const link = await screen.findByRole('link', { name: 'Demoted' });
        expect(link).toHaveAttribute('href', '/admin/users/30');
        expect(searchPaged).not.toHaveBeenCalled();
    });

    it('writes a picked tab to the URL, replacing the entry, and leaves the default tab out', async () => {
        render(<UserModerationPage />);
        await screen.findByRole('link', { name: 'Pandi' });

        fireEvent.click(screen.getByRole('button', { name: /Recently demoted/ }));
        expect(await screen.findByRole('link', { name: 'Demoted' })).toBeInTheDocument();
        const [update, options] = mockSetSearchParams.mock.calls[0];
        expect(options).toEqual({ replace: true });
        expect(update(new URLSearchParams()).toString()).toBe('tab=demoted');

        fireEvent.click(screen.getByRole('button', { name: /All players/ }));
        const [toDefault] = mockSetSearchParams.mock.calls[1];
        expect(toDefault(new URLSearchParams('tab=demoted')).toString()).toBe('');
    });
});

describe('UserModerationPage on DataTable/Pager (#187)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockInitialSearch = '';
        (permissionGroupClient.getAll as jest.Mock).mockResolvedValue([]);
    });

    it('formats coins and XP, labels the search box and pages with the Pager', async () => {
        searchPaged.mockResolvedValue({
            items: [{ id: 12, username: 'Pandi', email: 'p@example.org', isOnline: true, coins: 1234567, experiencePoints: 2500 }],
            totalCount: 45,
        });
        render(<UserModerationPage />);
        await screen.findByRole('link', { name: 'Pandi' });
        expect(screen.getByRole('table', { name: 'All players' })).toBeInTheDocument();
        expect(screen.getByText('1,234,567')).toBeInTheDocument();
        expect(screen.getByText('2,500')).toBeInTheDocument();
        expect(screen.getByLabelText('Search username / email / UUID')).toHaveAttribute('placeholder', 'Leave blank to list everyone');

        const pager = screen.getByRole('navigation', { name: 'All players pages' });
        expect(pager).toHaveTextContent('Page 1 of 3');
        expect(pager).toHaveTextContent('Showing 1 to 20 of 45 players');
        fireEvent.click(screen.getByRole('button', { name: /Next/ }));
        expect(searchPaged).toHaveBeenLastCalledWith(expect.objectContaining({ pageNumber: 2 }));
    });

    it('shows when a demotion happened as a local date and time (the API sends UTC without a zone)', async () => {
        mockInitialSearch = '?tab=demoted';
        getAuditLog.mockResolvedValue({
            items: [{ id: 1, targetUserId: 30, targetUsername: 'Demoted', action: 'TitleChanged', timestamp: '2026-10-30T10:00:00', details: 'Knight -> Squire' }],
            totalCount: 1,
        });
        render(<UserModerationPage />);
        await screen.findByRole('link', { name: 'Demoted' });
        const { formatDateTime } = jest.requireActual('../../../utils/format');
        expect(screen.getByText(formatDateTime(new Date('2026-10-30T10:00:00Z')))).toBeInTheDocument();
        expect(screen.getByText('Knight -> Squire')).toBeInTheDocument();
    });
});

describe('UserModerationPage state filters, sort keys and list fields (#565)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockInitialSearch = '';
        (permissionGroupClient.getAll as jest.Mock).mockResolvedValue([]);
        searchPaged.mockResolvedValue({
            items: [{ id: 12, username: 'Pandi', email: null, isOnline: false, coins: 0, experiencePoints: 0, isFrozen: true,
                paymentsLocked: true, createdAt: '2026-09-01T10:00:00' }],
            totalCount: 1,
        });
    });

    it('sends the filters from the URL and shows frozen / payments locked on the row', async () => {
        mockInitialSearch = '?frozen=true&online=false';
        render(<UserModerationPage />);
        await screen.findByRole('link', { name: 'Pandi' });
        expect(searchPaged).toHaveBeenCalledWith(expect.objectContaining({ filters: { online: 'false', frozen: 'true' } }));
        expect(screen.getByLabelText('Frozen')).toHaveValue('true');
        expect(screen.getByLabelText('Online')).toHaveValue('false');
        const table = screen.getByRole('table', { name: 'All players' });
        expect(table).toHaveTextContent('Frozen');
        expect(table).toHaveTextContent('Payments locked');
        expect(screen.getByRole('columnheader', { name: /Created/ })).toBeInTheDocument();
    });

    it('a changed filter searches from page 1 and goes into the URL; "Any" removes it', async () => {
        render(<UserModerationPage />);
        await screen.findByRole('link', { name: 'Pandi' });
        fireEvent.change(screen.getByLabelText('Payments'), { target: { value: 'true' } });
        expect(searchPaged).toHaveBeenLastCalledWith(expect.objectContaining({ pageNumber: 1, filters: { paymentsLocked: 'true' } }));
        const [update] = mockSetSearchParams.mock.calls[mockSetSearchParams.mock.calls.length - 1];
        expect(update(new URLSearchParams('')).get('paymentsLocked')).toBe('true');

        fireEvent.change(screen.getByLabelText('Payments'), { target: { value: '' } });
        expect(searchPaged.mock.calls[searchPaged.mock.calls.length - 1][0].filters).toBeUndefined();
    });

    it('sorts by last seen and XP with the API sort keys', async () => {
        render(<UserModerationPage />);
        await screen.findByRole('link', { name: 'Pandi' });
        fireEvent.click(screen.getByRole('button', { name: /Last seen/ }));
        expect(searchPaged).toHaveBeenLastCalledWith(expect.objectContaining({ sortBy: 'lastseenat' }));
        fireEvent.click(screen.getByRole('button', { name: /XP/ }));
        expect(searchPaged).toHaveBeenLastCalledWith(expect.objectContaining({ sortBy: 'experiencepoints' }));
    });
});

