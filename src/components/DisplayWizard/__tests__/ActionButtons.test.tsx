import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ActionButtons } from '../ActionButtons';
import { ActionButtonsConfigDto } from '../../../types/dtos/displayConfig/DisplayModels';
import { RelationshipMetadataDto } from '../../../types/dtos/metadata/MetadataModels';

const ALL_ON: ActionButtonsConfigDto = {
  showViewButton: true, showEditButton: true, showSelectButton: true, showUnlinkButton: true,
  showAddButton: true, showRemoveButton: true, showDeleteButton: true, showCreateButton: true,
};
const streets: RelationshipMetadataDto = {
  property: 'streets', relatedType: 'Street', kind: 'collection', storage: 'many', canLink: true, canUnlink: true, nodes: ['knk.admin.world'],
};

describe('ActionButtons (#188)', () => {
  it('never offers a "Remove" that deletes: an item has Unlink, and a separate red Delete', () => {
    const onAction = jest.fn();
    render(<ActionButtons config={ALL_ON} isCollection isItemLevel entityType="Street" entityData={{ id: 3 }}
      relationship={streets} relatedId={3} relatedLabel="Main Street" onActionClick={onAction} />);

    expect(screen.queryByRole('button', { name: /Remove/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Unlink Main Street' }));
    expect(onAction).toHaveBeenLastCalledWith({ type: 'unlink', entityType: 'Street', entityId: 3, property: 'streets', label: 'Main Street' });
    const del = screen.getByRole('button', { name: 'Delete Main Street' });
    expect(del).toHaveClass('btn-danger');
    fireEvent.click(del);
    expect(onAction).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'delete', entityId: 3 }));
  });

  it('hides Select, Unlink and Add without a relationship the API knows', () => {
    render(<ActionButtons config={ALL_ON} isCollection={false} entityType="Town" entityData={{ id: 3 }} />);
    render(<ActionButtons config={ALL_ON} isCollection entityType="Town" />);

    ['Select…', 'Change…', 'Unlink', 'Add…'].forEach(name =>
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument());
    expect(screen.getAllByRole('button', { name: /Create New/ }).length).toBeGreaterThan(0);
  });

  it('offers Select… on an empty single relation and Change… on a linked one', () => {
    const reference = { ...streets, kind: 'reference' as const, storage: 'foreignKey' as const };
    const { rerender } = render(<ActionButtons config={ALL_ON} isCollection={false} entityType="Location" relationship={reference} />);
    expect(screen.getByRole('button', { name: 'Select…' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Unlink' })).not.toBeInTheDocument();

    rerender(<ActionButtons config={ALL_ON} isCollection={false} entityType="Location" entityData={{ id: 9 }} relationship={reference} />);
    expect(screen.getByRole('button', { name: 'Change…' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Unlink' })).toBeEnabled();
  });

  it('disables what the viewer may not do, with the reason as text and as description', () => {
    render(<ActionButtons config={ALL_ON} isCollection entityType="Street" relationship={streets}
      linkGate={{ allowed: false, reason: 'Requires knk.admin.world' }} />);

    const add = screen.getByRole('button', { name: 'Add…' });
    expect(add).toBeDisabled();
    expect(add).toHaveAccessibleDescription('Add…: Requires knk.admin.world');
    expect(screen.getByTestId('action-hint')).toHaveTextContent('Add…: Requires knk.admin.world');
  });

  it('says a shared reason once, and offers Create New on the section, not on each item', () => {
    const reference = { ...streets, kind: 'reference' as const, storage: 'foreignKey' as const, canLink: false, canUnlink: false };
    const closed = { allowed: false, reason: 'Change this on the Edit page.' };
    render(<ActionButtons config={ALL_ON} isCollection={false} entityType="Location" entityData={{ id: 9 }}
      relationship={reference} linkGate={closed} unlinkGate={closed} />);
    expect(screen.getAllByTestId('action-hint').map(p => p.textContent)).toEqual(['Change… and Unlink: Change this on the Edit page.']);
  });

  it('has no Create New on an item', () => {
    render(<ActionButtons config={ALL_ON} isCollection isItemLevel entityType="Street" entityData={{ id: 3 }} relationship={streets} />);
    expect(screen.queryByRole('button', { name: /Create New/ })).not.toBeInTheDocument();
  });
});
