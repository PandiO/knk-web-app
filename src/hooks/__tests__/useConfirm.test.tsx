import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ConfirmOptions, useConfirm } from '../useConfirm';

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
        expect(screen.getByRole('dialog', { name: 'Delete this rule?' })).toHaveTextContent('The rule stops checking this field.');
        const action = screen.getByRole('button', { name: 'Delete' });
        expect(action).toHaveClass('bg-red-600');
        fireEvent.click(action);

        await waitFor(() => expect(onAnswer).toHaveBeenCalledWith(true));
        expect(onAnswer).toHaveBeenCalledTimes(1);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('resolves false on Cancel or the X', async () => {
        const onAnswer = jest.fn();
        render(<Harness options={{ ...options, danger: false }} onAnswer={onAnswer} />);

        fireEvent.click(screen.getByRole('button', { name: 'Ask' }));
        expect(screen.getByRole('button', { name: 'Delete' })).not.toHaveClass('bg-red-600');
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        await waitFor(() => expect(onAnswer).toHaveBeenLastCalledWith(false));

        fireEvent.click(screen.getByRole('button', { name: 'Ask' }));
        fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }));
        await waitFor(() => expect(onAnswer).toHaveBeenCalledTimes(2));
        expect(onAnswer).toHaveBeenLastCalledWith(false);
    });
});
