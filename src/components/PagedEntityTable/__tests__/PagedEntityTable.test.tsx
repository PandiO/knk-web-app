import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PagedEntityTable } from '../PagedEntityTable';
import { getSearchFunctionForEntity } from '../../../utils/entityApiMapping';
import { minecraftMaterialRefClient } from '../../../apiClients/minecraftMaterialRefClient';
import { minecraftBlockRefClient } from '../../../apiClients/minecraftBlockRefClient';

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
jest.mock('../../../apiClients/minecraftEnchantmentRefClient', () => ({ minecraftEnchantmentRefClient: {} }));
jest.mock('../../../apiClients/enchantmentDefinitionClient', () => ({ enchantmentDefinitionClient: {} }));

type Row = Record<string, any>;

const materialClient = minecraftMaterialRefClient as unknown as { create: jest.Mock; persistFromCatalog: jest.Mock };
const blockClient = minecraftBlockRefClient as unknown as { create: jest.Mock; getOrCreate: jest.Mock };

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

    // KNG-200 phase 4: in database mode every row is saved, so only an unsaved hybrid row gets a badge.
    it('shows the New badge only on unsaved hybrid rows and never an "Existing" badge', async () => {
        search.mockResolvedValue(page([
            { id: 7, name: 'Torch', namespaceKey: 'minecraft:torch', isPersisted: true },
            { id: null, name: 'Lantern', namespaceKey: 'minecraft:lantern', isPersisted: false },
            { id: 9, name: 'Stone', namespaceKey: 'minecraft:stone' }
        ]));
        render(<PagedEntityTable<Row> entityTypeName="MinecraftMaterialRef" columns={columns} />);
        await screen.findByText('Torch');
        const [torch, lantern, stone] = bodyRows();
        expect(within(lantern).getByText('New')).toBeInTheDocument();
        expect(within(torch).queryByText('New')).not.toBeInTheDocument();
        expect(within(stone).queryByText('New')).not.toBeInTheDocument();
        expect(screen.queryByText('Existing')).not.toBeInTheDocument();
        expect(search).toHaveBeenCalledWith(expect.objectContaining({ filters: expect.objectContaining({ SearchHybrid: 'true' }) }));
    });

    // KNG-200 phase 1: the hybrid picker before the first scan.
    describe('hybrid Minecraft rows (KNG-200)', () => {
        const torch = { id: 0, name: 'Torch', namespaceKey: 'minecraft:torch', category: 'ITEM', isPersisted: false };
        const lantern = { id: null, name: 'Lantern', namespaceKey: 'minecraft:lantern', category: 'ITEM', isPersisted: false };
        const stone = { id: 3, name: 'Stone', namespaceKey: 'minecraft:stone', category: 'ITEM', isPersisted: true };

        it('keys unsaved rows by namespaceKey, not by id 0, and selects them apart', async () => {
            search.mockResolvedValue(page([torch, lantern, stone]));
            materialClient.persistFromCatalog.mockResolvedValue({ id: 21, namespaceKey: 'minecraft:torch' });
            const onSelectionChange = jest.fn();
            const { rerender } = render(
                <PagedEntityTable<Row>
                    entityTypeName="MinecraftMaterialRef"
                    columns={columns}
                    selectionConfig={{ mode: 'multiple' }}
                    selectedItems={[]}
                    onSelectionChange={onSelectionChange}
                />
            );
            await screen.findByText('Torch');
            expect(bodyRows().map(r => r.getAttribute('data-row-key'))).toEqual(['ns:minecraft:torch', 'ns:minecraft:lantern', 'id:3']);

            fireEvent.click(screen.getByText('Torch'));
            await waitFor(() => expect(onSelectionChange).toHaveBeenCalled());
            const selection = onSelectionChange.mock.calls[0][0];
            rerender(
                <PagedEntityTable<Row>
                    entityTypeName="MinecraftMaterialRef"
                    columns={columns}
                    selectionConfig={{ mode: 'multiple' }}
                    selectedItems={selection}
                    onSelectionChange={onSelectionChange}
                />
            );
            // Only the torch row is selected; the other unsaved row is not "the same" any more.
            await waitFor(() => expect(screen.getByText('Torch').closest('tr')!.className).toContain('bg-green-50'));
            expect(screen.getByText('Lantern').closest('tr')!.className).not.toContain('bg-green-50');
        });

        it('saves an unsaved material through get-or-create, not create, and marks the row saved', async () => {
            search.mockResolvedValue(page([torch, lantern]));
            materialClient.persistFromCatalog.mockResolvedValue({ id: 21, namespaceKey: 'minecraft:torch' });
            const onSelectionChange = jest.fn();
            render(
                <PagedEntityTable<Row>
                    entityTypeName="MinecraftMaterialRef"
                    columns={columns}
                    selectionConfig={{ mode: 'single' }}
                    onSelectionChange={onSelectionChange}
                />
            );
            fireEvent.click(await screen.findByText('Torch'));
            await waitFor(() => expect(onSelectionChange).toHaveBeenCalledWith([{ ...torch, id: 21, isPersisted: true }]));
            expect(materialClient.persistFromCatalog).toHaveBeenCalledWith('minecraft:torch', 'ITEM', undefined);
            expect(materialClient.create).not.toHaveBeenCalled();

            const [torchRow, lanternRow] = bodyRows();
            expect(within(torchRow).queryByText('New')).not.toBeInTheDocument();
            expect(torchRow.getAttribute('data-row-key')).toBe('id:21');
            expect(within(lanternRow).getByText('New')).toBeInTheDocument();
        });

        it('marks the row saved when the server spells the key differently', async () => {
            search.mockResolvedValue(page([{ ...torch, namespaceKey: 'Torch' }]));
            materialClient.persistFromCatalog.mockResolvedValue({ id: 21, namespaceKey: 'minecraft:torch' });
            render(
                <PagedEntityTable<Row> entityTypeName="MinecraftMaterialRef" columns={columns} selectionConfig={{ mode: 'single' }} />
            );
            fireEvent.click(await screen.findByText('Torch'));
            await waitFor(() => expect(bodyRows()[0].getAttribute('data-row-key')).toBe('id:21'));
        });

        it('saves an unsaved block state through the block get-or-create', async () => {
            const north = { id: 0, name: 'Oak Stairs', namespaceKey: 'minecraft:oak_stairs', blockStateString: 'minecraft:oak_stairs[facing=north]', logicalType: 'STAIRS', iconUrl: 'n.png', isPersisted: false };
            const south = { ...north, name: 'Oak Stairs (south)', blockStateString: 'minecraft:oak_stairs[facing=south]', iconUrl: 's.png' };
            search.mockResolvedValue(page([north, south]));
            blockClient.getOrCreate.mockResolvedValue({ id: 40, namespaceKey: 'minecraft:oak_stairs' });
            const onSelectionChange = jest.fn();
            render(
                <PagedEntityTable<Row>
                    entityTypeName="MinecraftBlockRef"
                    columns={columns}
                    selectionConfig={{ mode: 'single' }}
                    onSelectionChange={onSelectionChange}
                />
            );
            await screen.findByText('Oak Stairs');
            expect(bodyRows().map(r => r.getAttribute('data-row-key'))).toEqual([
                'bs:minecraft:oak_stairs|minecraft:oak_stairs[facing=north]',
                'bs:minecraft:oak_stairs|minecraft:oak_stairs[facing=south]'
            ]);

            fireEvent.click(screen.getByText('Oak Stairs'));
            await waitFor(() => expect(onSelectionChange).toHaveBeenCalledWith([{ ...north, id: 40, isPersisted: true }]));
            expect(blockClient.getOrCreate).toHaveBeenCalledWith({
                namespaceKey: 'minecraft:oak_stairs',
                blockStateString: 'minecraft:oak_stairs[facing=north]',
                logicalType: 'STAIRS',
                iconUrl: 'n.png'
            });
            expect(blockClient.create).not.toHaveBeenCalled();
            // Only the saved state loses its badge, not the other state of the same block.
            const [northRow, southRow] = bodyRows();
            expect(within(northRow).queryByText('New')).not.toBeInTheDocument();
            expect(within(southRow).getByText('New')).toBeInTheDocument();
        });

        it("shows the API's refusal when saving fails and selects nothing", async () => {
            search.mockResolvedValue(page([torch]));
            materialClient.persistFromCatalog.mockRejectedValue(
                Object.assign(new Error('A material with this key already exists.'), { status: 409 })
            );
            const onSelectionChange = jest.fn();
            render(
                <PagedEntityTable<Row>
                    entityTypeName="MinecraftMaterialRef"
                    columns={columns}
                    selectionConfig={{ mode: 'single' }}
                    onSelectionChange={onSelectionChange}
                />
            );
            fireEvent.click(await screen.findByText('Torch'));
            expect(await screen.findByText('A material with this key already exists.')).toBeInTheDocument();
            expect(onSelectionChange).not.toHaveBeenCalled();
        });

        it('ignores a slow earlier search that answers after a later one', async () => {
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

        it('select all saves the unsaved rows one by one before adding them', async () => {
            search.mockResolvedValue(page([stone, torch, lantern]));
            const order: string[] = [];
            materialClient.persistFromCatalog.mockImplementation(async (key: string) => {
                order.push(`start ${key}`);
                await Promise.resolve();
                order.push(`end ${key}`);
                return { id: key === 'minecraft:torch' ? 21 : 22, namespaceKey: key };
            });
            const onSelectionChange = jest.fn();
            render(
                <PagedEntityTable<Row>
                    entityTypeName="MinecraftMaterialRef"
                    columns={columns}
                    selectionConfig={{ mode: 'multiple' }}
                    selectedItems={[]}
                    onSelectionChange={onSelectionChange}
                />
            );
            await screen.findByText('Stone');
            fireEvent.click(screen.getByLabelText('Select all on this page'));

            await waitFor(() => expect(onSelectionChange).toHaveBeenCalledWith([
                stone,
                { ...torch, id: 21, isPersisted: true },
                { ...lantern, id: 22, isPersisted: true }
            ]));
            expect(order).toEqual(['start minecraft:torch', 'end minecraft:torch', 'start minecraft:lantern', 'end minecraft:lantern']);
            expect(materialClient.create).not.toHaveBeenCalled();
            await waitFor(() => expect(screen.queryByText('New')).not.toBeInTheDocument());
        });

        it('select all respects max and saves only the rows it adds', async () => {
            search.mockResolvedValue(page([stone, torch, lantern]));
            materialClient.persistFromCatalog.mockResolvedValue({ id: 21, namespaceKey: 'minecraft:torch' });
            const onSelectionChange = jest.fn();
            render(
                <PagedEntityTable<Row>
                    entityTypeName="MinecraftMaterialRef"
                    columns={columns}
                    selectionConfig={{ mode: 'multiple', max: 2 }}
                    selectedItems={[]}
                    onSelectionChange={onSelectionChange}
                />
            );
            await screen.findByText('Stone');
            fireEvent.click(screen.getByLabelText('Select all on this page'));

            await waitFor(() => expect(onSelectionChange).toHaveBeenCalledWith([stone, { ...torch, id: 21, isPersisted: true }]));
            expect(materialClient.persistFromCatalog).toHaveBeenCalledTimes(1);
        });
    });
});
