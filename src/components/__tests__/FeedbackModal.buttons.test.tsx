import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FeedbackModal } from '../FeedbackModal';

describe('FeedbackModal buttons', () => {
    it('with nothing to continue to, shows one button that closes', () => {
        const onClose = jest.fn();
        render(<FeedbackModal open title="Delete Failed" message="Still in use." status="error" onClose={onClose} continueLabel="Close" />);

        const buttons = screen.getAllByRole('button', { name: 'Close' });
        expect(buttons).toHaveLength(1);
        fireEvent.click(buttons[0]);
        expect(onClose).toHaveBeenCalled();
    });

    it('without a label, that one button says Close', () => {
        render(<FeedbackModal open title="Done" message="Saved." onClose={jest.fn()} />);

        expect(screen.getAllByRole('button', { name: /^(Close|Continue)$/ }).map(b => b.textContent)).toEqual(['Close']);
    });

    it('with an action, shows Close next to it', async () => {
        const onContinue = jest.fn();
        render(<FeedbackModal open title="Leave this form?" message="..." onClose={jest.fn()} onContinue={onContinue} continueLabel="Leave form" />);

        expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Leave form' }));
        expect(onContinue).toHaveBeenCalled();
    });
});
