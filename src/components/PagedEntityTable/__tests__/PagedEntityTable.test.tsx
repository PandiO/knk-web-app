import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PagedEntityTable } from '../PagedEntityTable';
import { getSearchFunctionForEntity } from '../../../utils/entityApiMapping';
import { minecraftMaterialRefClient } from '../../../apiClients/minecraftMaterialRefClient';
import { minecraftBlockRefClient } from '../../../apiClients/minecraftBlockRefClient';
import { minecraftEnchantmentRefClient } from '../../../apiClients/minecraftEnchantmentRefClient';
import { enchantmentDefinitionClient } from '../../../apiClients/enchantmentDefinitionClient';

/**
 * KNG-136: PagedEntityTable's first tests - pinned "Created in this form" rows, de-duplication
 * against the page, search-term and filter matching of pinned rows, stable row keys and id-based
 * selection (id-less items are no longer all "the same").
 */

jest.mock('../../../utils/entityApiMapping', () => ({
    getSearchFunctionForEntity: jest.fn()
}));
jest.mock('../../../hooks/useEntityMetadata', () => ({
    useEntityMetadata: () => ({ baseMetadata: [], allMergedMetadata: [], configurations: [] })
}));
jest.mock('../../../apiClients/minecraftMaterialRefClient', () => ({
    minecraftMaterialRefClient: { create: jest.fn(), persistFromCatalog: jest.fn() }
}));
jest.mock('../../../apiClients/minecraftBlockRefClient', () => ({
    minecraftBlockRefClient: { create: jest.fn(), getOrCreate: jest.fn() }
}));
jest.mock('../../../apiClients/minecraftEnchantmentRefClient', () => ({ minecraftEnchantmentRefClient: { create: jest.fn() } }));
jest.mock('../../../apiClients/enchantmentDefinitionClient', () => ({ enchantmentDefinitionClient: { create: jest.fn() } }));

type Row = Record<string, any>;

const materialClient = minecraftMaterialRefClient as unknown as { create: jest.Mock; persistFromCatalog: jest.Mock };
const blockClient = minecraftBlockRefClient as unknown as { create: jest.Mock; getOrCreate: jest.Mock };
const enchantmentClient = minecraftEnchantmentRefClient as unknown as { create: jest.Mock };
const definitionClient = enchantmentDefinitionClient as unknown as { create: jest.Mock };

/** A promise the test resolves itself, to control the order of responses. */
const deferred = <V,>() => {
    let resolve!: (value: V) => void;
    const promise = new Promise<V>(res => { resolve = res; });
    return { promise, resolve };
};

const columns = [
    { key: 'id', label: 'ID', sortable: true },
    { key: 'name', label: 'Name', sortable: true }
];

const page = (items: Row[]) => ({ items, totalCount: items.length, page: 1, pageSize: 10, totalPages: 1 });

let search: jest.Mock;

beforeEach(() => {
    jest.clearAllMocks();
    search = jest.fn(async () => page([{ id: 1, name: 'Alpha' }, { id: 2, name: 'Bravo' }]));
    (getSearchFunctionForEntity as jest.Mock).mockImplementation(() => search);
});

const bodyRows = () => within(screen.getAllByRole('rowgroup')[1]).getAllByRole('row');

describe('PagedEntityTable', () => {
    it('renders the search results with id-based row keys', async () => {
        render(<PagedEntityTable<Row> entityTypeName="District" columns={columns} />);
        await screen.findByText('Alpha');
        expect(bodyRows().map(r => r.getAttribute('data-row-key'))).toEqual(['id:1', 'id:2']);
        expect(screen.queryByText('Created in this form')).not.toBeInTheDocument();
    });

    it('shows pinned rows above the results with a New badge', async () => {
        render(
            <PagedEntityTable<Row>
                entityTypeName="District"
                columns={columns}
                pinnedRows={[{ key: 'district:501', row: { id: 501, name: 'Old Quarter' } }]}
            />
        );
        await screen.findByText('Alpha');
        const rows = bodyRows();
        expect(rows[0]).toHaveTextContent('Created in this form');
        expect(rows[1]).toHaveTextContent('Old Quarter');
        expect(within(rows[1]).getByText('New')).toBeInTheDocument();
        expect(rows[1].getAttribute('data-row-key')).toBe('pinned:district:501');
        expect(rows[2]).toHaveTextContent('Search results');
        expect(rows[3]).toHaveTextContent('Alpha');
    });

    it('shows a row that is both pinned and in the page once, pinned, with the page data', async () => {
        search.mockResolvedValue(page([{ id: 1, name: 'Alpha' }, { id: 501, name: 'Old Quarter (saved)' }]));
        render(
            <PagedEntityTable<Row>
                entityTypeName="District"
                columns={columns}
                pinnedRows={[{ key: 'district:501', row: { id: 501, name: 'Old Quarter' } }]}
            />
        );
        await screen.findByText('Old Quarter (saved)');
        expect(screen.getAllByText(/Old Quarter/)).toHaveLength(1);
        expect(bodyRows().map(r => r.getAttribute('data-row-key'))).toEqual([null, 'pinned:district:501', null, 'id:1']);
    });

    it('filters pinned rows with the search box', async () => {
        render(
            <PagedEntityTable<Row>
                entityTypeName="District"
                columns={columns}
                pinnedRows={[
                    { key: 'district:501', row: { id: 501, name: 'Old Quarter' } },
                    { key: 'district:502', row: { id: 502, name: 'Harbour' } }
                ]}
            />
        );
        await screen.findByText('Harbour');
        search.mockResolvedValue(page([]));
        fireEvent.change(screen.getByPlaceholderText('Search...'), { target: { value: 'harb' } });
        // While the refetch runs the table shows a spinner, so wait for both at once.
        await waitFor(() => {
            expect(screen.getByText('Harbour')).toBeInTheDocument();
            expect(screen.queryByText('Old Quarter')).not.toBeInTheDocument();
        });
        expect(search).toHaveBeenLastCalledWith(expect.objectContaining({ searchTerm: 'harb' }));
    });

    it('filters pinned rows with the picker filters', async () => {
        search.mockResolvedValue(page([]));
        render(
            <PagedEntityTable<Row>
                entityTypeName="District"
                columns={columns}
                initialQuery={{ filters: { townId: '4' } }}
                pinnedRows={[
                    { key: 'district:501', row: { id: 501, name: 'Old Quarter', townId: 4 } },
                    { key: 'district:502', row: { id: 502, name: 'Harbour', townId: 9 } }
                ]}
            />
        );
        await screen.findByText('Old Quarter');
        expect(screen.queryByText('Harbour')).not.toBeInTheDocument();
        expect(screen.queryByText('No results found')).not.toBeInTheDocument();
    });

    it('selects a pinned row and marks it selected by id', async () => {
        const onSelectionChange = jest.fn();
        const pinnedRow = { id: 501, name: 'Old Quarter' };
        const { rerender } = render(
            <PagedEntityTable<Row>
                entityTypeName="District"
                columns={columns}
                selectionConfig={{ mode: 'multiple' }}
                selectedItems={[]}
                onSelectionChange={onSelectionChange}
                pinnedRows={[{ key: 'district:501', row: pinnedRow }]}
            />
        );
        fireEvent.click(await screen.findByText('Old Quarter'));
        expect(onSelectionChange).toHaveBeenLastCalledWith([pinnedRow]);

        // A different object with the same id (the field value after a re-render) is still selected.
        rerender(
            <PagedEntityTable<Row>
                entityTypeName="District"
                columns={columns}
                selectionConfig={{ mode: 'multiple' }}
                selectedItems={[{ id: 501, name: 'Old Quarter' }]}
                onSelectionChange={onSelectionChange}
                pinnedRows={[{ key: 'district:501', row: pinnedRow }]}
            />
        );
        const row = screen.getByText('Old Quarter').closest('tr')!;
        await waitFor(() => expect(row.className).toContain('bg-green-50'));
    });

    it('keeps two id-less selected items apart (selection sync no longer treats them as equal)', async () => {
        const onSelectionChange = jest.fn();
        const first = { name: 'unsaved A' };
        const second = { name: 'unsaved B' };
        const { rerender } = render(
            <PagedEntityTable<Row>
                entityTypeName="District"
                columns={columns}
                selectionConfig={{ mode: 'multiple' }}
                selectedItems={[first]}
                onSelectionChange={onSelectionChange}
            />
        );
        await screen.findByText('Alpha');
        rerender(
            <PagedEntityTable<Row>
                entityTypeName="District"
                columns={columns}
                selectionConfig={{ mode: 'multiple' }}
                selectedItems={[second]}
                onSelectionChange={onSelectionChange}
            />
        );
        // Selecting Alpha now appends to [second]; before, the sync kept [first].
        fireEvent.click(screen.getByText('Alpha'));
        expect(onSelectionChange).toHaveBeenLastCalledWith([second, { id: 1, name: 'Alpha' }]);
    });

    it('refetches when refreshKey changes', async () => {
        const { rerender } = render(<PagedEntityTable<Row> entityTypeName="District" columns={columns} refreshKey="a" />);
        await screen.findByText('Alpha');
        expect(search).toHaveBeenCalledTimes(1);
        rerender(<PagedEntityTable<Row> entityTypeName="District" columns={columns} refreshKey="b" />);
        await waitFor(() => expect(search).toHaveBeenCalledTimes(2));
    });

    it('says "No results found" only when there are neither pinned nor page rows', async () => {
        search.mockResolvedValue(page([]));
        render(<PagedEntityTable<Row> entityTypeName="District" columns={columns} pinnedRows={[]} />);
        expect(await screen.findByText('No results found')).toBeInTheDocument();
    });

    // KNG-200 phase 5: materials and blocks are database-only, so their tables are plain tables.
    describe('Minecraft material and block tables (KNG-200 phase 5)', () => {
        const torch = { id: 7, name: 'Torch', namespaceKey: 'minecraft:torch', category: 'ITEM', isPersisted: true };
        const stone = { id: 3, name: 'Stone', namespaceKey: 'minecraft:stone', category: 'ITEM', isPersisted: true };

        it('searches materials without the SearchHybrid flag and shows no badges', async () => {
            search.mockResolvedValue(page([torch, stone]));
            render(<PagedEntityTable<Row> entityTypeName="MinecraftMaterialRef" columns={columns} />);
            await screen.findByText('Torch');
            expect(search).toHaveBeenCalledTimes(1);
            expect(search.mock.calls[0][0].filters).not.toHaveProperty('SearchHybrid');
            expect(screen.queryByText('New')).not.toBeInTheDocument();
            expect(screen.queryByText('Existing')).not.toBeInTheDocument();
            expect(bodyRows().map(r => r.getAttribute('data-row-key'))).toEqual(['id:7', 'id:3']);
        });

        it('searches blocks without the SearchHybrid flag', async () => {
            search.mockResolvedValue(page([{ id: 40, name: 'Oak Stairs', namespaceKey: 'minecraft:oak_stairs', blockStateString: 'minecraft:oak_stairs[facing=north]' }]));
            render(<PagedEntityTable<Row> entityTypeName="MinecraftBlockRef" columns={columns} initialQuery={{ filters: { kind: 'block' } }} />);
            await screen.findByText('Oak Stairs');
            expect(search.mock.calls[0][0].filters).toEqual({ kind: 'block' });
        });

        it('never auto-creates a material, not even for a row marked unsaved', async () => {
            // An older API could still answer with an unsaved catalogue row; the table just selects it.
            const lantern = { id: null, name: 'Lantern', namespaceKey: 'minecraft:lantern', category: 'ITEM', isPersisted: false };
            search.mockResolvedValue(page([torch, lantern]));
            const onSelectionChange = jest.fn();
            render(
                <PagedEntityTable<Row>
                    entityTypeName="MinecraftMaterialRef"
                    columns={columns}
                    selectionConfig={{ mode: 'single' }}
                    onSelectionChange={onSelectionChange}
                />
            );
            fireEvent.click(await screen.findByText('Lantern'));
            expect(onSelectionChange).toHaveBeenCalledWith([lantern]);
            expect(within(bodyRows()[1]).queryByText('New')).not.toBeInTheDocument();

            fireEvent.click(screen.getByText('Torch'));
            expect(onSelectionChange).toHaveBeenLastCalledWith([torch]);
            expect(materialClient.persistFromCatalog).not.toHaveBeenCalled();
            expect(materialClient.create).not.toHaveBeenCalled();
        });

        it('never auto-creates a block state', async () => {
            const north = { id: 0, name: 'Oak Stairs', namespaceKey: 'minecraft:oak_stairs', blockStateString: 'minecraft:oak_stairs[facing=north]', isPersisted: false };
            search.mockResolvedValue(page([north]));
            const onSelectionChange = jest.fn();
            render(
                <PagedEntityTable<Row>
                    entityTypeName="MinecraftBlockRef"
                    columns={columns}
                    selectionConfig={{ mode: 'single' }}
                    onSelectionChange={onSelectionChange}
                />
            );
            fireEvent.click(await screen.findByText('Oak Stairs'));
            expect(onSelectionChange).toHaveBeenCalledWith([north]);
            expect(blockClient.getOrCreate).not.toHaveBeenCalled();
            expect(blockClient.create).not.toHaveBeenCalled();
        });

        it('ignores a slow earlier search that answers after a later one', async () => {
            const lantern = { id: 8, name: 'Lantern', namespaceKey: 'minecraft:lantern', category: 'ITEM', isPersisted: true };
            const broad = deferred<ReturnType<typeof page>>();
            const narrow = deferred<ReturnType<typeof page>>();
            search
                .mockResolvedValueOnce(page([stone]))
                .mockReturnValueOnce(broad.promise)
                .mockReturnValueOnce(narrow.promise);
            render(<PagedEntityTable<Row> entityTypeName="MinecraftMaterialRef" columns={columns} />);
            await screen.findByText('Stone');

            fireEvent.change(screen.getByPlaceholderText('Search...'), { target: { value: 'to' } });
            await waitFor(() => expect(search).toHaveBeenCalledTimes(2), { timeout: 2000 });
            fireEvent.change(screen.getByPlaceholderText('Search...'), { target: { value: 'torch' } });
            await waitFor(() => expect(search).toHaveBeenCalledTimes(3), { timeout: 2000 });
            expect(search).toHaveBeenLastCalledWith(expect.objectContaining({ searchTerm: 'torch' }));

            await act(async () => { narrow.resolve(page([torch])); });
            expect(await screen.findByText('Torch')).toBeInTheDocument();

            await act(async () => { broad.resolve(page([torch, lantern, { ...stone, name: 'Tome' }])); });
            expect(screen.getByText('Torch')).toBeInTheDocument();
            expect(screen.queryByText('Lantern')).not.toBeInTheDocument();
            expect(screen.queryByText('Tome')).not.toBeInTheDocument();
        });
    });

    // KNG-250: enchantment refs are an ordinary database table too; the scan creates refs and
    // definitions, so picking a row never creates anything.
    describe('Minecraft enchantment table (KNG-250)', () => {
        const sharpness = { id: 5, displayName: 'Sharpness', name: 'Sharpness', namespaceKey: 'minecraft:sharpness', isCustom: false, catalogStatus: 'Active' };
        const flashChaos = { id: 9, displayName: 'Flash Chaos', name: 'Flash Chaos', namespaceKey: 'knk:flash_chaos', isCustom: true, catalogStatus: 'Active' };

        it('searches enchantments without the SearchHybrid flag, keys rows by id and shows no badges', async () => {
            search.mockResolvedValue(page([sharpness, flashChaos]));
            render(<PagedEntityTable<Row> entityTypeName="MinecraftEnchantmentRef" columns={columns} initialQuery={{ filters: { Picker: 'true' } }} />);
            await screen.findByText('Sharpness');
            expect(search).toHaveBeenCalledTimes(1);
            expect(search.mock.calls[0][0].filters).toEqual({ Picker: 'true' });
            expect(search.mock.calls[0][0].filters).not.toHaveProperty('SearchHybrid');
            expect(screen.queryByText('New')).not.toBeInTheDocument();
            expect(bodyRows().map(r => r.getAttribute('data-row-key'))).toEqual(['id:5', 'id:9']);
        });

        it('selects a clicked enchantment without creating a ref or a definition', async () => {
            search.mockResolvedValue(page([sharpness, flashChaos]));
            const onSelectionChange = jest.fn();
            render(
                <PagedEntityTable<Row>
                    entityTypeName="MinecraftEnchantmentRef"
                    columns={columns}
                    selectionConfig={{ mode: 'single' }}
                    onSelectionChange={onSelectionChange}
                />
            );
            fireEvent.click(await screen.findByText('Flash Chaos'));
            expect(onSelectionChange).toHaveBeenCalledWith([flashChaos]);
            fireEvent.click(screen.getByText('Sharpness'));
            expect(onSelectionChange).toHaveBeenLastCalledWith([sharpness]);
            expect(enchantmentClient.create).not.toHaveBeenCalled();
            expect(definitionClient.create).not.toHaveBeenCalled();
        });

        it('matches a selected enchantment by id, not by namespaceKey', async () => {
            // Two rows with one key (a notation duplicate before the scan merges it) stay two selections.
            const duplicate = { ...sharpness, id: 6, name: 'Sharpness (old)' };
            search.mockResolvedValue(page([sharpness, duplicate]));
            const onSelectionChange = jest.fn();
            render(
                <PagedEntityTable<Row>
                    entityTypeName="MinecraftEnchantmentRef"
                    columns={columns}
                    selectionConfig={{ mode: 'multiple' }}
                    selectedItems={[sharpness]}
                    onSelectionChange={onSelectionChange}
                />
            );
            fireEvent.click(await screen.findByText('Sharpness (old)'));
            expect(onSelectionChange).toHaveBeenCalledWith([sharpness, duplicate]);
        });
    });
});
