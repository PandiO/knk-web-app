import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { createMemoryRouter, Link, RouterProvider } from 'react-router-dom';
import { useLeaveGuard } from '../useLeaveGuard';

// Jest 27 can't read react-router-dom v7's exports map; react-router has the same router and hooks.
jest.mock('react-router-dom', () => jest.requireActual('react-router'), { virtual: true });

// #109: an open form with unsaved changes asks before it is left.

const FormPage: React.FC<{ dirty: boolean; onClose?: () => void }> = ({ dirty, onClose }) => {
    const guard = useLeaveGuard(dirty);
    return (
        <div>
            {guard.element}
            <p>the form</p>
            <Link to="/dashboard">Dashboard</Link>
            <button type="button" onClick={() => guard.confirmLeave(() => onClose?.())}>Close form</button>
            <button type="button" onClick={guard.allowLeave}>Submitted</button>
        </div>
    );
};

const renderAt = (dirty: boolean, onClose?: () => void) => {
    const router = createMemoryRouter([
        { path: '/forms/town', element: <FormPage dirty={dirty} onClose={onClose} /> },
        { path: '/dashboard', element: <p>dashboard page</p> }
    ], { initialEntries: ['/forms/town'] });
    render(<RouterProvider router={router} />);
    return router;
};

describe('useLeaveGuard (#109)', () => {
    it('lets a link leave at once when nothing changed', async () => {
        renderAt(false);
        fireEvent.click(screen.getByRole('link', { name: 'Dashboard' }));
        expect(await screen.findByText('dashboard page')).toBeInTheDocument();
    });

    it('asks before a link leaves a changed form: Stay keeps it, Leave form goes', async () => {
        const router = renderAt(true);

        fireEvent.click(screen.getByRole('link', { name: 'Dashboard' }));
        const dialog = await screen.findByRole('dialog', { name: 'Leave this form?' });
        fireEvent.click(within(dialog).getByRole('button', { name: 'Stay' }));
        expect(screen.getByText('the form')).toBeInTheDocument();
        expect(router.state.location.pathname).toBe('/forms/town');

        fireEvent.click(screen.getByRole('link', { name: 'Dashboard' }));
        fireEvent.click(within(await screen.findByRole('dialog', { name: 'Leave this form?' })).getByRole('button', { name: 'Leave form' }));
        expect(await screen.findByText('dashboard page')).toBeInTheDocument();
    });

    it('asks before an own action closes a changed form (the breadcrumb)', async () => {
        const onClose = jest.fn();
        renderAt(true, onClose);

        fireEvent.click(screen.getByRole('button', { name: 'Close form' }));
        fireEvent.click(within(await screen.findByRole('dialog', { name: 'Leave this form?' })).getByRole('button', { name: 'Stay' }));
        expect(onClose).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole('button', { name: 'Close form' }));
        fireEvent.click(within(await screen.findByRole('dialog', { name: 'Leave this form?' })).getByRole('button', { name: 'Leave form' }));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('lets a navigation pass after allowLeave (a submit that saved everything)', async () => {
        renderAt(true);
        fireEvent.click(screen.getByRole('button', { name: 'Submitted' }));
        fireEvent.click(screen.getByRole('link', { name: 'Dashboard' }));
        expect(await screen.findByText('dashboard page')).toBeInTheDocument();
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('asks the browser before a reload or closing the tab only when something changed', () => {
        renderAt(true);
        const changed = new Event('beforeunload', { cancelable: true });
        window.dispatchEvent(changed);
        expect(changed.defaultPrevented).toBe(true);
        cleanup();

        renderAt(false);
        const unchanged = new Event('beforeunload', { cancelable: true });
        window.dispatchEvent(unchanged);
        expect(unchanged.defaultPrevented).toBe(false);
    });
});
