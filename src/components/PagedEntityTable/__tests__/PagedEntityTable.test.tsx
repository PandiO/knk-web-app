import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PagedEntityTable } from '../PagedEntityTable';
import { getSearchFunctionForEntity } from '../../../utils/entityApiMapping';

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
jest.mock('../../../apiClients/minecraftMaterialRefClient', () => ({ minecraftMaterialRefClient: {} }));
jest.mock('../../../apiClients/minecraftBlockRefClient', () => ({ minecraftBlockRefClient: {} }));
jest.mock('../../../apiClients/minecraftEnchantmentRefClient', () => ({ minecraftEnchantmentRefClient: {} }));
jest.mock('../../../apiClients/enchantmentDefinitionClient', () => ({ enchantmentDefinitionClient: {} }));

type Row = Record<string, any>;

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
});
