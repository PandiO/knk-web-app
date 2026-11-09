import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PagedEntityTable, SelectionBarState } from '../PagedEntityTable';
import { PagedQueryDto } from '../../../types/dtos/common/PagedQuery';
import { getSearchFunctionForEntity } from '../../../utils/entityApiMapping';

/**
 * PandiO/knk-workspace#205: the dashboard's checkbox selection. Rows stay links and keep their click; the checkbox
 * column selects; the selection bar gets the selection, the table's columns in order, the query and the total.
 * Row-click selection (the wizard pickers) is covered by PagedEntityTable.test.tsx.
 */

jest.mock('../../../utils/entityApiMapping', () => ({
    getSearchFunctionForEntity: jest.fn()
}));
let mockMetadata: { baseMetadata: any[]; allMergedMetadata: any[] } = { baseMetadata: [], allMergedMetadata: [] };
jest.mock('../../../hooks/useEntityMetadata', () => ({
    useEntityMetadata: () => mockMetadata
}));

type Row = Record<string, any>;

const columns = [
    { key: 'id', label: 'ID', sortable: true },
    { key: 'name', label: 'Name', sortable: true },
];

const pages: Record<number, Row[]> = {
    1: [{ id: 1, name: 'Alpha' }, { id: 2, name: 'Bravo' }],
    2: [{ id: 3, name: 'Charlie' }],
};

let search: jest.Mock;
let barStates: SelectionBarState<Row>[];

beforeEach(() => {
    mockMetadata = { baseMetadata: [], allMergedMetadata: [] };
    barStates = [];
    search = jest.fn(async (query: PagedQueryDto) => ({
        items: pages[query.page] ?? [],
        totalCount: 3,
        page: query.page,
        pageSize: 2,
        totalPages: 2,
    }));
    (getSearchFunctionForEntity as jest.Mock).mockImplementation(() => search);
});

const Dashboardish: React.FC<{ onRowClick?: jest.Mock }> = ({ onRowClick }) => {
    const [selected, setSelected] = React.useState<Row[]>([]);
    const [query, setQuery] = React.useState<Partial<PagedQueryDto>>({ page: 1, pageSize: 2, sortBy: 'name', sortDescending: true });
    return (
        <PagedEntityTable<Row>
            entityTypeName="Town"
            columns={columns}
            query={query}
            onQueryChange={setQuery}
            onRowClick={onRowClick}
            rowHref={row => `/display/town/${row.id}`}
            selectionConfig={{ mode: 'multiple' }}
            selectionStyle="checkbox"
            selectedItems={selected}
            onSelectionChange={setSelected}
            showSelectionBanner={false}
            renderSelectionBar={state => {
                barStates.push(state);
                return (
                    <div data-testid="bar">
                        {state.selected.length} selected of {state.totalCount}
                        <button type="button" onClick={state.clearSelection}>clear</button>
                    </div>
                );
            }}
        />
    );
};

const lastBar = () => barStates[barStates.length - 1];

describe('PagedEntityTable checkbox selection (#205)', () => {
    it('keeps rows as links with their click while the checkboxes select', async () => {
        const onRowClick = jest.fn();
        render(<Dashboardish onRowClick={onRowClick} />);
        const link = await screen.findByRole('link', { name: '1' });
        expect(link).toHaveAttribute('href', '/display/town/1');
        fireEvent.click(screen.getByRole('checkbox', { name: 'Select Alpha' }));
        expect(onRowClick).not.toHaveBeenCalled();
        expect(screen.getByTestId('bar')).toHaveTextContent('1 selected of 3');
        fireEvent.click(screen.getByText('Bravo'));
        expect(onRowClick).toHaveBeenCalledWith({ id: 2, name: 'Bravo' });
        expect(screen.getByRole('checkbox', { name: 'Select Bravo' })).not.toBeChecked();
        // No check-mark lead in the link cell: the checkbox shows the state.
        expect(screen.queryByText('Selected:')).not.toBeInTheDocument();
    });

    it('keeps the selection across pages; the header box takes the shown page', async () => {
        render(<Dashboardish />);
        await screen.findByText('Alpha');
        fireEvent.click(screen.getByRole('checkbox', { name: 'Select all rows on this page' }));
        expect(screen.getByTestId('bar')).toHaveTextContent('2 selected of 3');
        fireEvent.click(screen.getByRole('button', { name: /next/i }));
        await screen.findByText('Charlie');
        expect(screen.getByRole('checkbox', { name: 'Select all rows on this page' })).not.toBeChecked();
        fireEvent.click(screen.getByRole('checkbox', { name: 'Select Charlie' }));
        expect(lastBar().selected.map(row => row.id)).toEqual([1, 2, 3]);
        // The header box on a fully selected page clears that page only.
        fireEvent.click(screen.getByRole('checkbox', { name: 'Select all rows on this page' }));
        expect(lastBar().selected.map(row => row.id)).toEqual([1, 2]);
        fireEvent.click(screen.getByRole('button', { name: 'clear' }));
        expect(lastBar().selected).toEqual([]);
    });

    it('gives the bar the table columns in order, the query and the total', async () => {
        mockMetadata = {
            baseMetadata: [{ entityName: 'Town', defaultTableColumns: ['name', 'id', 'createdAt'], fields: [], properties: [] }],
            allMergedMetadata: [],
        };
        render(<Dashboardish />);
        await screen.findByText('Alpha');
        await waitFor(() => expect(lastBar().loading).toBe(false));
        expect(lastBar().columns.map(column => [column.key, column.label])).toEqual([['name', 'Name'], ['id', 'ID'], ['createdAt', 'Created At']]);
        expect(lastBar().query).toMatchObject({ page: 1, sortBy: 'name', sortDescending: true });
        expect(lastBar().totalCount).toBe(3);
    });
});
