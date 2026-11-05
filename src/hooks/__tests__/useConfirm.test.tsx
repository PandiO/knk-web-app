import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { ConfirmOptions, ConfirmReasonOptions, useConfirm } from '../useConfirm';

const Harness: React.FC<{ options: ConfirmOptions; onAnswer: (confirmed: boolean) => void }> = ({ options, onAnswer }) => {
    const [confirm, confirmModal] = useConfirm();
    return (
        <>
            <button onClick={async () => onAnswer(await confirm(options))}>Ask</button>
            {confirmModal}
        </>
    );
};

const options: ConfirmOptions = {
    title: 'Delete this rule?',
    message: 'The rule stops checking this field.',
    confirmLabel: 'Delete',
    danger: true,
};

describe('useConfirm (KNG-169)', () => {
    it('resolves true when the action button is pressed', async () => {
        const onAnswer = jest.fn();
        render(<Harness options={options} onAnswer={onAnswer} />);

        fireEvent.click(screen.getByRole('button', { name: 'Ask' }));
        expect(screen.getByRole('alertdialog', { name: 'Delete this rule?' })).toHaveTextContent('The rule stops checking this field.');
        const action = screen.getByRole('button', { name: 'Delete' });
        expect(action).toHaveClass('btn-danger');
        fireEvent.click(action);

        await waitFor(() => expect(onAnswer).toHaveBeenCalledWith(true));
        expect(onAnswer).toHaveBeenCalledTimes(1);
        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });

    it('resolves false on Cancel or the X', async () => {
        const onAnswer = jest.fn();
        render(<Harness options={{ ...options, danger: false }} onAnswer={onAnswer} />);

        fireEvent.click(screen.getByRole('button', { name: 'Ask' }));
        expect(screen.getByRole('button', { name: 'Delete' })).not.toHaveClass('btn-danger');
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        await waitFor(() => expect(onAnswer).toHaveBeenLastCalledWith(false));

        fireEvent.click(screen.getByRole('button', { name: 'Ask' }));
        fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }));
        await waitFor(() => expect(onAnswer).toHaveBeenCalledTimes(2));
        expect(onAnswer).toHaveBeenLastCalledWith(false);
    });

    it('is an alertdialog; a danger question starts on Cancel, another on the action (#33)', async () => {
        const onAnswer = jest.fn();
        const { unmount } = render(<Harness options={options} onAnswer={onAnswer} />);
        await userEvent.click(screen.getByRole('button', { name: 'Ask' }));
        expect(screen.getByRole('alertdialog', { name: 'Delete this rule?' })).toHaveAccessibleDescription('The rule stops checking this field.');
        expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
        unmount();

        render(<Harness options={{ ...options, danger: false, confirmLabel: 'Apply' }} onAnswer={onAnswer} />);
        await userEvent.click(screen.getByRole('button', { name: 'Ask' }));
        expect(screen.getByRole('button', { name: 'Apply' })).toHaveFocus();
    });

    it('answers no on Escape and a click outside, and gives focus back', async () => {
        const onAnswer = jest.fn();
        render(<Harness options={options} onAnswer={onAnswer} />);
        await userEvent.click(screen.getByRole('button', { name: 'Ask' }));
        await userEvent.keyboard('{Escape}');
        await waitFor(() => expect(onAnswer).toHaveBeenLastCalledWith(false));
        expect(screen.getByRole('button', { name: 'Ask' })).toHaveFocus();

        await userEvent.click(screen.getByRole('button', { name: 'Ask' }));
        fireEvent.mouseDown(screen.getByTestId('dialog-backdrop'));
        await waitFor(() => expect(onAnswer).toHaveBeenCalledTimes(2));
        expect(onAnswer).toHaveBeenLastCalledWith(false);
    });
});

const ReasonHarness: React.FC<{ reason?: ConfirmReasonOptions; onAnswer: (reason: string | null) => void }> = ({ reason, onAnswer }) => {
    const [, confirmModal, confirmWithReason] = useConfirm();
    return (
        <>
            <button onClick={async () => onAnswer(await confirmWithReason({
                title: 'Freeze Steve?',
                message: 'Steve cannot play until unfrozen.',
                confirmLabel: 'Freeze',
                danger: true,
                reason,
            }))}>Ask</button>
            {confirmModal}
        </>
    );
};

describe('useConfirm with a reason (#33, MOD-2)', () => {
    it('asks for a required reason in a labelled field before it answers yes', async () => {
        const onAnswer = jest.fn();
        render(<ReasonHarness reason={{ hint: 'Saved in the audit log.' }} onAnswer={onAnswer} />);
        await userEvent.click(screen.getByRole('button', { name: 'Ask' }));

        const field = screen.getByRole('textbox', { name: /Reason/ });
        expect(field).toHaveFocus();
        expect(field).toHaveAttribute('aria-required', 'true');
        expect(field).toHaveAccessibleDescription('Saved in the audit log.');

        await userEvent.click(screen.getByRole('button', { name: 'Freeze' }));
        expect(onAnswer).not.toHaveBeenCalled();
        expect(screen.getByRole('alert')).toHaveTextContent('Enter a reason.');
        expect(field).toHaveAttribute('aria-invalid', 'true');
        expect(field).toHaveFocus();

        await userEvent.type(field, '  griefing the market  ');
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', { name: 'Freeze' }));
        await waitFor(() => expect(onAnswer).toHaveBeenCalledWith('griefing the market'));
        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });

    it('answers null on Cancel and keeps the text on a click outside', async () => {
        const onAnswer = jest.fn();
        render(<ReasonHarness onAnswer={onAnswer} />);
        await userEvent.click(screen.getByRole('button', { name: 'Ask' }));
        await userEvent.type(screen.getByRole('textbox', { name: /Reason/ }), 'spam');

        fireEvent.mouseDown(screen.getByTestId('dialog-backdrop'));
        expect(screen.getByRole('textbox', { name: /Reason/ })).toHaveValue('spam');

        await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        await waitFor(() => expect(onAnswer).toHaveBeenCalledWith(null));
    });

    it('takes an optional reason and a minimum length', async () => {
        const onAnswer = jest.fn();
        const { unmount } = render(<ReasonHarness reason={{ required: false, label: 'Note' }} onAnswer={onAnswer} />);
        await userEvent.click(screen.getByRole('button', { name: 'Ask' }));
        expect(screen.getByRole('textbox', { name: /Note/ })).not.toHaveAttribute('aria-required');
        await userEvent.click(screen.getByRole('button', { name: 'Freeze' }));
        await waitFor(() => expect(onAnswer).toHaveBeenCalledWith(''));
        unmount();

        render(<ReasonHarness reason={{ minLength: 5 }} onAnswer={onAnswer} />);
        await userEvent.click(screen.getByRole('button', { name: 'Ask' }));
        await userEvent.type(screen.getByRole('textbox', { name: /Reason/ }), 'abc');
        await userEvent.click(screen.getByRole('button', { name: 'Freeze' }));
        expect(screen.getByRole('alert')).toHaveTextContent('Enter at least 5 characters.');
        expect(onAnswer).toHaveBeenCalledTimes(1);
    });
});

