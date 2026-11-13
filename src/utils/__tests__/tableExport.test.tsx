import React from 'react';
import { PagedQueryDto } from '../../types/dtos/common/PagedQuery';
import { ColumnDefinition } from '../../types/common';
import { buildTableCsv, exportQueryOf, readExportRows, selectedIds } from '../tableExport';
import { cellText, reactNodeToText } from '../tableCells';

// PandiO/knk-workspace#205: the export's rows (selection, or the search across all pages; #280 AM3 through the API) and its CSV text.

type Row = { id: number; name?: string | null; [key: string]: unknown };

const baseQuery: PagedQueryDto = { page: 3, pageSize: 10, searchTerm: 'north', sortBy: 'name', sortDescending: true, filters: { CategoryId: '4', Empty: '', Gone: null, Flag: true } };

describe('exportQueryOf (#280 AM3)', () => {
    it('sends the search, the non-empty filters as text and the sort, never the page', () => {
        expect(exportQueryOf(baseQuery)).toEqual({
            searchTerm: 'north', filters: { CategoryId: '4', Flag: 'true' }, sortBy: 'name', sortDescending: true,
        });
        expect(exportQueryOf({ page: 1, pageSize: 10, searchTerm: '  ' })).toEqual({
            searchTerm: null, filters: {}, sortBy: null, sortDescending: false,
        });
    });
});

describe('readExportRows (#280 AM3: POST api/Dashboard/export)', () => {
    it('exports the whole search through the endpoint with the table query', async () => {
        const call = jest.fn(async () => ({ items: [{ id: 1 }, { id: 2 }] as Row[], total: 12000, truncated: true }));
        const result = await readExportRows<Row>(call, [], baseQuery);
        expect(call).toHaveBeenCalledWith({ query: exportQueryOf(baseQuery) });
        expect(result).toEqual({ items: [{ id: 1 }, { id: 2 }], total: 12000, truncated: true });
    });

    it('re-reads a selection by id and keeps the order it was ticked in', async () => {
        const call = jest.fn(async () => ({ items: [{ id: 1, name: 'A2' }, { id: 3, name: 'C2' }, { id: 7, name: 'G2' }] as Row[], total: 3, truncated: false }));
        const ticked = [{ id: 7, name: 'G' }, { id: 1, name: 'A' }, { id: 7, name: 'G' }, { id: 3, name: 'C' }, { id: 9, name: 'gone' }];
        const result = await readExportRows<Row>(call, ticked, baseQuery);
        expect(call).toHaveBeenCalledWith({ ids: [7, 1, 3, 9] });
        // 9 was deleted meanwhile: left out; the current values are used.
        expect(result.items.map(row => row.name)).toEqual(['G2', 'A2', 'C2']);
        expect(result.truncated).toBe(false);
    });

    it('passes a refusal on', async () => {
        const call = jest.fn(async () => { throw Object.assign(new Error('nope'), { status: 403 }); });
        await expect(readExportRows<Row>(call, [], baseQuery)).rejects.toThrow('nope');
    });

    it('takes each positive id once', () => {
        expect(selectedIds([{ id: 2 }, { id: '3' }, { id: 2 }, { id: null }, { id: -1 }, {}])).toEqual([2, 3]);
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
