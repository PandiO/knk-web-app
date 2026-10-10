import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { FormConfigurationTable } from '../FormConfigurationTable';
import { FormConfigurationDto } from '../../../types/dtos/forms/FormModels';

// KNG-82: deleting a configuration from the row menu asks in a FeedbackModal, not window.confirm.

const config: FormConfigurationDto = {
    id: '11',
    entityTypeName: 'Town',
    configurationName: 'Town form',
    isDefault: false,
    isActive: true,
    steps: [],
};

const renderTable = (onDelete: jest.Mock) => render(
    <FormConfigurationTable
        configurations={[config]}
        onOpen={jest.fn()}
        onSetDefault={jest.fn()}
        onRemoveDefault={jest.fn()}
        onEdit={jest.fn()}
        onDelete={onDelete}
        onCreate={jest.fn()}
        onCreateDefault={jest.fn()}
    />,
);

// The row's "more" button has only an icon.
const openRowMenu = async () => {
    const more = screen.getAllByRole('button').find((button) => button.textContent === '')!;
    await userEvent.click(more);
};

describe('FormConfigurationTable delete (KNG-82)', () => {
    let confirmSpy: jest.SpyInstance;
    beforeEach(() => {
        confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
    });
    afterEach(() => confirmSpy.mockRestore());

    it('deletes only after the modal is confirmed', async () => {
        const onDelete = jest.fn();
        renderTable(onDelete);
        await openRowMenu();
        await userEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));

        const dialog = screen.getByRole('dialog', { name: 'Delete configuration?' });
        expect(within(dialog).getByText('Are you sure you want to delete "Town form"?')).toBeInTheDocument();
        expect(onDelete).not.toHaveBeenCalled();

        await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
        await waitFor(() => expect(onDelete).toHaveBeenCalledWith(config));
        expect(confirmSpy).not.toHaveBeenCalled();
    });

    it('does not delete when the modal is closed', async () => {
        const onDelete = jest.fn();
        renderTable(onDelete);
        await openRowMenu();
        await userEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
        await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' }));

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(onDelete).not.toHaveBeenCalled();
    });
});
