import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DataTable, DataTableColumn, DataTableSort, nextSort } from '../DataTable';
import { Pager, totalPagesOf } from '../Pager';

// PandiO/knk-workspace#187: the shared table and pager (row links and aria-sort came from #39's PagedEntityTable).

interface Player { id: number; name: string; coins: number; note?: string | null }

const players: Player[] = [
    { id: 1, name: 'Pandi', coins: 1200, note: null },
    { id: 2, name: 'Steve', coins: 5 },
];

const columns: DataTableColumn<Player>[] = [
    { key: 'name', header: 'Name', sortable: true },
    { key: 'coins', header: 'Coins', sortable: true, align: 'right', cell: p => p.coins.toLocaleString('en-US') },
    { key: 'note', header: 'Note' },
];

const bodyRows = () => within(screen.getAllByRole('rowgroup')[1]).getAllByRole('row');

describe('DataTable (#187)', () => {
    it('renders headers, cells, a caption and stable row keys; a missing value is a dash', () => {
        render(<DataTable caption="Players" columns={columns} rows={players} rowKey={p => `id:${p.id}`} />);
        expect(screen.getByRole('table', { name: 'Players' })).toBeInTheDocument();
        expect(screen.getAllByRole('columnheader').map(h => h.textContent)).toEqual(['Name', 'Coins', 'Note']);
        expect(bodyRows().map(r => r.getAttribute('data-row-key'))).toEqual(['id:1', 'id:2']);
        expect(within(bodyRows()[0]).getByText('1,200')).toBeInTheDocument();
        expect(within(bodyRows()[0]).getAllByText('-')).toHaveLength(1);
    });

    it('marks the sorted column with aria-sort and sorts with a header button', () => {
        const onSortChange = jest.fn();
        render(<DataTable columns={columns} rows={players} sort={{ key: 'coins', descending: true }} onSortChange={onSortChange} />);
        const headers = screen.getAllByRole('columnheader');
        expect(headers[0]).toHaveAttribute('aria-sort', 'none');
        expect(headers[1]).toHaveAttribute('aria-sort', 'descending');
        expect(headers[2]).not.toHaveAttribute('aria-sort');

        fireEvent.click(within(headers[0]).getByRole('button', { name: /Name/ }));
        expect(onSortChange).toHaveBeenCalledWith('name');
        expect(within(headers[2]).queryByRole('button')).not.toBeInTheDocument();
    });

    it('nextSort goes ascending, descending, off', () => {
        let sort: DataTableSort | null = null;
        sort = nextSort(sort, 'name');
        expect(sort).toEqual({ key: 'name', descending: false });
        sort = nextSort(sort, 'name');
        expect(sort).toEqual({ key: 'name', descending: true });
        expect(nextSort(sort, 'name')).toBeNull();
        expect(nextSort(sort, 'coins')).toEqual({ key: 'coins', descending: false });
    });

    describe('row links', () => {
        const renderLinked = (onRowClick = jest.fn()) => {
            render(
                <DataTable
                    columns={columns}
                    rows={players}
                    rowKey={p => String(p.id)}
                    rowHref={p => `/players/${p.id}`}
                    onRowClick={onRowClick}
                    rowActions={p => <button type="button" onClick={jest.fn()}>Freeze {p.name}</button>}
                />
            );
            return onRowClick;
        };

        it('makes the first cell a real link to the row', () => {
            renderLinked();
            expect(screen.getByRole('link', { name: 'Pandi' })).toHaveAttribute('href', '/players/1');
            expect(screen.getAllByRole('link')).toHaveLength(2);
        });

        it('a plain click on the link or the row opens it in the app, once', () => {
            const onRowClick = renderLinked();
            fireEvent.click(screen.getByRole('link', { name: 'Pandi' }));
            expect(onRowClick).toHaveBeenCalledTimes(1);
            expect(onRowClick).toHaveBeenCalledWith(players[0]);

            fireEvent.click(screen.getByText('5'));
            expect(onRowClick).toHaveBeenLastCalledWith(players[1]);
        });

        it('leaves a Ctrl-click on the link to the browser and opens a Ctrl-click on the row in a new tab', () => {
            const open = jest.spyOn(window, 'open').mockImplementation(() => null);
            const onRowClick = renderLinked();
            fireEvent.click(screen.getByRole('link', { name: 'Pandi' }), { ctrlKey: true });
            expect(onRowClick).not.toHaveBeenCalled();

            fireEvent.click(screen.getByText('1,200'), { ctrlKey: true });
            expect(open).toHaveBeenCalledWith('/players/1', '_blank', 'noopener');
            expect(onRowClick).not.toHaveBeenCalled();

            fireEvent(screen.getByText('1,200'), new MouseEvent('auxclick', { bubbles: true, button: 1 }));
            expect(open).toHaveBeenCalledTimes(2);
            open.mockRestore();
        });

        it('a row action keeps its own click', () => {
            const onRowClick = renderLinked();
            expect(screen.getAllByRole('columnheader')[3]).toHaveTextContent('Actions');
            fireEvent.click(screen.getByRole('button', { name: 'Freeze Steve' }));
            expect(onRowClick).not.toHaveBeenCalled();
        });

        it('puts the link in the chosen column', () => {
            render(<DataTable columns={columns} rows={players} rowHref={p => `/players/${p.id}`} linkColumn="coins" />);
            expect(screen.getByRole('link', { name: '1,200' })).toHaveAttribute('href', '/players/1');
        });
    });

    it('shows sections with a heading row, leading elements and selection', () => {
        render(
            <DataTable
                columns={columns}
                isRowSelected={p => p.id === 2}
                rowLeading={p => (p.id === 2 ? <span>✓</span> : null)}
                sections={[
                    { key: 'pinned', label: 'Created in this form', tone: 'warning', rows: [{ key: 'pinned:9', row: { id: 9, name: 'Harbour', coins: 0 }, leading: <span>New</span> }] },
                    { key: 'page', label: 'Search results', rows: players.map(p => ({ key: String(p.id), row: p })) },
                    { key: 'empty', label: 'Never shown', rows: [] },
                ]}
            />
        );
        const rows = bodyRows();
        expect(rows.map(r => r.textContent?.trim().split(/\s+/)[0])).toEqual(['Created', 'NewHarbour0-', 'Search', 'Pandi1,200-', '✓Steve5-']);
        expect(screen.queryByText('Never shown')).not.toBeInTheDocument();
        expect(rows[4].className).toContain('bg-success-soft');
    });

    it('shows the empty state across the table, and a spinner while loading', () => {
        const { rerender } = render(<DataTable columns={columns} rows={[]} empty="No matching players." />);
        const cell = screen.getByText('No matching players.');
        expect(cell.tagName).toBe('TD');
        expect(cell).toHaveAttribute('colspan', '3');

        rerender(<DataTable columns={columns} rows={players} loading />);
        expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
        expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });
});

describe('Pager (#187)', () => {
    it('is a named nav with the range, the page and Previous/Next', () => {
        const onPageChange = jest.fn();
        render(<Pager page={2} pageSize={20} totalCount={1045} onPageChange={onPageChange} label="All players pages" noun="players" />);
        const nav = screen.getByRole('navigation', { name: 'All players pages' });
        expect(nav).toHaveTextContent('Showing 21 to 40 of 1,045 players');
        expect(nav).toHaveTextContent('Page 2 of 53');

        fireEvent.click(screen.getByRole('button', { name: /Previous/ }));
        expect(onPageChange).toHaveBeenLastCalledWith(1);
        fireEvent.click(screen.getByRole('button', { name: /Next/ }));
        expect(onPageChange).toHaveBeenLastCalledWith(3);
    });

    it('turns Previous off on the first page, Next on the last, both while disabled', () => {
        const { rerender } = render(<Pager page={1} pageSize={10} totalCount={15} onPageChange={jest.fn()} />);
        expect(screen.getByRole('button', { name: /Previous/ })).toBeDisabled();
        expect(screen.getByRole('button', { name: /Next/ })).toBeEnabled();

        rerender(<Pager page={2} pageSize={10} totalCount={15} onPageChange={jest.fn()} />);
        expect(screen.getByRole('button', { name: /Next/ })).toBeDisabled();
        expect(screen.getByText(/Showing/)).toHaveTextContent('Showing 11 to 15 of 15 results');

        rerender(<Pager page={2} pageSize={10} totalCount={30} onPageChange={jest.fn()} disabled />);
        expect(screen.getByRole('button', { name: /Previous/ })).toBeDisabled();
        expect(screen.getByRole('button', { name: /Next/ })).toBeDisabled();
    });

    it('counts at least one page', () => {
        expect(totalPagesOf(0, 20)).toBe(1);
        expect(totalPagesOf(41, 20)).toBe(3);
        expect(totalPagesOf(10, 0)).toBe(10);
    });
});
