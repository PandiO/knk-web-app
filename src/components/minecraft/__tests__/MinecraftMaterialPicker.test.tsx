import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MinecraftMaterialPicker, materialPickerFilters } from '../MinecraftMaterialPicker';
import { getSearchFunctionForEntity } from '../../../utils/entityApiMapping';

// KNG-200 phase 4: the material picker filters on kind. Item blueprints, menus and icons pick
// items, so that is the default; BLOCK picks blocks and ANY everything.
// KNG-200 phase 5: it is a database-only picker search (Picker: 'true'), no hybrid search.

jest.mock('../../../utils/entityApiMapping', () => ({
    getSearchFunctionForEntity: jest.fn()
}));
jest.mock('../../../hooks/useEntityMetadata', () => ({
    useEntityMetadata: () => ({ baseMetadata: [], allMergedMetadata: [], configurations: [] })
}));
jest.mock('../../../apiClients/minecraftMaterialRefClient', () => ({ minecraftMaterialRefClient: {} }));
jest.mock('../../../apiClients/minecraftBlockRefClient', () => ({ minecraftBlockRefClient: {} }));
jest.mock('../../../apiClients/minecraftEnchantmentRefClient', () => ({ minecraftEnchantmentRefClient: {} }));
jest.mock('../../../apiClients/enchantmentDefinitionClient', () => ({ enchantmentDefinitionClient: {} }));

let search: jest.Mock;

beforeEach(() => {
    jest.clearAllMocks();
    search = jest.fn(async () => ({
        items: [{
            id: 5, namespaceKey: 'minecraft:torch', displayName: 'Torch', isPersisted: true,
            isItem: true, isBlock: true, catalogStatus: 'Active', iconUrl: null
        }],
        totalCount: 1, page: 1, pageSize: 10, totalPages: 1
    }));
    (getSearchFunctionForEntity as jest.Mock).mockImplementation(() => search);
});

const renderPicker = (categoryFilter?: string) =>
    render(<MinecraftMaterialPicker label="Icon material" value={null} onChange={jest.fn()} categoryFilter={categoryFilter} />);

const sentFilters = () => search.mock.calls[search.mock.calls.length - 1][0].filters;

describe('MinecraftMaterialPicker filters', () => {
    it('picks items by default', async () => {
        renderPicker();
        await waitFor(() => expect(search).toHaveBeenCalled());
        expect(sentFilters()).toEqual({ Picker: 'true', kind: 'item' });
    });

    it('sends kind=block (and the legacy category) for BLOCK', async () => {
        renderPicker('BLOCK');
        await waitFor(() => expect(search).toHaveBeenCalled());
        expect(sentFilters()).toEqual({ Picker: 'true', category: 'BLOCK', kind: 'block' });
    });

    it('sends no kind for ANY', async () => {
        renderPicker('ANY');
        await waitFor(() => expect(search).toHaveBeenCalled());
        expect(sentFilters()).toEqual({ Picker: 'true', category: 'ANY' });
    });

    it('sends the picker flag and never the SearchHybrid flag', async () => {
        renderPicker('BLOCK');
        await waitFor(() => expect(search).toHaveBeenCalled());
        expect(search).toHaveBeenCalledTimes(1);
        expect(sentFilters().Picker).toBe('true');
        expect(sentFilters()).not.toHaveProperty('SearchHybrid');
    });

    it('maps the other legacy settings to items', () => {
        expect(materialPickerFilters('ICON')).toEqual({ Picker: 'true', category: 'ICON', kind: 'item' });
        expect(materialPickerFilters('ITEM')).toEqual({ Picker: 'true', category: 'ITEM', kind: 'item' });
        expect(materialPickerFilters('BANNER')).toEqual({ Picker: 'true', category: 'BANNER', kind: 'item' });
        expect(materialPickerFilters('block')).toEqual({ Picker: 'true', category: 'block', kind: 'block' });
        expect(materialPickerFilters('  ')).toEqual({ Picker: 'true', kind: 'item' });
    });

    it('shows the display name, kind and no "Existing" badge for a saved row', async () => {
        renderPicker();
        expect(await screen.findByText('Torch')).toBeInTheDocument();
        expect(screen.getByText('Item & block')).toBeInTheDocument();
        expect(screen.getByText('Active')).toBeInTheDocument();
        expect(screen.queryByText('Existing')).not.toBeInTheDocument();
        expect(screen.queryByText('New')).not.toBeInTheDocument();
    });
});
