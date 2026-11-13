import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DataTable, DataTableColumn } from '../DataTable';

// PandiO/knk-workspace#404 (row lines).

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
