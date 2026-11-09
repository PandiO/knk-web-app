import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PagedEntityTable } from '../PagedEntityTable';
import { PagedQueryDto } from '../../../types/dtos/common/PagedQuery';
import { getSearchFunctionForEntity } from '../../../utils/entityApiMapping';

/**
 * PandiO/knk-workspace#39: controlled mode (page, search, sort from the caller, e.g. the URL), rows
 * as links (CRUD-4) and aria-sort. The uncontrolled mode the wizard's pickers use is covered by
 * PagedEntityTable.test.tsx and stays as it was.
 */

jest.mock('../../../utils/entityApiMapping', () => ({
    getSearchFunctionForEntity: jest.fn()
}));
jest.mock('../../../hooks/useEntityMetadata', () => ({
    useEntityMetadata: () => ({ baseMetadata: [], allMergedMetadata: [], configurations: [] })
}));

type Row = Record<string, any>;

const columns = [
    { key: 'id', label: 'ID', sortable: true },
    { key: 'name', label: 'Name', sortable: true },
    { key: 'note', label: 'Note' }
];

let search: jest.Mock;

beforeEach(() => {
    jest.clearAllMocks();
    search = jest.fn(async (query: PagedQueryDto) => ({
        items: [{ id: 1, name: 'Alpha', note: 'x' }, { id: 2, name: 'Bravo', note: 'y' }],
        totalCount: 35,
        page: query.page,
        pageSize: 10,
        totalPages: 4
    }));
    (getSearchFunctionForEntity as jest.Mock).mockImplementation(() => search);
});

/** A caller that keeps the query in its own state, like the dashboard keeps it in the URL. */
const Controlled: React.FC<{ initial: Partial<PagedQueryDto>; onChange: jest.Mock; rowHref?: (row: Row) => string | undefined; onRowClick?: (row: Row) => void }> = ({ initial, onChange, rowHref, onRowClick }) => {
    const [query, setQuery] = React.useState<Partial<PagedQueryDto>>(initial);
    return (
        <>
            <button type="button" onClick={() => setQuery({ page: 1, searchTerm: 'outside' })}>external</button>
            <PagedEntityTable<Row>
                entityTypeName="Town"
                columns={columns}
                query={query}
                onQueryChange={(next) => { onChange(next); setQuery(next); }}
                rowHref={rowHref}
                onRowClick={onRowClick}
            />
        </>
    );
};

describe('PagedEntityTable controlled mode (#39)', () => {
    it('fetches with the given page, search and sort, and shows them', async () => {
        render(<Controlled initial={{ page: 3, searchTerm: 'north', sortBy: 'name', sortDescending: true }} onChange={jest.fn()} />);
        await screen.findByText('Alpha');
        expect(search).toHaveBeenCalledTimes(1);
        expect(search).toHaveBeenCalledWith(expect.objectContaining({ page: 3, pageSize: 10, searchTerm: 'north', sortBy: 'name', sortDescending: true }));
        expect(screen.getByPlaceholderText('Search...')).toHaveValue('north');
        expect(screen.getByText('Page 3 of 4')).toBeInTheDocument();
    });

    it('sends page and sort changes to onQueryChange instead of keeping them', async () => {
        const onChange = jest.fn();
        render(<Controlled initial={{ page: 1 }} onChange={onChange} />);
        await screen.findByText('Alpha');

        fireEvent.click(screen.getAllByRole('button', { name: /Next/ })[0]);
        expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
        await waitFor(() => expect(search).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })));

        fireEvent.click(screen.getByRole('button', { name: /Name/ }));
        expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ sortBy: 'name', sortDescending: false }));
    });

    it('debounces the search box into onQueryChange on page 1', async () => {
        jest.useFakeTimers();
        try {
            const onChange = jest.fn();
            render(<Controlled initial={{ page: 3 }} onChange={onChange} />);
            await act(async () => { await Promise.resolve(); });
            fireEvent.change(screen.getByPlaceholderText('Search...'), { target: { value: 'gate' } });
            expect(onChange).not.toHaveBeenCalled();
            act(() => { jest.advanceTimersByTime(450); });
            expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ searchTerm: 'gate', page: 1 }));
        } finally {
            jest.useRealTimers();
        }
    });

    it('shows a search term changed from outside (Back/Forward) in the box', async () => {
        render(<Controlled initial={{ page: 1, searchTerm: 'north' }} onChange={jest.fn()} />);
        await screen.findByText('Alpha');
        fireEvent.click(screen.getByRole('button', { name: 'external' }));
        await waitFor(() => expect(screen.getByPlaceholderText('Search...')).toHaveValue('outside'));
        await waitFor(() => expect(search).toHaveBeenLastCalledWith(expect.objectContaining({ searchTerm: 'outside' })));
    });

    it('does not refetch when the caller re-renders with an equal query object', async () => {
        const { rerender } = render(
            <PagedEntityTable<Row> entityTypeName="Town" columns={columns} query={{ page: 2 }} onQueryChange={jest.fn()} />
        );
        await screen.findByText('Alpha');
        rerender(<PagedEntityTable<Row> entityTypeName="Town" columns={columns} query={{ page: 2 }} onQueryChange={jest.fn()} />);
        await screen.findByText('Alpha');
        expect(search).toHaveBeenCalledTimes(1);
    });

    it('moves a page past the end to the last page', async () => {
        search.mockImplementation(async (query: PagedQueryDto) => ({
            items: query.page > 2 ? [] : [{ id: 1, name: 'Alpha' }],
            totalCount: 15,
            page: query.page,
            pageSize: 10,
            totalPages: 2
        }));
        const onChange = jest.fn();
        render(<Controlled initial={{ page: 9 }} onChange={onChange} />);
        await waitFor(() => expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ page: 2 })));
        expect(await screen.findByText('Alpha')).toBeInTheDocument();
    });
});

describe('PagedEntityTable sort headers (#39)', () => {
    it('marks the sorted column with aria-sort and makes sortable headers buttons', async () => {
        render(<Controlled initial={{ page: 1, sortBy: 'name' }} onChange={jest.fn()} />);
        await screen.findByText('Alpha');
        const headers = screen.getAllByRole('columnheader');
        expect(headers[0]).toHaveAttribute('aria-sort', 'none');
        expect(headers[1]).toHaveAttribute('aria-sort', 'ascending');
        expect(headers[2]).not.toHaveAttribute('aria-sort');
        expect(within(headers[1]).getByRole('button', { name: /Name/ })).toBeInTheDocument();
        expect(within(headers[2]).queryByRole('button')).not.toBeInTheDocument();

        fireEvent.click(within(headers[1]).getByRole('button', { name: /Name/ }));
        await waitFor(() => expect(screen.getAllByRole('columnheader')[1]).toHaveAttribute('aria-sort', 'descending'));
    });

    it('keeps aria-sort in the uncontrolled mode too', async () => {
        render(<PagedEntityTable<Row> entityTypeName="Town" columns={columns} />);
        await screen.findByText('Alpha');
        fireEvent.click(screen.getByRole('button', { name: /ID/ }));
        await waitFor(() => expect(screen.getAllByRole('columnheader')[0]).toHaveAttribute('aria-sort', 'ascending'));
        expect(search).toHaveBeenLastCalledWith(expect.objectContaining({ sortBy: 'id', sortDescending: false }));
    });
});

describe('PagedEntityTable rows as links (#39 CRUD-4)', () => {
    const href = (row: Row) => `/display/Town/${row.id}`;
    let open: jest.SpyInstance;

    beforeEach(() => {
        open = jest.spyOn(window, 'open').mockImplementation(() => null);
    });
    afterEach(() => open.mockRestore());

    it('puts a link in the first cell; a plain click calls onRowClick instead of loading the page', async () => {
        const onRowClick = jest.fn();
        render(<Controlled initial={{}} onChange={jest.fn()} rowHref={href} onRowClick={onRowClick} />);
        const link = await screen.findByRole('link', { name: '1' });
        expect(link).toHaveAttribute('href', '/display/Town/1');

        const notCancelled = fireEvent.click(link);
        expect(notCancelled).toBe(false); // the app navigates, not the browser
        expect(onRowClick).toHaveBeenCalledTimes(1);
        expect(onRowClick).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
    });

    it('leaves Ctrl/Cmd/middle clicks on the link to the browser', async () => {
        const onRowClick = jest.fn();
        render(<Controlled initial={{}} onChange={jest.fn()} rowHref={href} onRowClick={onRowClick} />);
        const link = await screen.findByRole('link', { name: '2' });
        expect(fireEvent.click(link, { ctrlKey: true })).toBe(true);
        expect(fireEvent.click(link, { metaKey: true })).toBe(true);
        expect(onRowClick).not.toHaveBeenCalled();
        expect(open).not.toHaveBeenCalled();
    });

    it('opens the row in a new tab on a Ctrl-click or middle-click elsewhere on the row', async () => {
        const onRowClick = jest.fn();
        render(<Controlled initial={{}} onChange={jest.fn()} rowHref={href} onRowClick={onRowClick} />);
        const cell = await screen.findByText('Bravo');
        fireEvent.click(cell, { ctrlKey: true });
        expect(open).toHaveBeenCalledWith('/display/Town/2', '_blank', 'noopener');
        fireEvent(cell, new MouseEvent('auxclick', { bubbles: true, button: 1 }));
        expect(open).toHaveBeenCalledTimes(2);
        expect(onRowClick).not.toHaveBeenCalled();

        fireEvent.click(cell);
        expect(onRowClick).toHaveBeenCalledWith(expect.objectContaining({ id: 2 }));
    });

    it('has no links without rowHref or while rows are selectable', async () => {
        const { unmount } = render(<PagedEntityTable<Row> entityTypeName="Town" columns={columns} />);
        await screen.findByText('Alpha');
        expect(screen.queryByRole('link')).not.toBeInTheDocument();
        unmount();

        render(<PagedEntityTable<Row> entityTypeName="Town" columns={columns} rowHref={href} selectionConfig={{ mode: 'single' }} />);
        await screen.findByText('Alpha');
        expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });
});

// PandiO/knk-workspace#183: a live update refetches the page quietly (rows stay, no spinner).
describe('PagedEntityTable liveRefreshKey (#183)', () => {
    const Live: React.FC<{ liveKey: number }> = ({ liveKey }) => (
        <PagedEntityTable<Row> entityTypeName="Town" columns={columns} query={{ page: 2, searchTerm: 'north' }} liveRefreshKey={liveKey} />
    );

    it('does not fetch twice on mount, then refetches the same page without hiding the rows', async () => {
        const { rerender } = render(<Live liveKey={0} />);
        await screen.findByText('Alpha');
        expect(search).toHaveBeenCalledTimes(1);

        let answer: (value: unknown) => void = () => undefined;
        search.mockImplementationOnce(() => new Promise(resolve => { answer = resolve; }));
        rerender(<Live liveKey={1} />);

        expect(search).toHaveBeenCalledTimes(2);
        expect(search).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2, searchTerm: 'north' }));
        expect(screen.getByText('Alpha')).toBeInTheDocument();
        expect(screen.queryByRole('status', { name: 'Loading' })).not.toBeInTheDocument();

        await act(async () => {
            answer({ items: [{ id: 1, name: 'Alpha renamed', note: 'x' }], totalCount: 1, page: 2, pageSize: 10, totalPages: 1 });
        });
        expect(await screen.findByText('Alpha renamed')).toBeInTheDocument();
        expect(screen.queryByText('Bravo')).not.toBeInTheDocument();
    });
});
