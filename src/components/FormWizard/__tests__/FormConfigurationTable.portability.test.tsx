import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FormConfigurationTable } from '../FormConfigurationTable';
import { FormConfigurationDto } from '../../../types/dtos/forms/FormModels';

const config = { id: '9', entityTypeName: 'GateStructure', configurationName: 'Gate Structure Configuration', isDefault: true, steps: [] } as unknown as FormConfigurationDto;

const renderTable = (extra: Partial<React.ComponentProps<typeof FormConfigurationTable>> = {}) =>
    render(
        <FormConfigurationTable
            configurations={[config]}
            onOpen={jest.fn()}
            onSetDefault={jest.fn()}
            onRemoveDefault={jest.fn()}
            onEdit={jest.fn()}
            onCreate={jest.fn()}
            onCreateDefault={jest.fn()}
            {...extra}
        />
    );

describe('FormConfigurationTable export/import (KNG-138)', () => {
    it('offers Export JSON in the row menu', () => {
        const onExport = jest.fn();
        renderTable({ onExport });

        fireEvent.click(screen.getAllByRole('button').find(b => b.textContent === '')!);
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

    it('shows neither without handlers', () => {
        renderTable();

        expect(screen.queryByRole('button', { name: 'Import / Seeds' })).not.toBeInTheDocument();
        fireEvent.click(screen.getAllByRole('button').find(b => b.textContent === '')!);
        expect(screen.queryByRole('menuitem', { name: 'Export JSON' })).not.toBeInTheDocument();
    });
});
