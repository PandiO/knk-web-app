import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DisplayField } from '../DisplayField';
import { DisplayFieldDto } from '../../../types/dtos/displayConfig/DisplayModels';
import { DetailLinks, DetailLinksContext } from '../detailPage';

/** #189: values as text, related values as links, hot edit with Enter / Escape. */

const field = (overrides: Partial<DisplayFieldDto>): DisplayFieldDto => ({
  label: 'Name', fieldName: 'name', isReusable: false, isLinkedToSource: false, ...overrides,
});

const links = (readable = true): DetailLinks => ({
  hrefFor: (type, id) => (readable && type && id != null ? `/display/${type}/${id}` : null),
  access: () => (readable ? { readable: true, hint: null } : { readable: false, hint: 'Opening Town requires one of: knk.admin.world' }),
  follow: jest.fn(),
});

describe('DisplayField readability (#189)', () => {
  it('shows a value as plain text in a description list, not as a disabled input', () => {
    render(<dl><DisplayField field={field({})} data={{ name: 'Cinix' }} /></dl>);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByRole('term')).toHaveTextContent('Name');
    expect(screen.getByRole('definition')).toHaveTextContent('Cinix');
    expect(screen.getByText('Cinix').className).not.toMatch(/bg-surface-alt|px-3/);
  });

  it('links a related record to its detail page, or says why not', () => {
    const town = field({ label: 'Town', relatedEntityPropertyName: 'town', relatedEntityTypeName: 'Town' });
    const { unmount } = render(
      <DetailLinksContext.Provider value={links()}><DisplayField field={town} data={{ town: { id: 4, name: 'Cinix' } }} /></DetailLinksContext.Provider>);
    expect(screen.getByRole('link', { name: 'Cinix' })).toHaveAttribute('href', '/display/Town/4');
    unmount();

    render(<DetailLinksContext.Provider value={links(false)}><DisplayField field={town} data={{ town: { id: 4, name: 'Cinix' } }} /></DetailLinksContext.Provider>);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByTitle('Opening Town requires one of: knk.admin.world')).toHaveTextContent('Cinix');
  });

  it('hot edit saves with Enter and cancels with Escape', async () => {
    const onValueChange = jest.fn().mockResolvedValue(undefined);
    const editable = field({ fieldType: 'String', isEditableInDisplay: true });
    render(<DisplayField field={editable} data={{ name: 'Cinix' }} onValueChange={onValueChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit Name' }));
    const input = screen.getByRole('textbox', { name: 'Name' });
    fireEvent.change(input, { target: { value: 'Cinix II' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(onValueChange).toHaveBeenCalledWith('name', 'Cinix II'));
    await waitFor(() => expect(screen.queryByRole('textbox')).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Edit Name' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), { target: { value: 'nope' } });
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Name' }), { key: 'Escape' });
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(onValueChange).toHaveBeenCalledTimes(1);
  });

  it('shows an empty value as a muted dash with a name for screen readers', () => {
    render(<DisplayField field={field({ label: 'Description', fieldName: 'description' })} data={{ description: '' }} />);
    expect(screen.getByLabelText('Description: not set')).toHaveTextContent('-');
  });
});
