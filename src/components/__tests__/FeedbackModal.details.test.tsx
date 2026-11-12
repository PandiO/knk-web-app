import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FeedbackModal } from '../FeedbackModal';

/** PandiO/knk-workspace#44: "Show details" loads only on request, once, with a spinner, an error line and Try again. */
describe('FeedbackModal details (#44)', () => {
    const renderModal = (load: () => Promise<React.ReactNode>, label?: string) =>
        render(
            <FeedbackModal open title="Delete Failed" message="This street can't be deleted." status="error"
                onClose={jest.fn()} details={{ load, label }} />
        );

    it('shows no details button without details', () => {
        render(<FeedbackModal open title="Deleted" message="Done." status="success" onClose={jest.fn()} />);
        expect(screen.queryByTestId('feedback-details-toggle')).not.toBeInTheDocument();
    });

    it('loads nothing until pressed, then shows the result; Hide and Show again keep it without reloading', async () => {
        const load = jest.fn(async () => <p>Smithy</p>);
        renderModal(load, 'Show what uses it');

        const toggle = screen.getByRole('button', { name: 'Show what uses it' });
        expect(toggle).toHaveAttribute('aria-expanded', 'false');
        expect(load).not.toHaveBeenCalled();

        fireEvent.click(toggle);
        expect(toggle).toHaveAttribute('aria-expanded', 'true');
        expect(screen.getByText('Loading details…')).toBeInTheDocument();
        expect(await screen.findByText('Smithy')).toBeInTheDocument();
        expect(toggle).toHaveTextContent('Hide details');

        fireEvent.click(toggle);
        expect(screen.getByText('Smithy')).not.toBeVisible();
        fireEvent.click(toggle);
        expect(screen.getByText('Smithy')).toBeVisible();
        expect(load).toHaveBeenCalledTimes(1);
    });

    it('says why loading failed and tries again on request', async () => {
        const load = jest.fn()
            .mockRejectedValueOnce(Object.assign(new Error('x'), { status: 403, response: { message: "You don't have access to Street." } }))
            .mockResolvedValueOnce(<p>Smithy</p>);
        renderModal(load);

        fireEvent.click(screen.getByRole('button', { name: 'Show details' }));
        expect(await screen.findByRole('alert')).toHaveTextContent("You don't have access to Street.");
        fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
        expect(await screen.findByText('Smithy')).toBeInTheDocument();
        expect(load).toHaveBeenCalledTimes(2);
    });

    it('keeps focus on the footer button, not the details toggle, when it opens', async () => {
        renderModal(jest.fn());
        await waitFor(() => expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus());
    });
});
