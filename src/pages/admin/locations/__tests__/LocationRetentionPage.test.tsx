import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
    CopyCommand,
    LocationRetentionPage,
    coordinateTeleportCommand,
    pluginTeleportCommand,
} from '../LocationRetentionPage';
import { locationRetentionClient } from '../../../../apiClients/locationRetentionClient';
import { LocationOrphanDto, LocationOrphanPageDto } from '../../../../types/dtos/locationRetention/LocationRetentionDtos';

// virtual: CRA's Jest resolver can't resolve react-router-dom's package exports
jest.mock('react-router-dom', () => ({
    Link: ({ to, children, ...rest }: { to: string; children: React.ReactNode }) => <a href={to} {...rest}>{children}</a>
}), { virtual: true });

jest.mock('../../../../apiClients/locationRetentionClient', () => ({
    locationRetentionClient: {
        getOrphans: jest.fn(), keep: jest.fn(), delete: jest.fn(), getStatus: jest.fn(), runNow: jest.fn(), updateSettings: jest.fn()
    }
}));

const mockGranted = new Set<string>();
jest.mock('../../../../hooks/useStaffAccess', () => ({
    usePermission: (node: string) => ({ allowed: mockGranted.has(node), isChecking: false })
}));

const ALL_NODES = [
    'knk.admin.location.orphans', 'knk.admin.location.orphans.keep', 'knk.admin.location.orphans.delete',
    'knk.admin.location.orphans.run', 'knk.admin.location.retention', 'knk.admin.location.tp'
];

const ORPHAN: LocationOrphanDto = {
    id: 3, locationId: 41, status: 'Open', flaggedAt: '2026-10-04T04:00:00', flaggedByRunId: 9, lastSeenAt: '2026-10-04T04:00:00',
    name: 'Location', world: 'world', x: 120.5, y: 64, z: -33.25, yaw: 90, pitch: 0, locationCreatedAt: null, locationExists: true,
};
const REFLAGGED: LocationOrphanDto = {
    ...ORPHAN, id: 4, locationId: 42, world: 'world_nether',
    previousDecision: { itemId: 1, status: 'Kept', decidedByUsername: 'mod', decidedAt: '2026-04-01T10:00:00', decisionNote: 'Event marker' },
};

const page = (items: LocationOrphanDto[]): LocationOrphanPageDto => ({
    items, totalCount: items.length, pageNumber: 1, pageSize: 25, openCount: items.length, keptCount: 0,
});

describe('LocationRetentionPage', () => {
    beforeEach(() => {
        mockGranted.clear();
        ALL_NODES.forEach(n => mockGranted.add(n));
        (locationRetentionClient.getOrphans as jest.Mock).mockReset().mockResolvedValue(page([ORPHAN, REFLAGGED]));
        (locationRetentionClient.keep as jest.Mock).mockReset();
        (locationRetentionClient.delete as jest.Mock).mockReset();
        (locationRetentionClient.runNow as jest.Mock).mockReset();
        (locationRetentionClient.getStatus as jest.Mock).mockReset().mockResolvedValue({
            settings: { scheduleEnabled: true, frequency: 'Weekly', runDayOfWeek: 'Sunday', runAtTime: '04:00', gracePeriodDays: 7, keptRecheckMonths: 6, timeZone: 'Europe/Amsterdam' },
            lastRun: {
                id: 9, trigger: 'scheduled', startedAt: '2026-10-04T04:00:00', succeeded: true, candidatesScanned: 12, orphansFound: 2,
                newOrphans: 2, alreadyKnown: 0, reflagged: 1, resolved: 0, durationMs: 31,
            },
            nextScheduledRunAt: '2026-10-11T02:00:00Z', running: false,
            relations: ['Domain.LocationId', 'GateDoor.AnchorPointId'], otherReferenceSources: ['Game settings'],
        });
    });

    it('lists open orphans with the last run, the schedule and an earlier Keep decision', async () => {
        render(<LocationRetentionPage />);

        await waitFor(() => expect(screen.getByText('Location #41')).toBeInTheDocument());
        expect(locationRetentionClient.getOrphans).toHaveBeenCalledWith('open', 1, 25);
        expect(screen.getByText(/world · 120.5, 64, -33.25/)).toBeInTheDocument();
        expect(screen.getByText(/Kept before by mod/)).toHaveTextContent('Event marker');
        await waitFor(() => expect(screen.getByText(/12 unnamed Locations checked, 2 orphaned, 2 new \(1 kept before\)/)).toBeInTheDocument());
        expect(screen.getByText(/Runs every Sunday at 04:00 server time \(Europe\/Amsterdam\)/)).toBeInTheDocument();
    });

    it('deletes only after the FeedbackModal confirmation, with the note', async () => {
        const confirmSpy = jest.spyOn(window, 'confirm');
        (locationRetentionClient.delete as jest.Mock).mockResolvedValue({ outcome: 'Deleted', message: 'Location 41 deleted.', item: { ...ORPHAN, status: 'Deleted' } });
        render(<LocationRetentionPage />);
        await waitFor(() => expect(screen.getByText('Location #41')).toBeInTheDocument());

        fireEvent.change(screen.getByLabelText('Note for Location 41'), { target: { value: 'Test leftover' } });
        fireEvent.click(screen.getByRole('button', { name: 'Delete Location 41' }));

        const dialog = screen.getByRole('dialog', { name: 'Delete Location #41?' });
        expect(dialog).toHaveTextContent('Test leftover');
        expect(locationRetentionClient.delete).not.toHaveBeenCalled();
        fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

        await waitFor(() => expect(locationRetentionClient.delete).toHaveBeenCalledWith(3, 'Test leftover'));
        await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Location 41 deleted.'));
        expect(confirmSpy).not.toHaveBeenCalled();
        confirmSpy.mockRestore();
    });

    it('closing the confirmation does nothing', async () => {
        render(<LocationRetentionPage />);
        await waitFor(() => expect(screen.getByText('Location #41')).toBeInTheDocument());

        fireEvent.click(screen.getByRole('button', { name: 'Keep Location 41' }));
        fireEvent.click(screen.getByRole('button', { name: 'Close' }));

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(locationRetentionClient.keep).not.toHaveBeenCalled();
    });

    it('keeps an orphan after confirming', async () => {
        (locationRetentionClient.keep as jest.Mock).mockResolvedValue({ ...ORPHAN, status: 'Kept' });
        render(<LocationRetentionPage />);
        await waitFor(() => expect(screen.getByText('Location #41')).toBeInTheDocument());

        fireEvent.click(screen.getByRole('button', { name: 'Keep Location 41' }));
        fireEvent.click(within(screen.getByRole('dialog', { name: 'Keep Location #41?' })).getByRole('button', { name: 'Keep' }));

        await waitFor(() => expect(locationRetentionClient.keep).toHaveBeenCalledWith(3, ''));
        await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Location #41 kept.'));
    });

    it('explains a refused delete when the server re-check found a relation', async () => {
        const refused = Object.assign(new Error('Not deleted: Another record references it now.'), {
            status: 409,
            response: { outcome: 'NoLongerOrphan', message: 'Not deleted: Another record references it now.', item: { ...ORPHAN, status: 'Resolved' } },
        });
        (locationRetentionClient.delete as jest.Mock).mockRejectedValue(refused);
        render(<LocationRetentionPage />);
        await waitFor(() => expect(screen.getByText('Location #41')).toBeInTheDocument());

        fireEvent.click(screen.getByRole('button', { name: 'Delete Location 41' }));
        fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));

        await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Another record references it now.'));
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('hides actions the staff member has no node for', async () => {
        mockGranted.clear();
        mockGranted.add('knk.admin.location.orphans');
        render(<LocationRetentionPage />);
        await waitFor(() => expect(screen.getByText('Location #41')).toBeInTheDocument());

        expect(screen.queryByRole('button', { name: /Keep Location/ })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Delete Location/ })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Teleport info' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Run check now/ })).not.toBeInTheDocument();
    });

    it('runs the check on demand and reloads the list', async () => {
        (locationRetentionClient.runNow as jest.Mock).mockResolvedValue({});
        render(<LocationRetentionPage />);
        await waitFor(() => expect(screen.getByText('Location #41')).toBeInTheDocument());

        fireEvent.click(screen.getByRole('button', { name: /Run check now/ }));

        await waitFor(() => expect(locationRetentionClient.runNow).toHaveBeenCalled());
        await waitFor(() => expect(locationRetentionClient.getOrphans).toHaveBeenCalledTimes(2));
    });

    it('shows both teleport commands for a row', async () => {
        render(<LocationRetentionPage />);
        await waitFor(() => expect(screen.getByText('Location #42')).toBeInTheDocument());

        fireEvent.click(within(screen.getByTestId('orphan-4')).getByRole('button', { name: 'Teleport info' }));

        expect(screen.getByText('/knk location tp 42')).toBeInTheDocument();
        expect(screen.getByText('/tp @s 120.5 64 -33.25 90 0')).toBeInTheDocument();
        // The world to stand in, instead of a guessed /execute dimension (smoke test 2026-10-09).
        expect(screen.getByText(/while in world world_nether/)).toBeInTheDocument();
    });
});

describe('teleport commands', () => {
    it('builds the plugin and coordinate commands', () => {
        expect(pluginTeleportCommand(7)).toBe('/knk location tp 7');
        expect(coordinateTeleportCommand({ x: 1.234, y: 70, z: -5, yaw: 0, pitch: 12.5 }))
            .toBe('/tp @s 1.23 70 -5 0 12.5');
    });
});

describe('CopyCommand', () => {
    const originalClipboard = navigator.clipboard;
    const originalSecure = window.isSecureContext;

    afterEach(() => {
        Object.defineProperty(navigator, 'clipboard', { value: originalClipboard, configurable: true });
        Object.defineProperty(window, 'isSecureContext', { value: originalSecure, configurable: true });
    });

    it('copies with the Clipboard API and confirms', async () => {
        const writeText = jest.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
        Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
        render(<CopyCommand label="In game" command="/knk location tp 7" />);

        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Copy In game' })); });

        expect(writeText).toHaveBeenCalledWith('/knk location tp 7');
        expect(screen.getByText('Copied')).toBeInTheDocument();
    });

    it('falls back to a selected field when the Clipboard API is unavailable (plain HTTP)', async () => {
        Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
        Object.defineProperty(window, 'isSecureContext', { value: false, configurable: true });
        render(<CopyCommand label="In game" command="/knk location tp 7" />);

        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Copy In game' })); });

        expect(screen.getByLabelText('In game (select and copy)')).toHaveValue('/knk location tp 7');
        expect(screen.getByText(/press Ctrl\+C/)).toBeInTheDocument();
    });

    it('falls back when the browser refuses the copy', async () => {
        Object.defineProperty(navigator, 'clipboard', { value: { writeText: jest.fn().mockRejectedValue(new Error('denied')) }, configurable: true });
        Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
        render(<CopyCommand label="In game" command="/knk location tp 7" />);

        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Copy In game' })); });

        expect(screen.getByLabelText('In game (select and copy)')).toBeInTheDocument();
    });
});
