import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DashboardSelectionBar } from '../DashboardSelectionBar';
import { SelectionBarState } from '../../PagedEntityTable/PagedEntityTable';
import { usePermissions } from '../../../hooks/useStaffAccess';
import { getSearchFunctionForEntity } from '../../../utils/entityApiMapping';
import { downloadCsv } from '../../../utils/csv';
import { toastRequests } from '../../../utils/toast';
import { PagedQueryDto } from '../../../types/dtos/common/PagedQuery';

// PandiO/knk-workspace#205: the dashboard's bulk bar - "n selected", Export CSV behind knk.admin.export.

jest.mock('../../../hooks/useStaffAccess', () => ({
    EXPORT_PERMISSION_NODE: 'knk.admin.export',
    usePermissions: jest.fn(),
}));
jest.mock('../../../utils/entityApiMapping', () => ({ getSearchFunctionForEntity: jest.fn() }));
jest.mock('../../../utils/csv', () => ({
    ...jest.requireActual('../../../utils/csv'),
    downloadCsv: jest.fn(),
}));

const mockedPermissions = usePermissions as jest.Mock;
const mockedDownload = downloadCsv as jest.Mock;

type Row = { id: number; name: string; enabled?: boolean };

const state = (over: Partial<SelectionBarState<Row>> = {}): SelectionBarState<Row> => ({
    selected: [],
    clearSelection: jest.fn(),
    columns: [{ key: 'name', label: 'Name' }, { key: 'id', label: 'ID' }, { key: 'enabled', label: 'Enabled' }],
    query: { page: 2, pageSize: 10, searchTerm: 'north', sortBy: 'name', sortDescending: true, filters: {} },
    totalCount: 3,
    loading: false,
    ...over,
});

let toasts: Array<{ kind: string; message: string }>;
let subscription: { unsubscribe: () => void };
let search: jest.Mock;

beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 10, 8, 12, 0));
    toasts = [];
    subscription = toastRequests.subscribe(request => toasts.push({ kind: request.kind, message: request.message }));
    mockedPermissions.mockReturnValue({ 'knk.admin.export': 'allowed' });
    search = jest.fn(async (query: PagedQueryDto) => ({
        items: query.page === 1 ? [{ id: 1, name: 'Alpha', enabled: true }, { id: 2, name: 'Bravo, "B"', enabled: false }] : [],
        totalCount: 2, page: query.page, pageSize: 100, totalPages: 1,
    }));
    (getSearchFunctionForEntity as jest.Mock).mockReturnValue(search);
});

afterEach(() => {
    subscription.unsubscribe();
    jest.useRealTimers();
});

const renderBar = (s: SelectionBarState<Row>, actions?: React.ReactNode) =>
    render(<DashboardSelectionBar<Row> state={s} entityTypeName="Town" typeLabel="Town" actions={actions} />);

describe('DashboardSelectionBar (#205)', () => {
    it('asks for knk.admin.export and disables Export with the hint without it', () => {
        mockedPermissions.mockReturnValue({ 'knk.admin.export': 'denied' });
        renderBar(state());
        expect(mockedPermissions).toHaveBeenCalledWith(['knk.admin.export']);
        const button = screen.getByTestId('export-csv');
        expect(button).toBeDisabled();
        expect(screen.getByTestId('export-hint')).toHaveTextContent('Requires knk.admin.export');
        expect(button).toHaveAccessibleDescription('Requires knk.admin.export');
        expect(screen.getByTestId('selection-count')).toHaveTextContent(/^None selected$/);
    });

    it('keeps Export disabled without a hint while the check runs, and says so when it failed', () => {
        mockedPermissions.mockReturnValue({ 'knk.admin.export': 'checking' });
        const { rerender } = renderBar(state());
        expect(screen.getByTestId('export-csv')).toBeDisabled();
        expect(screen.queryByTestId('export-hint')).not.toBeInTheDocument();
        mockedPermissions.mockReturnValue({ 'knk.admin.export': 'error' });
        rerender(<DashboardSelectionBar<Row> state={state()} entityTypeName="Town" typeLabel="Town" />);
        expect(screen.getByTestId('export-hint')).toHaveTextContent("Couldn't check knk.admin.export");
    });

    it('shows the count and clears the selection', () => {
        const s = state({ selected: [{ id: 1, name: 'Alpha' }, { id: 3, name: 'Charlie' }] });
        renderBar(s);
        expect(screen.getByTestId('selection-count')).toHaveTextContent('2 selected');
        expect(screen.getByTestId('export-csv')).toHaveTextContent('Export CSV (2)');
        fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
        expect(s.clearSelection).toHaveBeenCalled();
    });

    it('exports the selected rows with the table columns, without asking the API', async () => {
        renderBar(state({ selected: [{ id: 3, name: 'Charlie', enabled: true }, { id: 1, name: 'Alpha' }] }));
        await act(async () => { fireEvent.click(screen.getByTestId('export-csv')); });
        expect(search).not.toHaveBeenCalled();
        expect(mockedDownload).toHaveBeenCalledWith('Town-2026-11-08.csv', 'Name,ID,Enabled\r\nCharlie,3,Yes\r\nAlpha,1,\r\n');
        expect(toasts).toEqual([{ kind: 'success', message: 'Exported 2 Town rows' }]);
    });

    it('with nothing selected exports the whole search from page 1 in the current sort', async () => {
        renderBar(state({ totalCount: 2 }));
        expect(screen.getByTestId('selection-count')).toHaveTextContent('None selected · Export takes all 2 results');
        await act(async () => { fireEvent.click(screen.getByTestId('export-csv')); });
        expect(getSearchFunctionForEntity).toHaveBeenCalledWith('Town');
        expect(search).toHaveBeenCalledWith(expect.objectContaining({ page: 1, pageSize: 100, searchTerm: 'north', sortBy: 'name', sortDescending: true }));
        expect(mockedDownload).toHaveBeenCalledWith('Town-2026-11-08.csv', 'Name,ID,Enabled\r\nAlpha,1,Yes\r\n"Bravo, ""B""",2,No\r\n');
        expect(toasts).toEqual([{ kind: 'success', message: 'Exported 2 Town rows' }]);
    });

    it('says beforehand and afterwards that a search over 10,000 rows is cut at the limit', async () => {
        search.mockImplementation(async (query: PagedQueryDto) => ({
            items: Array.from({ length: 100 }, (_, i) => ({ id: (query.page - 1) * 100 + i + 1, name: `T${i}` })),
            totalCount: 12345, page: query.page, pageSize: 100, totalPages: 124,
        }));
        renderBar(state({ totalCount: 12345 }));
        expect(screen.getByTestId('export-limit')).toHaveTextContent('Only the first 10,000 go into the file (limit).');
        await act(async () => { fireEvent.click(screen.getByTestId('export-csv')); });
        await waitFor(() => expect(mockedDownload).toHaveBeenCalled());
        expect(search).toHaveBeenCalledTimes(100);
        const csv: string = mockedDownload.mock.calls[0][1];
        expect(csv.split('\r\n').filter(Boolean)).toHaveLength(10001);
        expect(toasts).toEqual([{
            kind: 'warning',
            message: 'Exported the first 10,000 of 12,345 Town rows: an export holds at most 10,000. Narrow the search to export the rest.',
        }]);
    });

    it('says when the search has no rows, and when the rows could not be loaded', async () => {
        search.mockResolvedValueOnce({ items: [], totalCount: 0, page: 1, pageSize: 100, totalPages: 0 });
        renderBar(state({ totalCount: 1 }));
        await act(async () => { fireEvent.click(screen.getByTestId('export-csv')); });
        expect(mockedDownload).not.toHaveBeenCalled();
        expect(toasts).toEqual([{ kind: 'info', message: 'Nothing to export: no Town rows match the search.' }]);

        const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
        search.mockRejectedValueOnce(Object.assign(new Error('Forbidden'), { status: 403 }));
        await act(async () => { fireEvent.click(screen.getByTestId('export-csv')); });
        expect(toasts[1].kind).toBe('error');
        expect(toasts[1].message).toMatch(/^Export failed: /);
        error.mockRestore();
    });

    it('shows the progress and can be cancelled between pages', async () => {
        let release: () => void = () => undefined;
        search.mockImplementation((query: PagedQueryDto) => new Promise(resolve => {
            release = () => resolve({ items: [{ id: query.page, name: `P${query.page}` }], totalCount: 5, page: query.page, pageSize: 1, totalPages: 5 });
        }));
        renderBar(state({ totalCount: 5 }));
        fireEvent.click(screen.getByTestId('export-csv'));
        expect(screen.getByTestId('export-csv')).toHaveTextContent('Exporting… 0 / 5');
        expect(screen.getByTestId('export-csv')).toBeDisabled();
        await act(async () => { release(); });
        expect(screen.getByTestId('export-csv')).toHaveTextContent('Exporting… 1 / 5');
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        await act(async () => { release(); });
        expect(mockedDownload).not.toHaveBeenCalled();
        expect(toasts).toEqual([{ kind: 'info', message: 'Export cancelled' }]);
        expect(screen.getByTestId('export-csv')).toHaveTextContent('Export CSV');
    });

    it('has a slot for more bulk actions before Export (AM3: Delete)', () => {
        renderBar(state(), <button type="button">Delete (2)</button>);
        const buttons = screen.getAllByRole('button').map(button => button.textContent);
        expect(buttons.indexOf('Delete (2)')).toBeLessThan(buttons.findIndex(text => text?.startsWith('Export CSV')));
    });

    it('disables Export for an empty search', () => {
        renderBar(state({ totalCount: 0 }));
        expect(screen.getByTestId('export-csv')).toBeDisabled();
    });
});
