import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DashboardSelectionBar } from '../DashboardSelectionBar';
import { SelectionBarState } from '../../PagedEntityTable/PagedEntityTable';
import { dashboardClient } from '../../../apiClients/dashboardClient';
import { downloadCsv } from '../../../utils/csv';
import { toastRequests } from '../../../utils/toast';

// PandiO/knk-workspace#205: the dashboard's bulk bar - "n selected", Export CSV behind the type's export nodes
// (#280: knk.admin.export + the area node), rows read by POST api/Dashboard/export (AM3).

jest.mock('../../../apiClients/dashboardClient', () => ({ dashboardClient: { export: jest.fn() } }));
jest.mock('../../../utils/csv', () => ({
    ...jest.requireActual('../../../utils/csv'),
    downloadCsv: jest.fn(),
}));

const mockedDownload = downloadCsv as jest.Mock;
const mockedExport = dashboardClient.export as jest.Mock;

type Row = { id: number; name: string; enabled?: boolean };

const ALLOWED = { allowed: true, checking: false, hint: null };

const state = (over: Partial<SelectionBarState<Row>> = {}): SelectionBarState<Row> => ({
    selected: [],
    clearSelection: jest.fn(),
    columns: [{ key: 'name', label: 'Name' }, { key: 'id', label: 'ID' }, { key: 'enabled', label: 'Enabled' }],
    query: { page: 2, pageSize: 10, searchTerm: 'north', sortBy: 'name', sortDescending: true, filters: { CategoryId: '4', Empty: '' } },
    totalCount: 3,
    loading: false,
    ...over,
});

let toasts: Array<{ kind: string; message: string }>;
let subscription: { unsubscribe: () => void };

beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 10, 8, 12, 0));
    toasts = [];
    subscription = toastRequests.subscribe(request => toasts.push({ kind: request.kind, message: request.message }));
    mockedExport.mockResolvedValue({
        items: [{ id: 1, name: 'Alpha', enabled: true }, { id: 2, name: 'Bravo, "B"', enabled: false }], total: 2, truncated: false,
    });
});

afterEach(() => {
    subscription.unsubscribe();
    jest.useRealTimers();
});

const renderBar = (s: SelectionBarState<Row>, actions?: React.ReactNode, gate = ALLOWED, busy = false) =>
    render(<DashboardSelectionBar<Row> state={s} entityTypeName="Town" typeLabel="Town" exportGate={gate} actions={actions} busy={busy} />);

describe('DashboardSelectionBar (#205, #280 AM3)', () => {
    it('disables Export with the hint without the export nodes', () => {
        renderBar(state(), undefined, { allowed: false, checking: false, hint: 'Requires knk.admin.export' });
        const button = screen.getByTestId('export-csv');
        expect(button).toBeDisabled();
        expect(screen.getByTestId('export-hint')).toHaveTextContent('Requires knk.admin.export');
        expect(button).toHaveAccessibleDescription('Requires knk.admin.export');
        expect(screen.getByTestId('selection-count')).toHaveTextContent(/^None selected$/);
    });

    it('keeps Export disabled without a hint while the check runs', () => {
        renderBar(state(), undefined, { allowed: false, checking: true, hint: null });
        expect(screen.getByTestId('export-csv')).toBeDisabled();
        expect(screen.queryByTestId('export-hint')).not.toBeInTheDocument();
    });

    it('shows the count and clears the selection', () => {
        const s = state({ selected: [{ id: 1, name: 'Alpha' }, { id: 3, name: 'Charlie' }] });
        renderBar(s);
        expect(screen.getByTestId('selection-count')).toHaveTextContent('2 selected');
        expect(screen.getByTestId('export-csv')).toHaveTextContent('Export CSV (2)');
        fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
        expect(s.clearSelection).toHaveBeenCalled();
    });

    it('exports the selected rows by id, re-read by the API, in the order they were ticked', async () => {
        mockedExport.mockResolvedValue({ items: [{ id: 1, name: 'Alpha' }, { id: 3, name: 'Charlie now', enabled: true }], total: 2, truncated: false });
        renderBar(state({ selected: [{ id: 3, name: 'Charlie', enabled: true }, { id: 1, name: 'Alpha' }] }));
        await act(async () => { fireEvent.click(screen.getByTestId('export-csv')); });
        expect(mockedExport).toHaveBeenCalledWith('Town', { ids: [3, 1] });
        expect(mockedDownload).toHaveBeenCalledWith('Town-2026-11-08.csv', 'Name,ID,Enabled\r\nCharlie now,3,Yes\r\nAlpha,1,\r\n');
        expect(toasts).toEqual([{ kind: 'success', message: 'Exported 2 Town rows' }]);
    });

    it('with nothing selected exports the whole search through the endpoint in the current sort', async () => {
        renderBar(state({ totalCount: 2 }));
        expect(screen.getByTestId('selection-count')).toHaveTextContent('None selected · Export takes all 2 results');
        await act(async () => { fireEvent.click(screen.getByTestId('export-csv')); });
        expect(mockedExport).toHaveBeenCalledWith('Town', {
            query: { searchTerm: 'north', filters: { CategoryId: '4' }, sortBy: 'name', sortDescending: true },
        });
        expect(mockedDownload).toHaveBeenCalledWith('Town-2026-11-08.csv', 'Name,ID,Enabled\r\nAlpha,1,Yes\r\n"Bravo, ""B""",2,No\r\n');
        expect(toasts).toEqual([{ kind: 'success', message: 'Exported 2 Town rows' }]);
    });

    it('says beforehand and afterwards that a search over 10,000 rows is cut at the limit', async () => {
        mockedExport.mockResolvedValue({
            items: Array.from({ length: 10000 }, (_, i) => ({ id: i + 1, name: `T${i}` })), total: 12345, truncated: true,
        });
        renderBar(state({ totalCount: 12345 }));
        expect(screen.getByTestId('export-limit')).toHaveTextContent('Only the first 10,000 go into the file (limit).');
        await act(async () => { fireEvent.click(screen.getByTestId('export-csv')); });
        const csv: string = mockedDownload.mock.calls[0][1];
        expect(csv.split('\r\n').filter(Boolean)).toHaveLength(10001);
        expect(toasts).toEqual([{
            kind: 'warning',
            message: 'Exported the first 10,000 of 12,345 Town rows: an export holds at most 10,000. Narrow the search to export the rest.',
        }]);
    });

    it('says when the search has no rows, and when the API refused', async () => {
        mockedExport.mockResolvedValueOnce({ items: [], total: 0, truncated: false });
        renderBar(state({ totalCount: 1 }));
        await act(async () => { fireEvent.click(screen.getByTestId('export-csv')); });
        expect(mockedDownload).not.toHaveBeenCalled();
        expect(toasts).toEqual([{ kind: 'info', message: 'Nothing to export: no Town rows match the search.' }]);

        const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
        mockedExport.mockRejectedValueOnce(Object.assign(new Error('Requires the knk.admin.world permission.'), { status: 403 }));
        await act(async () => { fireEvent.click(screen.getByTestId('export-csv')); });
        expect(toasts[1]).toEqual({ kind: 'error', message: 'Export failed: Requires the knk.admin.world permission.' });
        error.mockRestore();
    });

    it('shows that it runs, and Cancel drops the answer', async () => {
        let release: () => void = () => undefined;
        mockedExport.mockImplementation(() => new Promise(resolve => {
            release = () => resolve({ items: [{ id: 1, name: 'A' }], total: 5, truncated: false });
        }));
        renderBar(state({ totalCount: 5 }));
        fireEvent.click(screen.getByTestId('export-csv'));
        expect(screen.getByTestId('export-csv')).toHaveTextContent('Exporting 5…');
        expect(screen.getByTestId('export-csv')).toBeDisabled();
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        await act(async () => { release(); });
        expect(mockedDownload).not.toHaveBeenCalled();
        expect(toasts).toEqual([{ kind: 'info', message: 'Export cancelled' }]);
        expect(screen.getByTestId('export-csv')).toHaveTextContent('Export CSV');
    });

    it('has a slot for more bulk actions before Export (Delete)', () => {
        renderBar(state(), <button type="button">Delete (2)</button>);
        const buttons = screen.getAllByRole('button').map(button => button.textContent);
        expect(buttons.indexOf('Delete (2)')).toBeLessThan(buttons.findIndex(text => text?.startsWith('Export CSV')));
    });

    it('waits while a bulk action runs, and for an empty search', () => {
        const { rerender } = renderBar(state({ selected: [{ id: 1, name: 'A' }] }), undefined, ALLOWED, true);
        expect(screen.getByTestId('export-csv')).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Clear' })).toBeDisabled();
        rerender(<DashboardSelectionBar<Row> state={state({ totalCount: 0 })} entityTypeName="Town" typeLabel="Town" exportGate={ALLOWED} />);
        expect(screen.getByTestId('export-csv')).toBeDisabled();
    });
});
