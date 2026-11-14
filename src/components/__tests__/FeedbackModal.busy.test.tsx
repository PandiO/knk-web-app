import React, { useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FeedbackModal } from '../FeedbackModal';

// PandiO/knk-workspace#413: the dialog disables its buttons while its action runs. That state must never outlive
// the opening it belongs to: not in StrictMode (`npm start`), and not when the parent closes the dialog while the
// action still runs.
describe('FeedbackModal busy state (#413)', () => {
    /** A parent that keeps one FeedbackModal mounted and opens it again, like the wizard's jump dialog. */
    const Harness: React.FC<{ action: () => Promise<void>; closeFirst?: boolean }> = ({ action, closeFirst }) => {
        const [open, setOpen] = useState(false);
        return (
            <>
                <button type="button" onClick={() => setOpen(true)}>Open</button>
                <FeedbackModal
                    open={open}
                    title="Can't go there yet"
                    message="Fix it first."
                    status="error"
                    onClose={() => setOpen(false)}
                    onContinue={async () => {
                        if (closeFirst) setOpen(false);
                        await action();
                    }}
                    continueLabel="Go to step"
                />
            </>
        );
    };

    const reopen = () => fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    const expectButtonsEnabled = () => {
        expect(screen.getByRole('button', { name: 'Go to step' })).toBeEnabled();
        expect(screen.getByRole('button', { name: 'Close' })).toBeEnabled();
        expect(screen.getByRole('button', { name: 'Close dialog' })).toBeEnabled();
    };

    it.each([false, true])('the buttons work again on the next opening after the action (StrictMode %s)', async (strict) => {
        const ui = <Harness action={async () => undefined} />;
        render(strict ? <React.StrictMode>{ui}</React.StrictMode> : ui);

        reopen();
        fireEvent.click(screen.getByRole('button', { name: 'Go to step' }));
        await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());

        reopen();
        expectButtonsEnabled();
    });

    it('the parent closes it while the action still runs: the next opening is not busy, nor closed by the old action', async () => {
        let finish: () => void = () => undefined;
        render(<React.StrictMode><Harness closeFirst action={() => new Promise<void>(resolve => { finish = resolve; })} /></React.StrictMode>);

        reopen();
        fireEvent.click(screen.getByRole('button', { name: 'Go to step' }));
        await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());

        reopen();
        expectButtonsEnabled();
        await act(async () => finish());
        expect(screen.getByRole('alertdialog')).toBeInTheDocument();
        expectButtonsEnabled();
    });
});
