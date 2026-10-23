import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PagedEntityTable } from '../PagedEntityTable';
import { getSearchFunctionForEntity } from '../../../utils/entityApiMapping';

/**
 * KNG-263: item blueprint tables have a Category filter. It sends CategoryId (the API includes
 * every child category), lists the category tree, keeps pinned rows of child categories and isn't
 * offered when the caller already fixes the category.
 */

jest.mock('../../../utils/entityApiMapping', () => ({
    getSearchFunctionForEntity: jest.fn()
}));
jest.mock('../../../hooks/useEntityMetadata', () => ({
    useEntityMetadata: () => ({ baseMetadata: [], allMergedMetadata: [], configurations: [] })
}));
const mockGetAll = jest.fn();
jest.mock('../../../apiClients/categoryClient', () => ({
    CategoryClient: { getInstance: () => ({ getAll: mockGetAll }) }
}));

type Row = Record<string, any>;

const columns = [
    { key: 'id', label: 'ID', sortable: true },
    { key: 'name', label: 'Name', sortable: true }
];
const page = (items: Row[]) => ({ items, totalCount: items.length, page: 1, pageSize: 10, totalPages: 1 });

let search: jest.Mock;

beforeEach(() => {
    jest.clearAllMocks();
    mockGetAll.mockResolvedValue([
        { id: '1', name: 'Weapons' },
        { id: '2', name: 'Swords', parentCategoryId: '1' },
        { id: '3', name: 'Bows', parentCategoryId: '1' },
        { id: '5', name: 'Armor' }
    ]);
    search = jest.fn(async () => page([{ id: 10, name: 'Iron Sword', categoryId: 2 }]));
    (getSearchFunctionForEntity as jest.Mock).mockImplementation(() => search);
});

const lastFilters = () => search.mock.calls[search.mock.calls.length - 1][0].filters;

describe('PagedEntityTable category filter', () => {
    it('lists the category tree and sends CategoryId, page 1, when a category is chosen', async () => {
        render(<PagedEntityTable<Row> entityTypeName="ItemBlueprint" columns={columns} />);
        await screen.findByText('Iron Sword');
        const select = screen.getByLabelText('Category filter');
        await waitFor(() => expect(within(select).getAllByRole('option')).toHaveLength(5));
        expect(within(select).getAllByRole('option').map(o => o.textContent?.replace(/ /g, ' ').trim()))
            .toEqual(['All categories', 'Armor', 'Weapons', '└ Bows', '└ Swords']);

        fireEvent.change(select, { target: { value: '1' } });
        await waitFor(() => expect(lastFilters()).toEqual({ CategoryId: '1' }));
        expect(search.mock.calls[search.mock.calls.length - 1][0].page).toBe(1);

        fireEvent.change(select, { target: { value: '' } });
        await waitFor(() => expect(lastFilters()).toEqual({}));
    });

    it('keeps the other filters when the category changes', async () => {
        render(<PagedEntityTable<Row> entityTypeName="ItemBlueprint" columns={columns}
                                      initialQuery={{ filters: { excludeIds: '4' } }} />);
        await screen.findByText('Iron Sword');
        await waitFor(() => expect(within(screen.getByLabelText('Category filter')).getAllByRole('option')).toHaveLength(5));

        fireEvent.change(screen.getByLabelText('Category filter'), { target: { value: '1' } });

        await waitFor(() => expect(lastFilters()).toEqual({ excludeIds: '4', CategoryId: '1' }));
    });

    it('keeps a pinned row of a child category under its parent category', async () => {
        search.mockImplementation(async () => page([]));
        render(
            <PagedEntityTable<Row>
                entityTypeName="ItemBlueprint"
                columns={columns}
                pinnedRows={[
                    { key: 'ib:7', row: { id: 7, name: 'New Sword', categoryId: 2 } },
                    { key: 'ib:8', row: { id: 8, name: 'New Helmet', categoryId: 5 } }
                ]}
            />
        );
        await screen.findByText('New Sword');
        await waitFor(() => expect(within(screen.getByLabelText('Category filter')).getAllByRole('option')).toHaveLength(5));

        fireEvent.change(screen.getByLabelText('Category filter'), { target: { value: '1' } });

        await waitFor(() => expect(screen.queryByText('New Helmet')).not.toBeInTheDocument());
        expect(screen.getByText('New Sword')).toBeInTheDocument();
    });

    it('is not offered when the caller fixes the category, nor for other entities', async () => {
        const { unmount } = render(<PagedEntityTable<Row> entityTypeName="ItemBlueprint" columns={columns}
                                                          initialQuery={{ filters: { categoryId: '5' } }} />);
        await screen.findByText('Iron Sword');
        expect(screen.queryByLabelText('Category filter')).not.toBeInTheDocument();
        unmount();

        render(<PagedEntityTable<Row> entityTypeName="District" columns={columns} />);
        await screen.findByText('Iron Sword');
        expect(screen.queryByLabelText('Category filter')).not.toBeInTheDocument();
    });
});
