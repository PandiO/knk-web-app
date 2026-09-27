import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { LootboxesPage } from '../LootboxesPage';
import { lootboxTypeClient } from '../../../apiClients/lootboxTypeClient';
import { lootboxSpawnClient } from '../../../apiClients/lootboxSpawnClient';
import { lootboxClaimClient } from '../../../apiClients/lootboxClaimClient';
import { lootboxConfigurationClient } from '../../../apiClients/lootboxConfigurationClient';
import { itemInstanceClient } from '../../../apiClients/itemInstanceClient';
import { GradeClient } from '../../../apiClients/gradeClient';
import { LootboxClaimLogDto, LootboxOddsDto, LootboxTypeDto } from '../../../types/dtos/lootbox/LootboxDtos';

// virtual: CRA's Jest resolver can't resolve react-router-dom's package exports
jest.mock('react-router-dom', () => ({
    Link: ({ to, children, ...rest }: { to: string; children: React.ReactNode }) => <a href={to} {...rest}>{children}</a>,
}), { virtual: true });
jest.mock('../../../apiClients/lootboxTypeClient', () => ({
    lootboxTypeClient: { getAll: jest.fn(), getById: jest.fn(), update: jest.fn(), getOdds: jest.fn() },
}));
jest.mock('../../../apiClients/lootboxSpawnClient', () => ({
    lootboxSpawnClient: { getActive: jest.fn(), despawn: jest.fn() },
}));
jest.mock('../../../apiClients/lootboxClaimClient', () => ({
    lootboxClaimClient: { search: jest.fn() },
}));
jest.mock('../../../apiClients/lootboxConfigurationClient', () => ({
    lootboxConfigurationClient: { get: jest.fn(), update: jest.fn() },
}));
jest.mock('../../../apiClients/itemInstanceClient', () => ({
    itemInstanceClient: { getById: jest.fn() },
}));
jest.mock('../../../apiClients/lootboxSpecialEntryClient', () => ({
    lootboxSpecialEntryClient: { getAll: jest.fn().mockResolvedValue([]) },
}));
jest.mock('../../../apiClients/lootboxSpawnAreaClient', () => ({
    lootboxSpawnAreaClient: { getAll: jest.fn().mockResolvedValue([]) },
}));
jest.mock('../../../apiClients/gradeClient', () => {
    const getAll = jest.fn();
    return { GradeClient: { getInstance: () => ({ getAll }) } };
});

const typeClient = lootboxTypeClient as jest.Mocked<typeof lootboxTypeClient>;
const spawnClient = lootboxSpawnClient as jest.Mocked<typeof lootboxSpawnClient>;
const claimClient = lootboxClaimClient as jest.Mocked<typeof lootboxClaimClient>;
const configClient = lootboxConfigurationClient as jest.Mocked<typeof lootboxConfigurationClient>;
const instanceClient = itemInstanceClient as jest.Mocked<typeof itemInstanceClient>;
const getGrades = GradeClient.getInstance().getAll as jest.Mock;

const weapons: LootboxTypeDto = {
    id: 3, name: 'Weapons Lootbox', categoryId: 2, category: { id: 2, name: 'Weapons' }, includeSubcategories: true,
    enabled: false, spawnWeight: 10, minBoxStars: 1, maxBoxStars: 5, itemStarSpread: 2,
    gradeWeights: [], poolEntries: [{ itemBlueprintId: 40, mode: 'Exclude' }], enchantRolls: [],
};

const weaponsOdds = (boxStars: number): LootboxOddsDto => ({
    lootboxTypeId: 3,
    lootboxTypeName: 'Weapons Lootbox',
    boxStars,
    boxGrades: [
        { gradeId: 1, name: 'Common', stars: 1, percent: 33.33 },
        { gradeId: 5, name: 'Legendary', stars: 5, percent: 7.14 },
    ],
    specials: boxStars === 5 ? [
        { specialEntryId: 1, itemBlueprintId: 90, name: 'Flaming Samurai', chancePerMillion: 500, chancePercent: 0.05, percent: 0.05 },
        { specialEntryId: 2, itemBlueprintId: 91, name: 'Skull splitter', chancePerMillion: 2000, chancePercent: 0.2, percent: 0.199 },
    ] : [],
    normalRollPercent: boxStars === 5 ? 99.75 : 100,
    windowWidened: false,
    itemGrades: boxStars === 5 ? [
        { gradeId: 3, name: 'Rare', stars: 3, percent: 50, itemCount: 3 },
        { gradeId: 4, name: 'Epic', stars: 4, percent: 31.25, itemCount: 1 },
        { gradeId: 5, name: 'Legendary', stars: 5, percent: 18.75, itemCount: 1 },
    ] : [
        { gradeId: 2, name: 'Uncommon', stars: 2, percent: 100, itemCount: 2 },
    ],
    items: [
        { itemBlueprintId: 50, name: 'Golemheart Sword', gradeId: 5, stars: 5, weight: 1, quantity: 1, rollsEnchantments: true, percentWithinGrade: 100, percent: 18.70 },
    ],
    enchantments: [
        {
            enchantRollId: 7, enchantmentDefinitionId: 11, key: 'minecraft:sharpness', isCustom: false, hitPercent: 60,
            minLevel: 1, maxLevel: 4, applicableItemCount: 3, landPercent: 41.6,
            levelsByGrade: [{ gradeId: 5, stars: 5, minLevel: 1, maxLevel: 4 }, { gradeId: 3, stars: 3, minLevel: 1, maxLevel: 2 }],
        },
    ],
});

const claim = (id: number, overrides: Partial<LootboxClaimLogDto> = {}): LootboxClaimLogDto => ({
    id, lootboxSpawnId: 100 + id, isAdminGive: false, userId: 7, username: 'Pandi', lootboxTypeId: 3,
    lootboxTypeName: 'Weapons Lootbox', boxGradeId: 5, boxStars: 5, itemBlueprintId: 50, itemName: 'Golemheart Sword',
    itemGradeId: 5, itemStars: 5, quantity: 1, isSpecial: false, itemInstanceId: 1000 + id,
    claimedAt: '2026-09-26T12:00:00Z', deliveredAt: '2026-09-26T12:00:01Z', deliveryMethod: 'Inventory', ...overrides,
});

beforeEach(() => {
    jest.clearAllMocks();
    typeClient.getAll.mockResolvedValue([weapons]);
    typeClient.getOdds.mockImplementation(async (_id: number, stars?: number) => weaponsOdds(stars ?? 5));
    getGrades.mockResolvedValue([{ id: 5, name: 'Legendary', stars: 5 }, { id: 1, name: 'Common', stars: 1 }]);
    configClient.get.mockResolvedValue({
        enabled: true, globalMaxActive: 15, maxClaimsPerPlayerPerDay: 10, announceMinItemStars: 5, announceSpawnMinBoxStars: 6,
        dropAnnouncementTemplate: '&6{player} &efound {item} &ein a {box}!', spawnAnnouncementTemplate: '&eA {box} &eappeared in &6{area}&e!',
        updatedAt: '2026-09-26T10:00:00Z',
    });
});

describe('LootboxesPage', () => {
    it('lists the types with their pool per item grade and warns about empty grades', async () => {
        render(<LootboxesPage />);
        expect(await screen.findByText('Weapons Lootbox')).toBeInTheDocument();
        // ★5 and ★2 cover every window of a ★1-5 type with spread 2.
        await waitFor(() => expect(typeClient.getOdds).toHaveBeenCalledTimes(2));
        expect(typeClient.getOdds).toHaveBeenCalledWith(3, 5);
        expect(typeClient.getOdds).toHaveBeenCalledWith(3, 2);
        expect(await screen.findByText('★3: 3')).toBeInTheDocument();
        expect(screen.getByText('★1: 0')).toBeInTheDocument();
        expect(screen.getByText(/No ★1 items/)).toBeInTheDocument();
        expect(screen.getByText('Weapons (+ subcategories)')).toBeInTheDocument();
    });

    it('enables a type by re-sending it whole with only Enabled flipped', async () => {
        typeClient.getById.mockResolvedValue(weapons);
        typeClient.update.mockResolvedValue(undefined);
        render(<LootboxesPage />);
        fireEvent.click(await screen.findByRole('button', { name: 'Enable Weapons Lootbox' }));
        await waitFor(() => expect(typeClient.update).toHaveBeenCalledWith({ ...weapons, enabled: true }));
        expect(await screen.findByRole('button', { name: 'Disable Weapons Lootbox' })).toHaveTextContent('Enabled');
    });

    it('renders the odds table from the odds response: specials, grade split and enchant land chance', async () => {
        render(<LootboxesPage initialTab="odds" />);
        await waitFor(() => expect(typeClient.getOdds).toHaveBeenCalledWith(3, 5));

        const specials = await screen.findAllByTestId('special-row');
        expect(specials).toHaveLength(2);
        expect(specials[0]).toHaveTextContent('Flaming Samurai');
        expect(specials[0]).toHaveTextContent('0.05%');
        // Own chance, then the chance it is what the box gives (the Flaming Samurai missed first).
        expect(within(specials[1]).getAllByRole('cell').map(c => c.textContent)).toEqual(['Skull splitter', '0.2%', '0.199%']);
        expect(screen.getByText('99.75%')).toBeInTheDocument();

        const grades = screen.getAllByTestId('item-grade-row');
        expect(grades.map(r => r.textContent)).toEqual([
            expect.stringContaining('★3 Rare'),
            expect.stringContaining('★4 Epic'),
            expect.stringContaining('★5 Legendary'),
        ]);
        expect(grades[2]).toHaveTextContent('18.75%'); // of the normal roll
        expect(grades[2]).toHaveTextContent('18.7%'); // of the box: 18.75 × 99.75 %

        const enchant = screen.getByTestId('enchant-row');
        expect(enchant).toHaveTextContent('minecraft:sharpness');
        expect(enchant).toHaveTextContent('41.6%');
        expect(enchant).toHaveTextContent('★3 1-2 · ★5 1-4');

        fireEvent.change(screen.getByLabelText('Box grade'), { target: { value: '2' } });
        await waitFor(() => expect(typeClient.getOdds).toHaveBeenLastCalledWith(3, 2));
        expect(await screen.findByText('No special can come out of this box.')).toBeInTheDocument();
    });

    it('despawns an active box after a confirmation', async () => {
        spawnClient.getActive.mockResolvedValue([{
            id: 12, token: 'abc', lootboxTypeId: 3, lootboxTypeName: 'Weapons Lootbox', boxGradeId: 5, boxGradeName: 'Legendary',
            boxStars: 5, boxLabel: 'Legendary Weapons Lootbox', spawnAreaId: 1, spawnAreaName: 'spawn', world: 'world', x: 1, y: 64, z: 2,
            status: 'Active', spawnedAt: '2026-09-26T12:00:00Z', expiresAt: '2026-09-26T12:30:00Z',
        }]);
        spawnClient.despawn.mockResolvedValue({ status: 'Removed' } as any);
        render(<LootboxesPage initialTab="active" />);

        fireEvent.click(await screen.findByRole('button', { name: 'Despawn box 12' }));
        expect(spawnClient.despawn).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: /confirm despawn/i }));

        await waitFor(() => expect(spawnClient.despawn).toHaveBeenCalledWith(12));
        expect(await screen.findByText('Box #12 removed.')).toBeInTheDocument();
        expect(screen.queryByTestId('active-row')).not.toBeInTheDocument();
    });

    it('pages the drop log, filters it and opens a minted item instance', async () => {
        claimClient.search.mockImplementation(async (query) => ({
            items: query.pageNumber === 1
                ? [claim(1, { isSpecial: true, itemName: 'Flaming Samurai' }), claim(2, { deliveredAt: null, deliveryMethod: null })]
                : [claim(26, { itemInstanceId: null, itemName: 'Bread', quantity: 8 })],
            totalCount: 26,
            pageNumber: query.pageNumber,
            pageSize: query.pageSize,
        }));
        instanceClient.getById.mockResolvedValue({
            id: 1001, itemBlueprintId: 90, itemBlueprint: { id: 90, name: 'Flaming Samurai' }, gradeId: 5,
            grade: { id: 5, name: 'Legendary', stars: 5 }, ownerUserId: 7, ownerUsername: 'Pandi', origin: 'Lootbox', originRef: '1',
            createdAt: '2026-09-26T12:00:00Z', ownerCount: 1, isSoulbound: false, isGhosted: false,
            enchantments: [{ enchantmentDefinitionId: 11, key: 'minecraft:sharpness', displayName: 'Sharpness', isCustom: false, level: 5 }],
        });
        render(<LootboxesPage initialTab="log" />);

        await waitFor(() => expect(claimClient.search).toHaveBeenCalledWith({ pageNumber: 1, pageSize: 25, searchTerm: undefined, filters: {} }));
        const rows = await screen.findAllByTestId('drop-row');
        expect(rows[0]).toHaveClass('bg-purple-50');
        expect(rows[0]).toHaveTextContent('special');
        expect(rows[1]).toHaveTextContent('Not delivered');
        expect(screen.getByText(/26 claims · page 1 of 2/)).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /next/i }));
        await waitFor(() => expect(claimClient.search).toHaveBeenLastCalledWith(expect.objectContaining({ pageNumber: 2 })));
        expect(await screen.findByText('Bread')).toBeInTheDocument();
        expect(screen.getByText('stackable')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /next/i })).toBeDisabled();

        // A filter goes back to page 1 and is sent as the API's filter dictionary.
        fireEvent.change(screen.getByLabelText('Special filter'), { target: { value: 'true' } });
        fireEvent.change(screen.getByLabelText('To day'), { target: { value: '2026-09-26' } });
        await waitFor(() => expect(claimClient.search).toHaveBeenLastCalledWith({
            pageNumber: 1, pageSize: 25, searchTerm: undefined,
            filters: { isSpecial: 'true', to: '2026-09-27T00:00:00.000Z' },
        }));

        fireEvent.click(await screen.findByRole('button', { name: '#1001' }));
        await waitFor(() => expect(instanceClient.getById).toHaveBeenCalledWith(1001));
        const detail = await screen.findByRole('region', { name: 'Item instance 1001' });
        expect(within(detail).getByText('Sharpness 5')).toBeInTheDocument();
        expect(within(detail).getByText('Lootbox · claim #1')).toBeInTheDocument();
    });

    it('saves the whole settings object', async () => {
        configClient.update.mockImplementation(async (dto) => ({ ...dto, updatedAt: '2026-09-26T11:00:00Z' }));
        render(<LootboxesPage initialTab="settings" />);
        const cap = await screen.findByLabelText('Boxes per player per UTC day');
        expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();

        fireEvent.change(cap, { target: { value: '0' } });
        expect(screen.getByText('At least 1.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();

        fireEvent.change(cap, { target: { value: '' } });
        fireEvent.click(screen.getByRole('button', { name: /save/i }));
        await waitFor(() => expect(configClient.update).toHaveBeenCalledWith({
            enabled: true, globalMaxActive: 15, maxClaimsPerPlayerPerDay: null, announceMinItemStars: 5, announceSpawnMinBoxStars: 6,
            dropAnnouncementTemplate: '&6{player} &efound {item} &ein a {box}!', spawnAnnouncementTemplate: '&eA {box} &eappeared in &6{area}&e!',
        }));
        expect(await screen.findByText('Lootbox settings saved.')).toBeInTheDocument();
    });
});
