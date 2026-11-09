import React from 'react';
import { PagedQueryDto, PagedResultDto } from '../../types/dtos/common/PagedQuery';
import { ColumnDefinition } from '../../types/common';
import { buildTableCsv, ExportCancelledError, readSearchRows, selectionRows } from '../tableExport';
import { cellText, reactNodeToText } from '../tableCells';

// PandiO/knk-workspace#205: the export's rows (selection, or the search across all pages) and its CSV text.

type Row = { id: number; name?: string | null; [key: string]: unknown };

/** A list API over `total` rows named Row 1…; `clamp` mimics an endpoint that serves fewer per page. */
const fakeSearch = (total: number, clamp?: number) => jest.fn(async (query: PagedQueryDto): Promise<PagedResultDto<Row>> => {
    const size = clamp ? Math.min(query.pageSize, clamp) : query.pageSize;
    const start = (query.page - 1) * size;
    const items = Array.from({ length: Math.max(0, Math.min(size, total - start)) }, (_, i) => ({ id: start + i + 1, name: `Row ${start + i + 1}` }));
    return { items, totalCount: total, page: query.page, pageSize: size, totalPages: Math.ceil(total / size) };
});

const baseQuery: PagedQueryDto = { page: 3, pageSize: 10, searchTerm: 'north', sortBy: 'name', sortDescending: true, filters: { CategoryId: '4' } };

describe('readSearchRows (#205)', () => {
    it('reads every page of the search in its sort and filters, from page 1', async () => {
        const search = fakeSearch(250);
        const progress = jest.fn();
        const result = await readSearchRows(search, baseQuery, { onProgress: progress });
        expect(result.items).toHaveLength(250);
        expect(result).toMatchObject({ total: 250, truncated: false });
        expect(search).toHaveBeenCalledTimes(3);
        expect(search.mock.calls.map(([q]) => q.page)).toEqual([1, 2, 3]);
        search.mock.calls.forEach(([q]) => expect(q).toMatchObject({
            pageSize: 100, searchTerm: 'north', sortBy: 'name', sortDescending: true, filters: { CategoryId: '4' },
        }));
        expect(progress).toHaveBeenLastCalledWith(250, 250);
    });

    it('follows an endpoint that clamps the page size', async () => {
        const search = fakeSearch(120, 50);
        const result = await readSearchRows(search, baseQuery);
        expect(result.items.map(r => r.id)).toEqual(Array.from({ length: 120 }, (_, i) => i + 1));
        expect(search).toHaveBeenCalledTimes(3);
    });

    it('stops at the limit and says the result is truncated', async () => {
        const search = fakeSearch(10050);
        const result = await readSearchRows(search, baseQuery);
        expect(result.items).toHaveLength(10000);
        expect(result).toMatchObject({ total: 10050, truncated: true });
        expect(search).toHaveBeenCalledTimes(100);
        const small = await readSearchRows(fakeSearch(30), baseQuery, { limit: 25, pageSize: 10 });
        expect(small).toMatchObject({ total: 30, truncated: true });
        expect(small.items).toHaveLength(25);
    });

    it('skips a row an earlier page already held (pages shifted by an insert)', async () => {
        const pages: Row[][] = [[{ id: 1 }, { id: 2 }], [{ id: 2 }, { id: 3 }]];
        const search = jest.fn(async (q: PagedQueryDto) => ({ items: pages[q.page - 1] ?? [], totalCount: 4, page: q.page, pageSize: 2, totalPages: 2 }));
        const result = await readSearchRows(search, baseQuery, { pageSize: 2 });
        expect(result.items.map(r => r.id)).toEqual([1, 2, 3]);
        expect(result.truncated).toBe(false);
    });

    it('ends on an empty page and on an empty search', async () => {
        const search = jest.fn(async (q: PagedQueryDto) => ({ items: [], totalCount: 0, page: q.page, pageSize: 100, totalPages: 0 }));
        await expect(readSearchRows(search, baseQuery)).resolves.toEqual({ items: [], total: 0, truncated: false });
        expect(search).toHaveBeenCalledTimes(1);
    });

    it('stops with ExportCancelledError when cancelled between pages', async () => {
        const search = fakeSearch(500);
        let cancel = false;
        const promise = readSearchRows(search, baseQuery, { onProgress: () => { cancel = true; }, isCancelled: () => cancel });
        await expect(promise).rejects.toBeInstanceOf(ExportCancelledError);
        expect(search).toHaveBeenCalledTimes(1);
    });

    it('passes on a failed request', async () => {
        const search = jest.fn(async () => { throw Object.assign(new Error('nope'), { status: 403 }); });
        await expect(readSearchRows(search, baseQuery)).rejects.toThrow('nope');
    });
});

describe('selectionRows (#205)', () => {
    it('keeps the selection in its order and caps it', () => {
        expect(selectionRows([{ id: 2 }, { id: 1 }])).toEqual({ items: [{ id: 2 }, { id: 1 }], total: 2, truncated: false });
        expect(selectionRows([{ id: 1 }, { id: 2 }, { id: 3 }], 2)).toEqual({ items: [{ id: 1 }, { id: 2 }], total: 3, truncated: true });
    });
});

const Kind = ({ isCustom }: { isCustom?: boolean | null }) => <span className="pill">{isCustom ? 'Custom' : 'Vanilla'}</span>;
const WithHook = () => {
    const [value] = React.useState('hooked');
    return <span>{value}</span>;
};
const Memo = React.memo(({ text }: { text: string }) => <b>{text}</b>);
const Forward = React.forwardRef<HTMLSpanElement, { text: string }>(({ text }, ref) => <span ref={ref}>{text}</span>);

describe('reactNodeToText and cellText (#205)', () => {
    it('reads the text of rendered cells', () => {
        expect(reactNodeToText('a')).toBe('a');
        expect(reactNodeToText(5)).toBe('5');
        expect(reactNodeToText(null)).toBe('');
        expect(reactNodeToText(true)).toBe('');
        expect(reactNodeToText(<span>Gate <b>North</b></span>)).toBe('Gate North');
        expect(reactNodeToText(<>{['a', 'b']}</>)).toBe('ab');
        expect(reactNodeToText(<img src="x.png" alt="Diamond sword" />)).toBe('Diamond sword');
        expect(reactNodeToText(<img src="x.png" alt="" />)).toBe('');
        expect(reactNodeToText(<Kind isCustom />)).toBe('Custom');
        expect(reactNodeToText(<Memo text="memo" />)).toBe('memo');
        expect(reactNodeToText(<Forward text="fwd" />)).toBe('fwd');
    });

    it('gives an empty text for a component that needs to render (hooks)', () => {
        const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
        expect(reactNodeToText(<WithHook />)).toBe('');
        error.mockRestore();
    });

    it('shows default cells as the table does, with a missing value empty', () => {
        const row = { id: 3, enabled: true, hidden: false, category: { name: 'Swords' }, Owner: { title: 'Lord' }, nothing: null, nested: { inner: { value: 7 } } };
        const col = (key: string): ColumnDefinition<any> => ({ key, label: key });
        expect(cellText(row, col('id'))).toBe('3');
        expect(cellText(row, col('enabled'))).toBe('Yes');
        expect(cellText(row, col('hidden'))).toBe('No');
        expect(cellText(row, col('category'))).toBe('Swords');
        expect(cellText(row, col('owner'))).toBe('Lord');
        expect(cellText(row, col('nothing'))).toBe('');
        expect(cellText(row, col('missing'))).toBe('');
        expect(cellText(row, col('nested.inner.value'))).toBe('7');
        expect(cellText(row, col('NESTED.Inner.VALUE'))).toBe('7');
        expect(cellText(row, { key: 'x', label: 'X', render: r => <span>{`${r.id} /\n x`}</span> })).toBe('3 / x');
    });
});

describe('buildTableCsv (#205)', () => {
    it('writes the columns in table order with the readable values', () => {
        const columns: ColumnDefinition<any>[] = [
            { key: 'id', label: 'ID' },
            { key: 'name', label: 'Name' },
            { key: 'isCustom', label: 'Kind', render: row => <Kind isCustom={row.isCustom} /> },
            { key: 'health', label: 'Health', render: row => `${row.healthCurrent ?? 0}/${row.healthMax ?? '-'}` },
            { key: 'enabled', label: 'Enabled' },
        ];
        const rows = [
            { id: 1, name: 'North, "Gate"', isCustom: true, healthCurrent: 5, healthMax: 10, enabled: true },
            { id: 2, name: null, isCustom: false, enabled: false },
        ];
        expect(buildTableCsv(columns, rows)).toBe(
            'ID,Name,Kind,Health,Enabled\r\n'
            + '1,"North, ""Gate""",Custom,5/10,Yes\r\n'
            + '2,,Vanilla,0/-,No\r\n'
        );
    });

    it('writes only the header for no rows', () => {
        expect(buildTableCsv([{ key: 'id', label: 'ID' }], [])).toBe('ID\r\n');
    });
});
