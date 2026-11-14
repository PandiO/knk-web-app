import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DataTable, DataTableColumn } from '../DataTable';
import { ContextMenuItem } from '../ContextMenu';

// PandiO/knk-workspace#404 (row lines), #405 (sticky actions/checkbox columns), #406 (row context menu).

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

describe('DataTable row context menu (#406)', () => {
    const view = jest.fn();
    const remove = jest.fn();
    const items = (town: Town): ContextMenuItem[] => [
        { key: 'view', label: 'View', onSelect: () => view(town) },
        { key: 'edit', label: 'Edit', onSelect: jest.fn(), disabled: true, hint: 'Requires knk.admin.content' },
        { key: 'delete', label: 'Delete', onSelect: () => remove(town), danger: true },
    ];
    const renderMenuTable = (menu: (town: Town) => ContextMenuItem[] = items) => render(
        <div>
            <button type="button">outside</button>
            <DataTable
                columns={columns}
                rows={towns}
                rowKey={t => String(t.id)}
                rowHref={t => `/display/town/${t.id}`}
                onRowClick={jest.fn()}
                rowContextMenu={menu}
                rowContextMenuLabel={t => `Actions for ${t.name}`}
            />
        </div>
    );

    beforeEach(() => {
        view.mockReset();
        remove.mockReset();
    });

    it('opens on a right-click with the row\'s items and focuses the first; the browser menu is suppressed', () => {
        renderMenuTable();
        const notCancelled = fireEvent.contextMenu(bodyRows()[1], { clientX: 120, clientY: 80 });
        expect(notCancelled).toBe(false);
        const menu = screen.getByRole('menu', { name: 'Actions for Southgate' });
        expect(within(menu).getAllByRole('menuitem').map(item => item.textContent)).toEqual([
            'View', 'EditRequires knk.admin.content', 'Delete',
        ]);
        expect(within(menu).getAllByRole('menuitem')[0]).toHaveFocus();
        expect(menu).toHaveStyle({ left: '120px', top: '80px' });
    });

    it('keeps the browser menu for Ctrl or Cmd + right-click', () => {
        renderMenuTable();
        expect(fireEvent.contextMenu(bodyRows()[0], { clientX: 10, clientY: 10, ctrlKey: true })).toBe(true);
        expect(fireEvent.contextMenu(bodyRows()[0], { clientX: 10, clientY: 10, metaKey: true })).toBe(true);
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    it('keeps the browser menu for a row without items', () => {
        renderMenuTable(() => []);
        expect(fireEvent.contextMenu(bodyRows()[0], { clientX: 10, clientY: 10 })).toBe(true);
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    it('chooses an item with a click and closes', () => {
        renderMenuTable();
        fireEvent.contextMenu(bodyRows()[2], { clientX: 5, clientY: 5 });
        fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
        expect(remove).toHaveBeenCalledWith(towns[2]);
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    it('shows a disabled item with its reason and does not run it', () => {
        renderMenuTable();
        fireEvent.contextMenu(bodyRows()[0], { clientX: 5, clientY: 5 });
        const edit = screen.getByRole('menuitem', { name: /Edit/ });
        expect(edit).toHaveAttribute('aria-disabled', 'true');
        expect(edit).toHaveTextContent('Requires knk.admin.content');
        fireEvent.click(edit);
        expect(screen.getByRole('menu')).toBeInTheDocument();
    });

    it('opens from the keyboard with Shift+F10 or the context-menu key, moves with the arrows and chooses with Enter', () => {
        renderMenuTable();
        const link = within(bodyRows()[1]).getByRole('link', { name: 'Southgate' });
        link.focus();
        fireEvent.keyDown(link, { key: 'F10', shiftKey: true });
        const menu = screen.getByRole('menu', { name: 'Actions for Southgate' });
        const [first, second, third] = within(menu).getAllByRole('menuitem');
        expect(first).toHaveFocus();
        fireEvent.keyDown(first, { key: 'ArrowDown' });
        expect(second).toHaveFocus();
        fireEvent.keyDown(second, { key: 'Enter' }); // disabled: nothing happens
        expect(screen.getByRole('menu')).toBeInTheDocument();
        fireEvent.keyDown(second, { key: 'ArrowDown' });
        expect(third).toHaveFocus();
        fireEvent.keyDown(third, { key: 'ArrowDown' });
        expect(first).toHaveFocus();
        fireEvent.keyDown(first, { key: 'ArrowUp' });
        expect(third).toHaveFocus();
        fireEvent.keyDown(third, { key: 'Home' });
        expect(first).toHaveFocus();
        fireEvent.keyDown(first, { key: 'Enter' });
        expect(view).toHaveBeenCalledWith(towns[1]);
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();

        link.focus();
        fireEvent.keyDown(link, { key: 'ContextMenu' });
        expect(screen.getByRole('menu', { name: 'Actions for Southgate' })).toBeInTheDocument();
    });

    it('closes with Escape and gives the focus back to the row', () => {
        renderMenuTable();
        const link = within(bodyRows()[0]).getByRole('link', { name: 'Northwatch' });
        link.focus();
        fireEvent.keyDown(link, { key: 'ContextMenu' });
        fireEvent.keyDown(screen.getAllByRole('menuitem')[0], { key: 'Escape' });
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
        expect(link).toHaveFocus();
    });

    it('closes on a click outside, on scrolling and on a right-click elsewhere', () => {
        renderMenuTable();
        fireEvent.contextMenu(bodyRows()[0], { clientX: 5, clientY: 5 });
        fireEvent.mouseDown(screen.getByRole('button', { name: 'outside' }));
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();

        fireEvent.contextMenu(bodyRows()[0], { clientX: 5, clientY: 5 });
        act(() => { window.dispatchEvent(new Event('scroll')); });
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();

        fireEvent.contextMenu(bodyRows()[0], { clientX: 5, clientY: 5 });
        fireEvent.mouseDown(bodyRows()[2]);
        fireEvent.contextMenu(bodyRows()[2], { clientX: 50, clientY: 50 });
        expect(screen.getByRole('menu', { name: 'Actions for Eastholm' })).toBeInTheDocument();
        expect(screen.getAllByRole('menu')).toHaveLength(1);
    });

    it('does not open the row when the menu is used', () => {
        const onRowClick = jest.fn();
        render(
            <DataTable columns={columns} rows={towns} rowKey={t => String(t.id)} onRowClick={onRowClick} rowContextMenu={items} />
        );
        fireEvent.contextMenu(bodyRows()[0], { clientX: 5, clientY: 5 });
        fireEvent.click(screen.getByRole('menuitem', { name: 'View' }));
        expect(onRowClick).not.toHaveBeenCalled();
        expect(view).toHaveBeenCalledWith(towns[0]);
    });
});
