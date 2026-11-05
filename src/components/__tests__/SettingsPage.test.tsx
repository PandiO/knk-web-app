import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { createMemoryRouter, Link, RouterProvider } from 'react-router-dom';
import { SettingsPage, SettingsSection, LEAVE_SETTINGS_TITLE } from '../SettingsPage';
import { toast } from '../../utils/toast';

// Jest 27 can't read react-router-dom v7's exports map; react-router has the same router and hooks.
jest.mock('react-router-dom', () => jest.requireActual('react-router'), { virtual: true });

// PandiO/knk-workspace#187 (SET-4, SET-7): the settings page shell.

const SAVED = { motd: 'Welcome' };

interface DemoProps {
    onSave?: (value: string) => Promise<string | void>;
    onReload?: () => void;
    loadError?: string;
}

/** A page with one setting, counted against the saved value as a real page does. */
const Demo: React.FC<DemoProps> = ({ onSave = async () => undefined, onReload, loadError }) => {
    const [saved, setSaved] = React.useState(SAVED.motd);
    const [motd, setMotd] = React.useState(SAVED.motd);
    return (
        <SettingsPage
            title="Demo settings"
            description="One setting."
            lastSaved={{ at: '2026-11-05T20:52:02', by: 'Pandi' }}
            dirtyCount={motd === saved ? 0 : 1}
            canSave={motd.trim() !== ''}
            onSave={async () => {
                const message = await onSave(motd);
                setSaved(motd);
                return message;
            }}
            onDiscard={() => setMotd(saved)}
            onReload={onReload}
            loadError={loadError}
            onRetry={jest.fn()}
        >
            <SettingsSection title="Server list" description="Under the name." changed={motd !== saved}>
                <label htmlFor="motd">MOTD</label>
                <input id="motd" value={motd} onChange={e => setMotd(e.target.value)} />
            </SettingsSection>
            <Link to="/elsewhere">Elsewhere</Link>
        </SettingsPage>
    );
};

const renderAt = (props: DemoProps = {}) => {
    const router = createMemoryRouter([
        { path: '/settings', element: <Demo {...props} /> },
        { path: '/elsewhere', element: <p>elsewhere page</p> },
    ], { initialEntries: ['/settings'] });
    render(<RouterProvider router={router} />);
    return router;
};

const change = (value: string) => fireEvent.change(screen.getByLabelText('MOTD'), { target: { value } });

describe('SettingsPage (#187)', () => {
    let success: jest.SpyInstance;
    beforeEach(() => {
        success = jest.spyOn(toast, 'success').mockImplementation(() => undefined);
    });
    afterEach(() => success.mockRestore());

    it('shows the title, last saved and a clean state with Save and Discard off', () => {
        renderAt();
        const header = screen.getByRole('banner', { name: 'Demo settings' });
        expect(within(header).getByRole('heading', { level: 1, name: 'Demo settings' })).toBeInTheDocument();
        expect(header).toHaveTextContent(/Last saved .+ by Pandi\./);
        expect(header).toHaveTextContent('No unsaved changes.');
        expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
        expect(screen.getByRole('button', { name: /Discard/ })).toBeDisabled();
        expect(screen.getByRole('region', { name: 'Server list' })).not.toHaveTextContent('Changed');
    });

    it('counts changes, marks the section, saves with a toast and is clean again', async () => {
        const onSave = jest.fn(async () => undefined);
        renderAt({ onSave });
        change('Hello');
        expect(screen.getByText('1 unsaved change.')).toBeInTheDocument();
        expect(screen.getByRole('region', { name: 'Server list' })).toHaveTextContent('Changed');

        fireEvent.click(screen.getByRole('button', { name: 'Save (1)' }));
        await waitFor(() => expect(success).toHaveBeenCalledWith('Saved 1 change.'));
        expect(onSave).toHaveBeenCalledWith('Hello');
        expect(screen.getByText('No unsaved changes.')).toBeInTheDocument();
    });

    it('uses the message onSave resolves', async () => {
        renderAt({ onSave: async () => 'Server list saved.' });
        change('Hello');
        fireEvent.click(screen.getByRole('button', { name: 'Save (1)' }));
        await waitFor(() => expect(success).toHaveBeenCalledWith('Server list saved.'));
    });

    it('keeps Save off while a value is invalid', () => {
        renderAt();
        change('   ');
        expect(screen.getByRole('button', { name: 'Save (1)' })).toBeDisabled();
    });

    it('keeps the changes and shows the API reason when the save is refused', async () => {
        const onSave = jest.fn(async () => { throw Object.assign(new Error('MOTD too long.'), { status: 400 }); });
        renderAt({ onSave });
        change('Hello');
        fireEvent.click(screen.getByRole('button', { name: 'Save (1)' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('MOTD too long.');
        expect(success).not.toHaveBeenCalled();
        expect(screen.getByText('1 unsaved change.')).toBeInTheDocument();
    });

    it('Discard asks first: Cancel keeps the change, Discard puts the saved value back', async () => {
        renderAt();
        change('Hello');
        fireEvent.click(screen.getByRole('button', { name: /Discard/ }));
        let dialog = await screen.findByRole('alertdialog', { name: 'Discard 1 unsaved change?' });
        fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
        await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
        expect(screen.getByLabelText('MOTD')).toHaveValue('Hello');

        fireEvent.click(screen.getByRole('button', { name: /Discard/ }));
        dialog = await screen.findByRole('alertdialog', { name: 'Discard 1 unsaved change?' });
        fireEvent.click(within(dialog).getByRole('button', { name: 'Discard' }));
        await waitFor(() => expect(screen.getByLabelText('MOTD')).toHaveValue('Welcome'));
    });

    it('Reload asks only when something changed', async () => {
        const onReload = jest.fn();
        renderAt({ onReload });
        fireEvent.click(screen.getByRole('button', { name: /Reload/ }));
        await waitFor(() => expect(onReload).toHaveBeenCalledTimes(1));

        change('Hello');
        fireEvent.click(screen.getByRole('button', { name: /Reload/ }));
        const dialog = await screen.findByRole('alertdialog', { name: 'Reload and discard your changes?' });
        expect(onReload).toHaveBeenCalledTimes(1);
        fireEvent.click(within(dialog).getByRole('button', { name: 'Reload' }));
        await waitFor(() => expect(onReload).toHaveBeenCalledTimes(2));
    });

    it('leaves at once when nothing changed', async () => {
        renderAt();
        fireEvent.click(screen.getByRole('link', { name: 'Elsewhere' }));
        expect(await screen.findByText('elsewhere page')).toBeInTheDocument();
    });

    it('asks before leaving with unsaved changes: Stay keeps the page, Leave goes', async () => {
        const router = renderAt();
        change('Hello');

        fireEvent.click(screen.getByRole('link', { name: 'Elsewhere' }));
        let dialog = await screen.findByRole('alertdialog', { name: LEAVE_SETTINGS_TITLE });
        expect(dialog).toHaveTextContent('1 unsaved change on this page will be lost.');
        // Danger question: focus starts on Stay.
        await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Stay' })).toHaveFocus());
        fireEvent.click(within(dialog).getByRole('button', { name: 'Stay' }));
        await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
        expect(router.state.location.pathname).toBe('/settings');

        fireEvent.click(screen.getByRole('link', { name: 'Elsewhere' }));
        dialog = await screen.findByRole('alertdialog', { name: LEAVE_SETTINGS_TITLE });
        fireEvent.click(within(dialog).getByRole('button', { name: 'Leave' }));
        expect(await screen.findByText('elsewhere page')).toBeInTheDocument();
    });

    it('lets the browser ask on reload or close only with unsaved changes', () => {
        renderAt();
        const clean = new Event('beforeunload', { cancelable: true });
        act(() => { window.dispatchEvent(clean); });
        expect(clean.defaultPrevented).toBe(false);

        change('Hello');
        const dirty = new Event('beforeunload', { cancelable: true });
        act(() => { window.dispatchEvent(dirty); });
        expect(dirty.defaultPrevented).toBe(true);
    });

    it('shows a load failure with Retry and no form', () => {
        renderAt({ loadError: 'Demo settings could not be loaded' });
        expect(screen.getByRole('alert')).toHaveTextContent('Demo settings could not be loaded');
        expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
        expect(screen.queryByLabelText('MOTD')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Save/ })).not.toBeInTheDocument();
    });
});
