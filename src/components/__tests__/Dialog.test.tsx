import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { Dialog, DialogProps } from '../Dialog';

// PandiO/knk-workspace#33: the one accessible dialog. No jest-axe in the repo, so roles, names,
// focus and keys are checked one by one.

const Harness: React.FC<Partial<DialogProps> & { withField?: boolean }> = ({ withField = true, children, ...props }) => {
    const [open, setOpen] = React.useState(false);
    return (
        <>
            <button onClick={() => setOpen(true)}>Open</button>
            <Dialog
                open={open}
                onClose={() => setOpen(false)}
                title="Edit town"
                description="Change the town's name."
                footer={<><button onClick={() => setOpen(false)}>Cancel</button><button>Save</button></>}
                {...props}
            >
                {children ?? (withField ? <input aria-label="Name" /> : <p>Nothing to type.</p>)}
            </Dialog>
        </>
    );
};

const openIt = async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    return screen.getByRole('dialog', { name: 'Edit town' });
};

describe('Dialog (#33)', () => {
    it('is a labelled, described modal dialog rendered on <body>', async () => {
        const { container } = render(<Harness />);
        const dialog = await openIt();

        expect(dialog).toHaveAttribute('aria-modal', 'true');
        expect(dialog).toHaveAccessibleDescription("Change the town's name.");
        expect(container).not.toContainElement(dialog);
        expect(document.body).toContainElement(dialog);
    });

    it('can be an alertdialog', async () => {
        render(<Harness role="alertdialog" />);
        await userEvent.click(screen.getByRole('button', { name: 'Open' }));
        expect(screen.getByRole('alertdialog', { name: 'Edit town' })).toBeInTheDocument();
    });

    it('focuses the first field of the body, else the first footer button, else initialFocusRef', async () => {
        const { unmount } = render(<Harness />);
        await openIt();
        expect(screen.getByRole('textbox', { name: 'Name' })).toHaveFocus();
        unmount();

        const view = render(<Harness withField={false} />);
        await openIt();
        expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
        view.unmount();

        const Target: React.FC = () => {
            const ref = React.useRef<HTMLButtonElement>(null);
            return <Harness initialFocusRef={ref}><input aria-label="Name" /><button ref={ref}>Pick</button></Harness>;
        };
        render(<Target />);
        await openIt();
        expect(screen.getByRole('button', { name: 'Pick' })).toHaveFocus();
    });

    it('keeps Tab and Shift+Tab inside', async () => {
        render(<Harness />);
        await openIt();
        const name = screen.getByRole('textbox', { name: 'Name' });
        const close = screen.getByRole('button', { name: 'Close dialog' });
        const save = screen.getByRole('button', { name: 'Save' });

        // Order: × (header), Name, Cancel, Save.
        save.focus();
        await userEvent.tab();
        expect(close).toHaveFocus();
        await userEvent.tab({ shift: true });
        expect(save).toHaveFocus();
        name.focus();
        await userEvent.tab();
        expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    });

    it('closes on Escape and the ×, and gives focus back to the opener', async () => {
        render(<Harness />);
        await openIt();
        await userEvent.keyboard('{Escape}');
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Open' })).toHaveFocus();

        await openIt();
        await userEvent.click(screen.getByRole('button', { name: 'Close dialog' }));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Open' })).toHaveFocus();
    });

    it('closes on a backdrop click only with closeOnBackdrop', async () => {
        const { unmount } = render(<Harness />);
        await openIt();
        fireEvent.mouseDown(screen.getByTestId('dialog-backdrop'));
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        unmount();

        render(<Harness closeOnBackdrop />);
        await openIt();
        fireEvent.mouseDown(screen.getByTestId('dialog-backdrop'));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('ignores Escape, the × and the backdrop while not dismissible', async () => {
        render(<Harness dismissible={false} closeOnBackdrop />);
        await openIt();
        await userEvent.keyboard('{Escape}');
        fireEvent.mouseDown(screen.getByTestId('dialog-backdrop'));
        expect(screen.getByRole('button', { name: 'Close dialog' })).toBeDisabled();
        expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('lets Escape close only the innermost of nested dialogs', async () => {
        const Nested: React.FC = () => {
            const [inner, setInner] = React.useState(false);
            return (
                <Harness>
                    <button onClick={() => setInner(true)}>More</button>
                    <Dialog open={inner} onClose={() => setInner(false)} title="Details">
                        <button>Inside</button>
                    </Dialog>
                </Harness>
            );
        };
        render(<Nested />);
        await openIt();
        await userEvent.click(screen.getByRole('button', { name: 'More' }));
        expect(screen.getByRole('button', { name: 'Inside' })).toHaveFocus();

        await userEvent.keyboard('{Escape}');
        expect(screen.queryByRole('dialog', { name: 'Details' })).not.toBeInTheDocument();
        expect(screen.getByRole('dialog', { name: 'Edit town' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'More' })).toHaveFocus();

        await userEvent.keyboard('{Escape}');
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('brings focus that leaves it back inside', async () => {
        render(<><Harness /><button>Behind</button></>);
        await openIt();
        act(() => screen.getByRole('button', { name: 'Behind', hidden: true }).focus());
        expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement);
    });

    it('stops the page behind from scrolling while open', async () => {
        document.body.style.overflow = 'auto';
        render(<Harness />);
        await openIt();
        expect(document.body.style.overflow).toBe('hidden');
        await userEvent.keyboard('{Escape}');
        expect(document.body.style.overflow).toBe('auto');
        document.body.style.overflow = '';
    });

    it('renders nothing while closed', () => {
        render(<Dialog open={false} onClose={() => undefined} title="Hidden" />);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
});
