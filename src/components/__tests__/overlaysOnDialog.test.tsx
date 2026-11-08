import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { FeedbackModal } from '../FeedbackModal';
import { ScanConflictModal } from '../FormWizard/ScanConflictModal';
import { DomainWorldPromptModal } from '../DomainWorldPromptModal';
import { CreatedEntitiesPrompt } from '../FormWizard/CreatedEntitiesPrompt';
import { ReusableStepSelector } from '../FormConfigBuilder/ReusableStepSelector';
import { FormStepDto } from '../../types/dtos/forms/FormModels';
import { gameSettingsClient } from '../../apiClients/gameSettingsClient';

jest.mock('../../apiClients/gameSettingsClient', () => ({
    gameSettingsClient: { get: jest.fn() },
}));

// PandiO/knk-workspace#33: the hand-rolled overlays now sit on the shared Dialog. One check per kind of
// overlay that it kept its behaviour and gained the dialog's (role, name, Escape, focus).

describe('FeedbackModal on the Dialog', () => {
    it('is an alertdialog for an error, starts on its button and closes on Escape', async () => {
        const onClose = jest.fn();
        render(<FeedbackModal open title="Save failed" message="The API is down." status="error" onClose={onClose} />);

        const dialog = screen.getByRole('alertdialog', { name: 'Save failed' });
        expect(dialog).toHaveAccessibleDescription('The API is down.');
        expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
        await userEvent.keyboard('{Escape}');
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('is a plain dialog for news, and a question starts on the safe button', () => {
        const { unmount } = render(<FeedbackModal open title="Saved" message="Done." status="success" onClose={jest.fn()} />);
        expect(screen.getByRole('dialog', { name: 'Saved' })).toBeInTheDocument();
        unmount();

        render(<FeedbackModal open title="Leave this form?" message="…" onClose={jest.fn()} onContinue={jest.fn()}
            continueLabel="Leave form" cancelLabel="Stay" danger />);
        expect(screen.getByRole('alertdialog', { name: 'Leave this form?' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Stay' })).toHaveFocus();
        expect(screen.getByRole('button', { name: 'Leave form' })).toHaveClass('btn-danger');
    });

    it('stays open with its buttons back when onContinue throws', async () => {
        const onClose = jest.fn();
        render(<FeedbackModal open title="Delete?" message="…" onClose={onClose} continueLabel="Delete"
            onContinue={() => Promise.reject(new Error('refused'))} />);
        await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
        await waitFor(() => expect(screen.getByRole('button', { name: 'Delete' })).toBeEnabled());
        expect(onClose).not.toHaveBeenCalled();
        expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    });
});

describe('ScanConflictModal on the Dialog', () => {
    it('groups each field\'s choice and cancels on Escape, not on a click outside', async () => {
        const onCancel = jest.fn();
        const onResolve = jest.fn();
        render(<ScanConflictModal open fields={[{ key: 'name', label: 'Name', currentValueLabel: 'Old', scannedValueLabel: 'New' }]}
            onResolve={onResolve} onCancel={onCancel} />);

        expect(screen.getByRole('alertdialog', { name: 'Scan result conflicts with existing values' })).toBeInTheDocument();
        expect(screen.getByRole('group', { name: 'Name' })).toBeInTheDocument();
        fireEvent.mouseDown(screen.getByTestId('dialog-backdrop'));
        expect(onCancel).not.toHaveBeenCalled();

        await userEvent.click(screen.getByRole('radio', { name: /Keep current value/ }));
        await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
        expect(onResolve).toHaveBeenCalledWith({ name: 'current' });

        await userEvent.keyboard('{Escape}');
        expect(onCancel).toHaveBeenCalledTimes(1);
    });
});

describe('DomainWorldPromptModal on the Dialog', () => {
    it('names the dialog by its question and offers the reported worlds', async () => {
        (gameSettingsClient.get as jest.Mock).mockResolvedValue({ runtimeWorlds: [{ worldName: 'world' }, { worldName: 'hub' }] });
        const onConfirm = jest.fn();
        render(<DomainWorldPromptModal open entityLabel="town" onConfirm={onConfirm} onCancel={jest.fn()} />);

        expect(screen.getByRole('dialog', { name: 'Which world is this town in?' })).toBeInTheDocument();
        await userEvent.click(await screen.findByRole('radio', { name: 'hub' }));
        await userEvent.click(screen.getByRole('button', { name: 'Use this world' }));
        expect(onConfirm).toHaveBeenCalledWith('hub');
    });
});

describe('CreatedEntitiesPrompt on the Dialog', () => {
    const record = { entityTypeName: 'Street', id: 4, label: 'Market Lane' } as never;

    it('starts on Keep, and cannot be closed while it deletes', async () => {
        let finish: (value: never[]) => void = () => undefined;
        const onClose = jest.fn();
        render(<CreatedEntitiesPrompt open title="Cancel this form?" intro="Created while filling out this form:" records={[record]}
            keepLabel="Keep" deleteLabel="Delete" onKeep={jest.fn()} onDone={jest.fn()} onClose={onClose}
            onDelete={() => new Promise(resolve => { finish = resolve; })} />);

        expect(screen.getByRole('alertdialog', { name: 'Cancel this form?' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Keep' })).toHaveFocus();

        await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
        await userEvent.keyboard('{Escape}');
        expect(onClose).not.toHaveBeenCalled();
        expect(screen.queryByRole('button', { name: 'Close dialog' })).not.toBeInTheDocument();

        await act(async () => finish([]));
        expect(await screen.findByRole('button', { name: 'Done' })).toHaveFocus();
    });
});

describe('Reusable template pickers on the Dialog', () => {
    const step = (id: string, stepName: string): FormStepDto => ({
        id, stepName, order: 0, isReusable: true, isLinkedToSource: false, hasCompatibilityIssues: false,
        isManyToManyRelationship: false, childFormSteps: [], fields: [], conditions: [],
    });

    it('picks a template with the keyboard', async () => {
        const onSelect = jest.fn();
        render(<ReusableStepSelector reusableSteps={[step('1', 'Basics'), step('2', 'Location')]} onSelect={onSelect} onCancel={jest.fn()} />);

        expect(screen.getByRole('dialog', { name: 'Select Reusable Step Template' })).toBeInTheDocument();
        const location = screen.getByRole('button', { name: /Location/, pressed: false });
        location.focus();
        await userEvent.keyboard('{Enter}');
        expect(screen.getByRole('button', { name: /Location/, pressed: true })).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', { name: 'Add Step' }));
        expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: '2' }), 'copy');
    });
});
