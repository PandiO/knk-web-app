import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
    MinecraftEnchantmentPicker,
    enchantmentPickerFilters,
    parseOriginFilter
} from '../MinecraftEnchantmentPicker';
import { getSearchFunctionForEntity } from '../../../utils/entityApiMapping';
import { minecraftEnchantmentRefClient } from '../../../apiClients/minecraftEnchantmentRefClient';
import { enchantmentDefinitionClient } from '../../../apiClients/enchantmentDefinitionClient';

// KNG-250: the enchantment picker searches the database catalogue a server scan fills (Picker:
// 'true'), shows vanilla and custom enchantments together with a Custom badge and an All / Vanilla /
// Custom filter (`origin`), and never creates a ref or a definition when a row is picked.

jest.mock('../../../utils/entityApiMapping', () => ({
    getSearchFunctionForEntity: jest.fn()
}));
jest.mock('../../../hooks/useEntityMetadata', () => ({
    useEntityMetadata: () => ({ baseMetadata: [], allMergedMetadata: [], configurations: [] })
}));
jest.mock('../../../apiClients/minecraftMaterialRefClient', () => ({ minecraftMaterialRefClient: {} }));
jest.mock('../../../apiClients/minecraftBlockRefClient', () => ({ minecraftBlockRefClient: {} }));
jest.mock('../../../apiClients/minecraftEnchantmentRefClient', () => ({ minecraftEnchantmentRefClient: { create: jest.fn() } }));
jest.mock('../../../apiClients/enchantmentDefinitionClient', () => ({ enchantmentDefinitionClient: { create: jest.fn() } }));

const enchantmentClient = minecraftEnchantmentRefClient as unknown as { create: jest.Mock };
const definitionClient = enchantmentDefinitionClient as unknown as { create: jest.Mock };

const BOOK = 'https://example.org/enchanted_book.png';
const sharpness = {
    id: 5, namespaceKey: 'minecraft:sharpness', displayName: 'Sharpness', maxLevel: 5, category: null,
    isCustom: false, catalogStatus: 'Active', lastSeenVersion: '26.3', iconUrl: BOOK
};
const flashChaos = {
    id: 9, namespaceKey: 'knk:flash_chaos', displayName: 'Flash Chaos', maxLevel: 1, category: 'SUPPORT',
    isCustom: true, catalogStatus: 'Active', lastSeenVersion: '26.3', iconUrl: BOOK
};

let search: jest.Mock;

beforeEach(() => {
    jest.clearAllMocks();
    search = jest.fn(async () => ({
        items: [sharpness, flashChaos],
        totalCount: 2, page: 1, pageSize: 10, totalPages: 1
    }));
    (getSearchFunctionForEntity as jest.Mock).mockImplementation(() => search);
});

const sentFilters = () => search.mock.calls[search.mock.calls.length - 1][0].filters;

const bodyRows = () => screen.getAllByRole('row').filter(row => row.hasAttribute('data-row-key'));

describe('MinecraftEnchantmentPicker', () => {
    it('runs a picker search for every enchantment by default, without SearchHybrid', async () => {
        render(<MinecraftEnchantmentPicker label="Enchantment" value={null} onChange={jest.fn()} />);
        await waitFor(() => expect(search).toHaveBeenCalled());
        expect(getSearchFunctionForEntity).toHaveBeenCalledWith('MinecraftEnchantmentRef');
        expect(sentFilters()).toEqual({ Picker: 'true' });
        expect(sentFilters()).not.toHaveProperty('SearchHybrid');
        expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
    });

    it('starts from the originFilter setting and still sends the categoryFilter', async () => {
        render(<MinecraftEnchantmentPicker label="Enchantment" value={null} onChange={jest.fn()} originFilter="custom" categoryFilter="SUPPORT" />);
        await waitFor(() => expect(search).toHaveBeenCalled());
        expect(sentFilters()).toEqual({ Picker: 'true', origin: 'custom', category: 'SUPPORT' });
        expect(screen.getByRole('button', { name: 'Custom' })).toHaveAttribute('aria-pressed', 'true');
    });

    it('searches again with the origin the filter control picks', async () => {
        render(<MinecraftEnchantmentPicker label="Enchantment" value={null} onChange={jest.fn()} />);
        await screen.findByText('Sharpness');

        fireEvent.click(screen.getByRole('button', { name: 'Vanilla' }));
        await waitFor(() => expect(sentFilters()).toEqual({ Picker: 'true', origin: 'vanilla' }));
        expect(screen.getByRole('button', { name: 'Vanilla' })).toHaveAttribute('aria-pressed', 'true');

        fireEvent.click(await screen.findByRole('button', { name: 'All' }));
        await waitFor(() => expect(sentFilters()).toEqual({ Picker: 'true' }));
    });

    it('shows the enchanted book icon and a Custom badge only on custom rows', async () => {
        render(<MinecraftEnchantmentPicker label="Enchantment" value={null} onChange={jest.fn()} />);
        await screen.findByText('Flash Chaos');
        const [sharpnessRow, chaosRow] = bodyRows();
        expect(within(sharpnessRow).getByRole('img', { name: 'Sharpness' })).toHaveAttribute('src', BOOK);
        expect(within(chaosRow).getByText('Custom')).toBeInTheDocument();
        expect(within(sharpnessRow).queryByText('Custom')).not.toBeInTheDocument();
        expect(within(sharpnessRow).getByText('Vanilla')).toBeInTheDocument();
        expect(bodyRows().map(row => row.getAttribute('data-row-key'))).toEqual(['id:5', 'id:9']);
        expect(screen.queryByText('New')).not.toBeInTheDocument();
    });

    it('selects a picked row without creating a ref or a definition', async () => {
        const onChange = jest.fn();
        render(<MinecraftEnchantmentPicker label="Enchantment" value={null} onChange={onChange} />);
        fireEvent.click(await screen.findByText('Flash Chaos'));
        expect(onChange).toHaveBeenCalledWith(flashChaos);
        expect(enchantmentClient.create).not.toHaveBeenCalled();
        expect(definitionClient.create).not.toHaveBeenCalled();
    });

    it('matches the current value by id', async () => {
        const onChange = jest.fn();
        render(<MinecraftEnchantmentPicker label="Enchantment" value={{ id: 5, namespaceKey: 'minecraft:sharpness' }} onChange={onChange} />);
        await screen.findByText('Sharpness');
        // Clicking the selected row deselects it (single select).
        fireEvent.click(screen.getByText('Sharpness'));
        expect(onChange).toHaveBeenCalledWith(null);
    });

    it('maps the settings to filters', () => {
        expect(parseOriginFilter('Vanilla')).toBe('vanilla');
        expect(parseOriginFilter('custom')).toBe('custom');
        expect(parseOriginFilter('all')).toBe('all');
        expect(parseOriginFilter('anything')).toBe('all');
        expect(parseOriginFilter(undefined)).toBe('all');
        expect(enchantmentPickerFilters('vanilla', ' Weapon ')).toEqual({ Picker: 'true', origin: 'vanilla', category: 'Weapon' });
        expect(enchantmentPickerFilters('all', '  ')).toEqual({ Picker: 'true' });
    });
});
