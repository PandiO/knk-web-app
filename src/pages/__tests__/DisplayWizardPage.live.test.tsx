import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DisplayWizardPage } from '../DisplayWizardPage';
import { fakeRealtime } from '../../test-utils/fakeRealtime';
import { LIVE_REFRESH_DEBOUNCE_MS } from '../../realtime/liveUpdates';

/** PandiO/knk-workspace#183 (Realtime S4): another admin's change to the shown entity, on the detail page. */

const mockNavigate = jest.fn();
// virtual: CRA's Jest resolver can't resolve react-router-dom's package exports
jest.mock('react-router-dom', () => ({
    useNavigate: () => mockNavigate,
    useParams: () => ({ entityName: 'town', id: '4' }),
    useLocation: () => ({ pathname: '/display/town/4', search: '?returnTo=%2Fdashboard%2FTown' }),
    useSearchParams: () => [new URLSearchParams('returnTo=%2Fdashboard%2FTown')],
}), { virtual: true });
jest.mock('../../hooks/useEntityMetadata', () => ({
    useEntityMetadata: () => ({ baseMetadata: [{ entityName: 'Town', displayName: 'Town', fields: [] }] }),
}));
jest.mock('../../utils/entityApiMapping', () => ({ getDeleteFunctionForEntity: jest.fn() }));
jest.mock('../../utils/toast', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
let mockLiveKey: number | undefined;
jest.mock('../../components/DisplayWizard/DisplayWizard', () => ({
    __esModule: true,
    default: ({ renderHeader, liveRefreshKey }: { renderHeader?: (entity: Record<string, unknown>) => unknown; liveRefreshKey?: number }) => {
        mockLiveKey = liveRefreshKey;
        return <div>{renderHeader?.({ id: 4, name: 'Cinix' }) as never}</div>;
    },
}));

beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
});
afterEach(() => jest.useRealTimers());

const settle = () => act(() => { jest.advanceTimersByTime(LIVE_REFRESH_DEBOUNCE_MS); });

it("re-reads the entity on another admin's change to it, and says who", () => {
    const hub = fakeRealtime({ userId: 1 });
    render(<hub.Provider><DisplayWizardPage /></hub.Provider>);
    expect(mockLiveKey).toBe(0);

    act(() => {
        hub.emit('EntityChanged', { type: 'Town', id: 5, op: 'Updated', actorUserId: 7, actorName: 'alice' }, 7);
    });
    settle();
    expect(mockLiveKey).toBe(0); // another town

    act(() => {
        hub.emit('EntityChanged', { type: 'Town', id: 4, op: 'Updated', actorUserId: 7, actorName: 'alice' }, 7);
    });
    settle();
    expect(mockLiveKey).toBe(1);
    expect(screen.getByTestId('detail-live-notice')).toHaveTextContent(/^Updated by alice at /);
});

it('says the entity was deleted and offers the way back, without re-reading it', () => {
    const hub = fakeRealtime({ userId: 1 });
    render(<hub.Provider><DisplayWizardPage /></hub.Provider>);

    act(() => {
        hub.emit('EntityChanged', { type: 'Town', id: 4, op: 'Deleted', actorUserId: 7, actorName: 'alice' }, 7);
    });
    settle();

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('This Town was deleted by alice.');
    expect(mockLiveKey).toBe(0);
    fireEvent.click(within(alert).getByRole('button', { name: 'Back' }));
    expect(mockNavigate).toHaveBeenLastCalledWith('/dashboard/Town');

    // A later change (e.g. a reconnect) keeps the deleted notice.
    act(() => hub.reconnect());
    settle();
    expect(screen.getByRole('alert')).toBeInTheDocument();
});

it('without the hub, nothing changes', () => {
    render(<DisplayWizardPage />);
    settle();
    expect(mockLiveKey).toBe(0);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
