import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { useConfirmModal } from '../useConfirmModal';

// KNG-82: the in-app replacement for window.confirm.

const Harness: React.FC<{ onAnswer: (confirmed: boolean) => void }> = ({ onAnswer }) => {
    const { confirm, modal } = useConfirmModal();
    return (
        <>
            <button
                onClick={async () => onAnswer(await confirm({ title: 'Delete thing?', message: 'Delete "Thing"?', continueLabel: 'Delete' }))}
            >
                Ask
            </button>
            {modal}
        </>
    );
};

describe('useConfirmModal', () => {
    let confirmSpy: jest.SpyInstance;
    beforeEach(() => {
        confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
    });
    afterEach(() => confirmSpy.mockRestore());

    it('resolves true when the continue button is clicked, and closes', async () => {
        const onAnswer = jest.fn();
        render(<Harness onAnswer={onAnswer} />);
        await userEvent.click(screen.getByRole('button', { name: 'Ask' }));

        const dialog = screen.getByRole('dialog', { name: 'Delete thing?' });
        expect(within(dialog).getByText('Delete "Thing"?')).toBeInTheDocument();
        expect(onAnswer).not.toHaveBeenCalled();

        await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
        await waitFor(() => expect(onAnswer).toHaveBeenCalledWith(true));
        expect(onAnswer).toHaveBeenCalledTimes(1);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(confirmSpy).not.toHaveBeenCalled();
    });

    it.each(['Close', 'Close dialog'])('resolves false when "%s" is clicked', async (label) => {
        const onAnswer = jest.fn();
        render(<Harness onAnswer={onAnswer} />);
        await userEvent.click(screen.getByRole('button', { name: 'Ask' }));

        await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: label }));
        await waitFor(() => expect(onAnswer).toHaveBeenCalledWith(false));
        expect(onAnswer).toHaveBeenCalledTimes(1);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
});
