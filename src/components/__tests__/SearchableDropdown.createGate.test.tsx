import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SearchableDropdown } from '../SearchableDropdown';

// PandiO/knk-workspace#383: "Create New" greyed out with the reason (decision 11), not hidden.

const open = () => fireEvent.click(screen.getAllByRole('button')[0]);

describe('SearchableDropdown Create New gate (#383)', () => {
    it('offers a working Create New row without a reason', () => {
        const onCreateNew = jest.fn();
        render(<SearchableDropdown label="Street" instances={[{ id: 1, name: 'Main' }]} onSelect={jest.fn()} onCreateNew={onCreateNew} />);
        open();
        fireEvent.click(screen.getByRole('button', { name: /Create New Street/ }));
        expect(onCreateNew).toHaveBeenCalledTimes(1);
    });

    it('shows Create New greyed out with the reason, and neither a click nor Enter creates', () => {
        const onCreateNew = jest.fn();
        render(
            <SearchableDropdown label="Street" instances={[]} onSelect={jest.fn()} onCreateNew={onCreateNew}
                createNewDisabledReason="Requires knk.admin.content" />
        );
        open();
        const row = screen.getByRole('button', { name: /Create New Street/ });
        expect(row).toBeDisabled();
        expect(row).toHaveAttribute('title', 'Requires knk.admin.content');
        expect(row).toHaveTextContent('Requires knk.admin.content');
        fireEvent.click(row);
        // No matches: the Create New row is the highlighted one; Enter in the search box must not create.
        fireEvent.keyDown(screen.getByPlaceholderText('Search...'), { key: 'Enter' });
        expect(onCreateNew).not.toHaveBeenCalled();
    });
});
