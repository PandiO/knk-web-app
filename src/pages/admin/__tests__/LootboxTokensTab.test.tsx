import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { LootboxTokensTab } from '../../../components/lootbox/LootboxTokensTab';
import { claimSourceLabel } from '../../../components/lootbox/LootboxDropLogTab';
import { lootboxTokenClient } from '../../../apiClients/lootboxTokenClient';
import { lootboxTypeClient } from '../../../apiClients/lootboxTypeClient';
import { permissionGroupClient } from '../../../apiClients/permissionGroupClient';
import { KitClient } from '../../../apiClients/kitClient';
import { LootboxClaimLogDto, LootboxTokenDto } from '../../../types/dtos/lootbox/LootboxDtos';

// virtual: CRA's Jest resolver can't resolve react-router-dom's package exports
jest.mock('react-router-dom', () => ({
    Link: ({ to, children, ...rest }: { to: string; children: React.ReactNode }) => <a href={to} {...rest}>{children}</a>,
}), { virtual: true });
jest.mock('../../../apiClients/lootboxTokenClient', () => ({
    lootboxTokenClient: { search: jest.fn(), revoke: jest.fn(), getGrants: jest.fn(), createGrant: jest.fn(), updateGrant: jest.fn(), deleteGrant: jest.fn() },
}));
jest.mock('../../../apiClients/lootboxTypeClient', () => ({
    lootboxTypeClient: { getAll: jest.fn() },
}));
jest.mock('../../../apiClients/permissionGroupClient', () => ({
    permissionGroupClient: { getAll: jest.fn() },
}));
jest.mock('../../../apiClients/kitClient', () => {
    const getAll = jest.fn();
    return { KitClient: { getInstance: () => ({ getAll }) } };
});

const tokenClient = lootboxTokenClient as jest.Mocked<typeof lootboxTokenClient>;
const typeClient = lootboxTypeClient as jest.Mocked<typeof lootboxTypeClient>;
const groupClient = permissionGroupClient as jest.Mocked<typeof permissionGroupClient>;

const token = (id: number, overrides: Partial<LootboxTokenDto> = {}): LootboxTokenDto => ({
    id, token: `00000000-0000-0000-0000-00000000000${id}`, lootboxTypeId: 3, lootboxTypeName: 'Weapons Lootbox', boxGradeId: 5,
    boxStars: 5, boxLabel: 'Legendary Weapons Lootbox', status: 'Issued', reason: 'PremiumTier', issuedToUserId: 7,
    issuedToUsername: 'Pandi', issuedAt: '2026-09-26T12:00:00Z', deliveredAt: '2026-09-26T12:00:05Z', ...overrides,
});

describe('Lootbox token items tab (Phase 5)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (KitClient.getInstance().getAll as jest.Mock).mockResolvedValue([{ id: 4, name: 'Starter' }]);
        typeClient.getAll.mockResolvedValue([{ id: 3, name: 'Weapons Lootbox' } as never]);
        groupClient.getAll.mockResolvedValue([
            { id: 2, name: 'Noble', isPremiumTier: true } as never,
            { id: 1, name: 'Default', isPremiumTier: false } as never,
        ]);
        tokenClient.getGrants.mockResolvedValue([
            { id: 1, lootboxTypeId: 3, lootboxTypeName: 'Weapons Lootbox', boxStars: 5, quantity: 2, permissionGroupId: 2, permissionGroupName: 'Noble', enabled: true },
        ]);
        tokenClient.search.mockResolvedValue({
            items: [token(1), token(2, { status: 'Redeemed', redeemedByUsername: 'Bob', redeemedAt: '2026-09-26T13:00:00Z', claimId: 41 })],
            totalCount: 2, pageNumber: 1, pageSize: 25,
        });
    });

    it('lists issued tokens, filters them, and revokes an unopened one after a confirm', async () => {
        tokenClient.revoke.mockResolvedValue(token(1, { status: 'Revoked', revokedAt: '2026-09-26T14:00:00Z' }));
        render(<LootboxTokensTab />);

        const rows = await screen.findAllByTestId('token-row');
        expect(rows).toHaveLength(2);
        expect(rows[0]).toHaveTextContent('Unopened');
        expect(rows[1]).toHaveTextContent('Opened by Bob');
        expect(rows[1]).toHaveTextContent('claim #41');
        expect(screen.getAllByRole('button', { name: /revoke token/i })).toHaveLength(1);

        fireEvent.change(screen.getByLabelText('Token status filter'), { target: { value: 'Issued' } });
        await waitFor(() => expect(tokenClient.search).toHaveBeenLastCalledWith({
            pageNumber: 1, pageSize: 25, searchTerm: undefined, filters: { status: 'Issued' },
        }));

        fireEvent.click(screen.getByRole('button', { name: 'Revoke token 1' }));
        fireEvent.click(screen.getByRole('button', { name: 'Revoke' }));
        await waitFor(() => expect(tokenClient.revoke).toHaveBeenCalledWith('00000000-0000-0000-0000-000000000001'));
        expect(await screen.findByText(/Token #1 revoked/)).toBeInTheDocument();
    });

    it('shows the grant rules and adds one for a premium tier only', async () => {
        tokenClient.createGrant.mockImplementation(async dto => ({ ...dto, id: 2, lootboxTypeName: 'Weapons Lootbox', permissionGroupName: 'Noble' }));
        render(<LootboxTokensTab />);

        expect(await screen.findByTestId('grant-row')).toHaveTextContent('Joins Noble');
        await waitFor(() => expect(screen.getByRole('option', { name: 'Noble' })).toBeInTheDocument());
        expect(screen.queryByRole('option', { name: 'Default' })).not.toBeInTheDocument();

        fireEvent.change(screen.getByLabelText('Grant target'), { target: { value: '2' } });
        fireEvent.change(screen.getByLabelText('Grant box type'), { target: { value: '3' } });
        fireEvent.change(screen.getByLabelText('Grant quantity'), { target: { value: '2' } });
        fireEvent.click(screen.getByRole('button', { name: /add rule/i }));

        await waitFor(() => expect(tokenClient.createGrant).toHaveBeenCalledWith({
            lootboxTypeId: 3, boxStars: null, quantity: 2, permissionGroupId: 2, kitId: null, enabled: true,
        }));
        expect(await screen.findAllByTestId('grant-row')).toHaveLength(2);
    });

    it('labels drop-log rows by where the claim came from', () => {
        const base = { id: 1, isAdminGive: false } as LootboxClaimLogDto;
        expect(claimSourceLabel({ ...base, lootboxSpawnId: 12 })).toBe('box #12');
        expect(claimSourceLabel({ ...base, lootboxTokenId: 5, source: 'Token' })).toBe('token item #5');
        expect(claimSourceLabel({ ...base, isAdminGive: true })).toBe('staff give');
    });
});
