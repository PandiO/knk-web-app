import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { RelationPicker, RelationPickerProps } from '../RelationPicker';
import { Dialog } from '../../Dialog';
import { lookupClient } from '../../../apiClients/lookupClient';

/**
 * PandiO/knk-workspace#191: the wizard's relation picker searches as you type (250 ms), lists the rows this form
 * created first, picks with the mouse or the keyboard, keeps "Open full table" as the fallback, and on the #280 model
 * searches api/Lookup (names only) for a viewer without a read node of the type.
 */

let mockMetadata: Array<Record<string, unknown>> = [];
jest.mock('../../../hooks/useEntityMetadata', () => ({
    useEntityMetadata: () => ({ baseMetadata: mockMetadata, allMergedMetadata: [], configurations: [] }),
}));
let mockHeld = new Set<string>();
jest.mock('../../../hooks/useStaffAccess', () => ({
    usePermissions: (nodes: string[]) => Object.fromEntries(nodes.map(node => [node, mockHeld.has(node) ? 'allowed' : 'denied'])),
}));
const mockSearch = jest.fn();
jest.mock('../../../utils/entityApiMapping', () => ({
    getSearchFunctionForEntity: () => mockSearch,
}));
jest.mock('../../../apiClients/lookupClient', () => ({
    lookupClient: { search: jest.fn(), get: jest.fn() },
}));
let mockTableProps: Record<string, any> = {};
jest.mock('../../PagedEntityTable/PagedEntityTable', () => ({
    PagedEntityTable: (props: Record<string, any>) => {
        mockTableProps = props;
        return <div data-testid="full-table">full table</div>;
    },
}));

const page = (items: Array<Record<string, unknown>>, totalCount = items.length) =>
    ({ items, totalCount, page: 1, pageSize: 8, totalPages: 1 });

const STREETS = [
    { id: 1, name: 'Main Street', townName: 'Cinix' },
    { id: 2, name: 'Castle Hill', townName: 'Cinix' },
];

function Harness(props: Partial<RelationPickerProps> & { initial?: Array<Record<string, any>> }) {
    const { initial = [], ...rest } = props;
    const [selected, setSelected] = React.useState<Array<Record<string, any>>>(initial);
    return (
        <>
            <RelationPicker
                entityTypeName="Street"
                label="Select Street"
                mode="single"
                selected={selected}
                onChange={next => { setSelected(next); rest.onChange?.(next); }}
                {...rest}
            />
            <pre data-testid="value">{JSON.stringify(selected)}</pre>
        </>
    );
}

const box = () => screen.getByRole('combobox', { name: /Street/ });
const value = () => JSON.parse(screen.getByTestId('value').textContent || '[]');

beforeEach(() => {
    jest.clearAllMocks();
    mockMetadata = [];
    mockHeld = new Set();
    mockTableProps = {};
    mockSearch.mockResolvedValue(page(STREETS, 14));
});

describe('RelationPicker (#191)', () => {
    it('fetches nothing until the box is used, then shows the first matches with a count', async () => {
        render(<Harness filters={{ townId: '3' }} />);
        expect(mockSearch).not.toHaveBeenCalled();
        expect(box()).toHaveAttribute('aria-expanded', 'false');

        fireEvent.focus(box());
        expect(box()).toHaveAttribute('aria-expanded', 'true');
        expect(await screen.findByRole('option', { name: /Main Street/ })).toBeInTheDocument();
        expect(mockSearch).toHaveBeenCalledWith(expect.objectContaining({ page: 1, pageSize: 8, searchTerm: '', filters: { townId: '3' } }));
        expect(screen.getByRole('status')).toHaveTextContent('2 of 14 shown. Keep typing to narrow it down, or open the full table.');
    });

    it('searches after a pause in typing, once per term', async () => {
        jest.useFakeTimers();
        try {
            render(<Harness />);
            fireEvent.focus(box());
            await act(async () => { await Promise.resolve(); });
            fireEvent.change(box(), { target: { value: 'c' } });
            fireEvent.change(box(), { target: { value: 'ca' } });
            fireEvent.change(box(), { target: { value: 'cas' } });
            await act(async () => { jest.advanceTimersByTime(249); });
            expect(mockSearch).toHaveBeenCalledTimes(1);
            await act(async () => { jest.advanceTimersByTime(1); });
            expect(mockSearch).toHaveBeenCalledTimes(2);
            expect(mockSearch).toHaveBeenLastCalledWith(expect.objectContaining({ searchTerm: 'cas' }));
        } finally {
            jest.useRealTimers();
        }
    });

    it('picks with the arrow keys and Enter, keeps the whole row, and closes the list', async () => {
        render(<Harness />);
        fireEvent.focus(box());
        await screen.findByRole('option', { name: /Castle Hill/ });
        fireEvent.keyDown(box(), { key: 'ArrowDown' });
        fireEvent.keyDown(box(), { key: 'ArrowDown' });
        const active = box().getAttribute('aria-activedescendant');
        expect(document.getElementById(active!)).toHaveTextContent('Castle Hill');
        fireEvent.keyDown(box(), { key: 'Enter' });

        expect(value()).toEqual([{ id: 2, name: 'Castle Hill', townName: 'Cinix' }]);
        expect(box()).toHaveAttribute('aria-expanded', 'false');
    });

    it('closes the list on Escape without closing the dialog around the form', async () => {
        const onClose = jest.fn();
        render(<Dialog open onClose={onClose} title="Create Gate"><Harness /></Dialog>);
        fireEvent.focus(box());
        await screen.findByRole('option', { name: /Main Street/ });
        fireEvent.keyDown(box(), { key: 'Escape' });
        expect(box()).toHaveAttribute('aria-expanded', 'false');
        expect(onClose).not.toHaveBeenCalled();
        fireEvent.keyDown(box(), { key: 'Escape' });
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('lists the rows this form created first, marked New, filtered like the page (KNG-136)', async () => {
        mockSearch.mockResolvedValue(page([STREETS[0]]));
        const pinnedRows = [
            { key: 'street:77', row: { id: 77, name: 'Market Lane' } },
            { key: 'street:78', row: { id: 78, name: 'Harbour Road' } },
        ];
        render(<Harness pinnedRows={pinnedRows} />);
        fireEvent.focus(box());
        await screen.findByRole('option', { name: /Main Street/ });
        const options = screen.getAllByRole('option');
        expect(options.map(o => o.textContent)).toEqual([
            expect.stringContaining('Market Lane'), expect.stringContaining('Harbour Road'), expect.stringContaining('Main Street'),
        ]);
        expect(screen.getByText('Created in this form')).toBeInTheDocument();
        expect(within(options[0]).getByText('New')).toBeInTheDocument();

        fireEvent.change(box(), { target: { value: 'market' } });
        await waitFor(() => expect(mockSearch).toHaveBeenLastCalledWith(expect.objectContaining({ searchTerm: 'market' })));
        await waitFor(() => expect(screen.queryByRole('option', { name: /Harbour Road/ })).not.toBeInTheDocument());
        expect(screen.getByRole('option', { name: /Market Lane/ })).toBeInTheDocument();
    });

    it('adds and removes in a list, and stops at the maximum', async () => {
        render(<Harness mode="multiple" label="Add Streets" max={1} initial={[]} />);
        fireEvent.focus(box());
        fireEvent.click(await screen.findByRole('option', { name: /Main Street/ }));
        expect(value()).toEqual([STREETS[0]]);
        expect(screen.getByRole('option', { name: /Main Street/ })).toHaveAttribute('aria-selected', 'true');
        // The list stays open for more; the maximum is reached, so the others can't be picked.
        const other = screen.getByRole('option', { name: /Castle Hill/ });
        expect(other).toHaveAttribute('aria-disabled', 'true');
        fireEvent.click(other);
        expect(value()).toHaveLength(1);

        fireEvent.click(screen.getByRole('option', { name: /Main Street/ }));
        expect(value()).toEqual([]);
    });

    it('opens the full table with the filters and pinned rows; a pick there closes it', async () => {
        const pinnedRows = [{ key: 'street:77', row: { id: 77, name: 'Market Lane' } }];
        render(<Harness filters={{ townId: '3' }} pinnedRows={pinnedRows} refreshKey="k1" />);
        fireEvent.focus(box());
        fireEvent.click(await screen.findByRole('button', { name: 'Open full table' }));

        const dialog = screen.getByRole('dialog', { name: 'Select Street' });
        expect(within(dialog).getByTestId('full-table')).toBeInTheDocument();
        expect(mockTableProps).toMatchObject({
            entityTypeName: 'Street',
            initialQuery: { page: 1, pageSize: 10, filters: { townId: '3' } },
            selectionConfig: { mode: 'single' },
            pinnedRows,
            refreshKey: 'k1',
        });
        act(() => mockTableProps.onSelectionChange([{ id: 9, name: 'Quay' }]));
        expect(value()).toEqual([{ id: 9, name: 'Quay' }]);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('says why a search failed', async () => {
        mockSearch.mockRejectedValue(Object.assign(new Error('x'), { status: 403, response: { message: "You don't have access to Street." } }));
        render(<Harness />);
        fireEvent.focus(box());
        expect(await screen.findByText("You don't have access to Street.")).toBeInTheDocument();
    });
});

describe('RelationPicker lookup mode (#280)', () => {
    const world = ['knk.admin.world', 'knk.road.manage'];
    beforeEach(() => {
        mockMetadata = [{ entityName: 'Street', displayName: 'Street', fields: [], readNodes: world, lookupSearchable: true }];
        mockHeld = new Set(['knk.admin.content']);
        (lookupClient.search as jest.Mock).mockResolvedValue({
            items: [{ id: 4, label: 'Castle Hill 4', detail: 'Cinix' }, { id: 5, label: 'Quay', detail: 'Valoria' }],
            total: 2,
        });
    });

    it('searches api/Lookup without a read node: names and one line, no full table, picks a bare reference', async () => {
        render(<Harness />);
        fireEvent.focus(box());
        const option = await screen.findByRole('option', { name: /Castle Hill 4/ });
        expect(lookupClient.search).toHaveBeenCalledWith('Street', '', 1, 8);
        expect(mockSearch).not.toHaveBeenCalled();
        expect(within(option).getByText('Cinix')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Open full table' })).not.toBeInTheDocument();
        expect(screen.getByRole('status')).toHaveTextContent('Names only: the full Street table needs one of: knk.admin.world, knk.road.manage.');

        fireEvent.click(option);
        expect(value()).toEqual([{ id: 4, name: 'Castle Hill 4' }]);
    });

    it('uses the full search once the viewer holds a read node', async () => {
        mockHeld.add('knk.road.manage');
        render(<Harness />);
        fireEvent.focus(box());
        await screen.findByRole('option', { name: /Main Street/ });
        expect(lookupClient.search).not.toHaveBeenCalled();
        expect(screen.getByRole('button', { name: 'Open full table' })).toBeInTheDocument();
    });

    it('drops prefer filters, applies excludeIds, and refuses filters that would narrow the list', async () => {
        const { unmount } = render(<Harness filters={{ preferTownId: '5', excludeIds: '5' }} />);
        fireEvent.focus(box());
        await screen.findByRole('option', { name: /Castle Hill 4/ });
        expect(screen.queryByRole('option', { name: /Quay/ })).not.toBeInTheDocument();
        unmount();

        (lookupClient.search as jest.Mock).mockClear();
        render(<Harness filters={{ siegeScenarioId: '1' }} />);
        fireEvent.focus(box());
        expect(await screen.findByText(/narrowed by siegeScenarioId, which only the full Street search can do/)).toBeInTheDocument();
        expect(lookupClient.search).not.toHaveBeenCalled();
    });

    it('says so when the type has no lookup either', async () => {
        mockMetadata = [{ ...mockMetadata[0], lookupSearchable: false }];
        render(<Harness />);
        fireEvent.focus(box());
        expect(await screen.findByText("Street records can't be searched here. Requires one of: knk.admin.world, knk.road.manage."))
            .toBeInTheDocument();
        expect(lookupClient.search).not.toHaveBeenCalled();
    });
});
