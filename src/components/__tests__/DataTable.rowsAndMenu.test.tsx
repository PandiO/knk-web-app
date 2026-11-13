import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DataTable, DataTableColumn } from '../DataTable';

// PandiO/knk-workspace#404 (row lines), #405 (sticky actions/checkbox columns).

interface Town { id: number; name: string }

const towns: Town[] = [{ id: 1, name: 'Northwatch' }, { id: 2, name: 'Southgate' }, { id: 3, name: 'Eastholm' }];
const columns: DataTableColumn<Town>[] = [{ key: 'name', header: 'Name' }, { key: 'id', header: 'ID' }];
const bodyRows = () => within(screen.getAllByRole('rowgroup')[1]).getAllByRole('row');

describe('DataTable row lines (#404)', () => {
    it('puts no border on any row, so every row looks the same; the lines are on the cells', () => {
        render(<DataTable columns={columns} rows={towns} rowKey={t => String(t.id)} />);
        expect(screen.getByRole('table')).toHaveClass('border-separate');
        for (const row of bodyRows()) {
            expect(row.className).not.toMatch(/border/);
            for (const cell of within(row).getAllByRole('cell')) expect(cell).toHaveClass('border-b', 'border-line');
        }
        // The same classes on the first and the later rows.
        expect(bodyRows()[1].className).toBe(bodyRows()[0].className);
        expect(bodyRows()[2].className).toBe(bodyRows()[0].className);
    });

    it('marks a selected row with a bar in its first cell only', () => {
        render(<DataTable columns={columns} rows={towns} rowKey={t => String(t.id)} isRowSelected={t => t.id === 2} />);
        expect(screen.getAllByTestId('selected-edge')).toHaveLength(1);
        expect(within(within(bodyRows()[1]).getAllByRole('cell')[0]).getByTestId('selected-edge')).toBeInTheDocument();
    });

    it('puts the bar in the checkbox cell with a checkbox column', () => {
        render(
            <DataTable
                columns={columns}
                rows={towns}
                rowKey={t => String(t.id)}
                selection={{ isSelected: t => t.id === 1, onToggle: jest.fn() }}
            />
        );
        const checkboxCell = within(bodyRows()[0]).getAllByRole('cell')[0];
        expect(within(checkboxCell).getByTestId('selected-edge')).toBeInTheDocument();
        expect(within(checkboxCell).getByTestId('row-select')).toBeInTheDocument();
    });
});

describe('DataTable sticky columns (#405)', () => {
    it('keeps the actions column on the right and the checkbox column on the left, with the row background', () => {
        render(
            <DataTable
                columns={columns}
                rows={towns}
                rowKey={t => String(t.id)}
                selection={{ isSelected: () => false, onToggle: jest.fn(), onToggleAll: jest.fn() }}
                rowActions={t => <button type="button" aria-label={`Edit ${t.name}`}>E</button>}
            />
        );
        const header = screen.getAllByRole('columnheader');
        expect(header[0]).toHaveClass('sticky', 'left-0', 'bg-inherit');
        expect(header[header.length - 1]).toHaveClass('sticky', 'right-0', 'bg-inherit');
        expect(header[header.length - 1]).toHaveTextContent('Actions');
        for (const row of bodyRows()) {
            const cells = within(row).getAllByRole('cell');
            // Opaque: a colour of its own (the page background's translucency skips .sticky, #231).
            expect(cells[0]).toHaveClass('sticky', 'left-0', 'bg-surface');
            expect(cells[cells.length - 1]).toHaveClass('sticky', 'right-0', 'bg-surface');
        }
        expect(screen.getAllByTestId('row-actions')).toHaveLength(3);
        expect(screen.getByRole('button', { name: 'Edit Southgate' })).toBeInTheDocument();
    });

    it('shows the edge shadows only while columns are scrolled under the sticky ones', () => {
        render(
            <DataTable
                columns={columns}
                rows={towns}
                rowKey={t => String(t.id)}
                selection={{ isSelected: () => false, onToggle: jest.fn() }}
                rowActions={() => <button type="button">E</button>}
            />
        );
        const scroller = screen.getByTestId('data-table-scroll');
        const actionsCell = () => screen.getAllByTestId('row-actions')[0];
        const checkboxCell = () => within(bodyRows()[0]).getAllByRole('cell')[0];
        expect(actionsCell()).not.toHaveClass('shadow-sticky-right');

        Object.defineProperty(scroller, 'scrollWidth', { configurable: true, value: 1200 });
        Object.defineProperty(scroller, 'clientWidth', { configurable: true, value: 400 });
        scroller.scrollLeft = 0;
        fireEvent.scroll(scroller);
        expect(actionsCell()).toHaveClass('shadow-sticky-right');
        expect(checkboxCell()).not.toHaveClass('shadow-sticky-left');

        scroller.scrollLeft = 800;
        fireEvent.scroll(scroller);
        expect(actionsCell()).not.toHaveClass('shadow-sticky-right');
        expect(checkboxCell()).toHaveClass('shadow-sticky-left');
    });
});
