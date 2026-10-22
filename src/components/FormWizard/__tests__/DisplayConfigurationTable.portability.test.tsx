import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DisplayConfigurationTable } from '../DisplayConfigurationTable';
import { DisplayConfigurationDto } from '../../../types/dtos/displayConfig/DisplayModels';

const config = { id: '4', entityTypeName: 'User', name: 'User - Default (seed v1)', isDefault: true, isDraft: false, sections: [] } as unknown as DisplayConfigurationDto;

const renderTable = (extra: Partial<React.ComponentProps<typeof DisplayConfigurationTable>> = {}) =>
    render(
        <DisplayConfigurationTable
            configurations={[config]}
            onEdit={jest.fn()}
            onSetDefault={jest.fn()}
            onRemoveDefault={jest.fn()}
            onCreate={jest.fn()}
            onCreateDefault={jest.fn()}
            {...extra}
        />
    );

const openRowMenu = () => fireEvent.click(screen.getAllByRole('button').find(b => b.textContent === '')!);

describe('DisplayConfigurationTable export/import (knk-displayconfig/1)', () => {
    it('offers Export JSON in the row menu', () => {
        const onExport = jest.fn();
        renderTable({ onExport });

        openRowMenu();
        fireEvent.click(screen.getByRole('menuitem', { name: 'Export JSON' }));

        expect(onExport).toHaveBeenCalledWith(config);
        expect(screen.queryByRole('menuitem', { name: 'Export JSON' })).not.toBeInTheDocument();
    });

    it('opens the import dialog from the header', () => {
        const onImport = jest.fn();
        renderTable({ onImport });

        fireEvent.click(screen.getByRole('button', { name: 'Import / Seeds' }));

        expect(onImport).toHaveBeenCalled();
    });

    it('offers the import even when the entity has no display configurations yet', () => {
        const onImport = jest.fn();
        renderTable({ configurations: [], onImport });

        expect(screen.getByText('No display configurations found for this entity.')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Import / Seeds' }));
        expect(onImport).toHaveBeenCalled();
    });

    it('shows neither without handlers', () => {
        renderTable();

        expect(screen.queryByRole('button', { name: 'Import / Seeds' })).not.toBeInTheDocument();
        openRowMenu();
        expect(screen.queryByRole('menuitem', { name: 'Export JSON' })).not.toBeInTheDocument();
    });
});
