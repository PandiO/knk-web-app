import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { FormConfigurationTable } from '../FormConfigurationTable';
import { FormConfigurationDto } from '../../../types/dtos/forms/FormModels';

// KNG-82 / KNG-169: the Forms page asks for confirmation in a FeedbackModal (useConfirm), so the
// row menu's Delete hands the configuration over without asking itself - one question, never
// window.confirm and never a second modal (deleting used to ask twice).

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

describe('FormConfigurationTable delete (KNG-82, KNG-169)', () => {
    let confirmSpy: jest.SpyInstance;
    beforeEach(() => {
        confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
    });
    afterEach(() => confirmSpy.mockRestore());

    it('hands the configuration to the page, which asks once', async () => {
        const onDelete = jest.fn();
        renderTable(onDelete);
        await openRowMenu();
        await userEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));

        expect(onDelete).toHaveBeenCalledWith(config);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(confirmSpy).not.toHaveBeenCalled();
    });
});
