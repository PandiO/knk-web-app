import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ActionButtons } from '../ActionButtons';
import { ActionButtonsConfigDto } from '../../../types/dtos/displayConfig/DisplayModels';

const ALL_ON = {
  showViewButton: true, showEditButton: true, showSelectButton: true, showUnlinkButton: true,
  showAddButton: true, showRemoveButton: true, showCreateButton: true,
} as unknown as ActionButtonsConfigDto;

describe('ActionButtons (CRUD-16 interim)', () => {
  it('offers no Remove on a collection item, so it can never delete the related entity', () => {
    render(<ActionButtons config={ALL_ON} isCollection isItemLevel entityType="Town" entityData={{ id: 3 }} />);

    expect(screen.queryByRole('button', { name: /Remove/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /View/ })).toBeInTheDocument();
  });

  it('hides Select, Unlink and Add, which did nothing', () => {
    render(<ActionButtons config={ALL_ON} isCollection={false} entityType="Town" entityData={{ id: 3 }} />);
    render(<ActionButtons config={ALL_ON} isCollection entityType="Town" />);

    ['Select', 'Unlink', 'Add'].forEach(name =>
      expect(screen.queryByRole('button', { name: new RegExp(`^${name}$`) })).not.toBeInTheDocument());
    expect(screen.getAllByRole('button', { name: /Create New/ }).length).toBeGreaterThan(0);
  });
});
