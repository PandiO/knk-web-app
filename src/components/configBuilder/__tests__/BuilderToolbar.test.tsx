import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { BuilderToolbar, BuilderToolbarProps, statusText } from '../BuilderToolbar';

/** PandiO/knk-workspace#71: the builders' status line and the reasons on disabled buttons. */

const open = { allowed: true, reason: null };
const props = (overrides: Partial<BuilderToolbarProps> = {}): BuilderToolbarProps => ({
    title: 'Form builder', name: 'Town form', noun: 'form',
    status: { isNew: false, isPublished: true, hasUnpublishedChanges: false },
    dirty: false, busy: null, writeGate: open, publishGate: open, duplicateGate: open, generateGate: open,
    onSave: jest.fn(), onSaveAndClose: jest.fn(), onPublish: jest.fn(), onDuplicate: jest.fn(), onDiscard: jest.fn(),
    onGenerate: jest.fn(), onClose: jest.fn(), previewOpen: false, onTogglePreview: jest.fn(),
    ...overrides,
});

it('says where the configuration stands', () => {
    expect(statusText({ isNew: true, isPublished: false, hasUnpublishedChanges: false }, 'form').label).toBe('New');
    expect(statusText({ isNew: false, isPublished: false, hasUnpublishedChanges: true }, 'form')).toMatchObject({
        label: 'Draft', detail: "Never published: staff can't use this form yet.",
    });
    expect(statusText({ isNew: false, isPublished: true, hasUnpublishedChanges: true }, 'display').label).toBe('Published · changes not published');
    expect(statusText({ isNew: false, isPublished: true, hasUnpublishedChanges: false }, 'form').tone).toBe('success');
});

it('a missing write node disables the writes with the node, once', async () => {
    render(<BuilderToolbar {...props({ dirty: true, writeGate: { allowed: false, reason: 'Requires knk.admin.content' } })} />);
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Publish/ })).toHaveAccessibleDescription('Save, Publish and Duplicate: Requires knk.admin.content');
    expect(screen.getByRole('button', { name: 'Preview' })).toBeEnabled();

    await userEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(screen.getByRole('menuitem', { name: /Duplicate/ })).toBeDisabled();
    expect(screen.getByRole('menuitem', { name: /Generate from metadata/ })).toHaveTextContent('Requires knk.admin.content');
});

it('busy disables every action and More runs the chosen one', async () => {
    const onGenerate = jest.fn();
    const { rerender } = render(<BuilderToolbar {...props({ onGenerate })} />);
    await userEvent.click(screen.getByRole('button', { name: 'More' }));
    await userEvent.click(screen.getByRole('menuitem', { name: /Generate from metadata/ }));
    expect(onGenerate).toHaveBeenCalled();

    rerender(<BuilderToolbar {...props({ dirty: true, busy: 'saving' })} />);
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Publish/ })).toBeDisabled();
});
