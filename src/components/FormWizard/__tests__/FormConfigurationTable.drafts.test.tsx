import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { FormConfigurationTable } from '../FormConfigurationTable';
import { DisplayConfigurationTable } from '../DisplayConfigurationTable';
import { FormConfigurationDto } from '../../../types/dtos/forms/FormModels';
import { DisplayConfigurationDto } from '../../../types/dtos/displayConfig/DisplayModels';

/** PandiO/knk-workspace#71: Entity setup's lists show where a configuration stands and offer Duplicate. */

const config = (id: string, extra: Partial<FormConfigurationDto> = {}): FormConfigurationDto => ({
    id, entityTypeName: 'Town', configurationName: `Form ${id}`, isDefault: false, steps: [], ...extra,
});

const handlers = () => ({
    onOpen: jest.fn(), onSetDefault: jest.fn(), onRemoveDefault: jest.fn(), onEdit: jest.fn(), onDuplicate: jest.fn(),
    onDelete: jest.fn(), onCreate: jest.fn(), onCreateDefault: jest.fn(),
});

it('a draft is marked, can\'t be used or made the default, and can\'t be duplicated yet', async () => {
    const h = handlers();
    render(<FormConfigurationTable configurations={[config('1', { isDraft: true })]} {...h} />);

    expect(screen.getByText('Draft')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Use/ })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'More actions for Form 1' }));
    expect(screen.queryByRole('menuitem', { name: 'Set Default' })).not.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Duplicate' })).toBeDisabled();
});

it('a published form with saved changes says so, and Duplicate hands it over', async () => {
    const h = handlers();
    const published = config('2', { hasUnpublishedChanges: true });
    render(<FormConfigurationTable configurations={[published]} {...h} />);

    expect(screen.getByText('Unpublished changes')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Use/ })).toBeEnabled();
    await userEvent.click(screen.getByRole('button', { name: 'More actions for Form 2' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Duplicate' }));
    expect(h.onDuplicate).toHaveBeenCalledWith(published);
});

it('the display list marks unpublished changes and offers Duplicate', async () => {
    const onDuplicate = jest.fn();
    const display: DisplayConfigurationDto = {
        id: '5', name: 'Town page', entityTypeName: 'Town', isDefault: true, isDraft: false, hasUnpublishedChanges: true, sections: [],
    };
    render(<DisplayConfigurationTable configurations={[display]} onEdit={jest.fn()} onSetDefault={jest.fn()} onRemoveDefault={jest.fn()}
        onDuplicate={onDuplicate} onCreate={jest.fn()} onCreateDefault={jest.fn()} />);

    expect(screen.getByText('+ unpublished changes')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /More actions for Town page/ }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Duplicate' }));
    expect(onDuplicate).toHaveBeenCalledWith(display);
});
