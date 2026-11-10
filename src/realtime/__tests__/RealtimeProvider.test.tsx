import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { HubConnectionState } from '@microsoft/signalr';
import {
  RealtimeProvider,
  useRealtime,
  useRealtimeEvent,
  useRealtimeReconnected,
  webHubUrl,
} from '../RealtimeProvider';

/** PandiO/knk-workspace#181 (DESIGN §4.5): the web hub connection, event fan-out, task groups and reconnects. */

let mockUser: { id: number } | null = { id: 42 };
jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}));
jest.mock('../../utils/tokenService', () => ({
  tokenService: { getAccessToken: () => 'jwt-token' },
}));
jest.mock('../../services/sessionRefresh', () => ({
  refreshSession: jest.fn().mockResolvedValue('renewed'),
}));

/** A HubConnection stand-in: records handlers and invocations. */
class FakeConnection {
  state = HubConnectionState.Disconnected;
  handlers = new Map<string, (arg: unknown) => void>();
  invoked: [string, unknown][] = [];
  reconnected?: () => void;
  reconnecting?: () => void;
  closed?: () => void;
  start = jest.fn(async () => {
    this.state = HubConnectionState.Connected;
  });
  stop = jest.fn(async () => {
    this.state = HubConnectionState.Disconnected;
  });
  on(type: string, handler: (arg: unknown) => void) {
    this.handlers.set(type, handler);
  }
  onreconnected(handler: () => void) {
    this.reconnected = handler;
  }
  onreconnecting(handler: () => void) {
    this.reconnecting = handler;
  }
  onclose(handler: () => void) {
    this.closed = handler;
  }
  invoke = jest.fn(async (method: string, arg: unknown) => {
    this.invoked.push([method, arg]);
    return true;
  });
  emit(type: string, payload: unknown) {
    this.handlers.get(type)?.({ v: 1, seq: 2, type, at: '2026-11-02T12:00:00Z', payload });
  }
}

const Probe: React.FC<{ onEvent: (payload: unknown) => void; onReconnect: () => void }> = ({ onEvent, onReconnect }) => {
  const realtime = useRealtime();
  useRealtimeEvent('WorldTaskUpdated', onEvent);
  useRealtimeReconnected(onReconnect);
  return (
    <div>
      <span>{realtime.connected ? 'connected' : 'disconnected'}</span>
      <button type="button" onClick={() => void realtime.joinTask(7)}>join</button>
      <button type="button" onClick={() => realtime.leaveTask(7)}>leave</button>
    </div>
  );
};

describe('RealtimeProvider (#181)', () => {
  beforeEach(() => {
    mockUser = { id: 42 };
  });

  it('builds the hub URL from the API base URL', () => {
    expect(webHubUrl('/api')).toBe('/api/hubs/web');
    expect(webHubUrl('http://localhost:5294/api/')).toBe('http://localhost:5294/api/hubs/web');
  });

  it('connects for a logged-in user with the stored token and fans events out to subscribers', async () => {
    const connection = new FakeConnection();
    const create = jest.fn((_url: string, token: () => Promise<string>) => {
      void token().then(t => expect(t).toBe('jwt-token'));
      return connection as never;
    });
    const onEvent = jest.fn();
    render(
      <RealtimeProvider createConnection={create}>
        <Probe onEvent={onEvent} onReconnect={jest.fn()} />
      </RealtimeProvider>
    );

    expect(await screen.findByText('connected')).toBeInTheDocument();
    expect(create).toHaveBeenCalledWith(expect.stringMatching(/\/hubs\/web$/), expect.any(Function));
    act(() => connection.emit('WorldTaskUpdated', { taskId: 7, status: 'InProgress' }));
    expect(onEvent).toHaveBeenCalledWith({ taskId: 7, status: 'InProgress' }, expect.objectContaining({ seq: 2 }));
  });

  it('does not connect while logged out', () => {
    mockUser = null;
    const create = jest.fn();
    render(
      <RealtimeProvider createConnection={create}>
        <Probe onEvent={jest.fn()} onReconnect={jest.fn()} />
      </RealtimeProvider>
    );
    expect(create).not.toHaveBeenCalled();
    expect(screen.getByText('disconnected')).toBeInTheDocument();
  });

  it('joins task groups, joins them again after a reconnect and tells components to re-read', async () => {
    const connection = new FakeConnection();
    const onReconnect = jest.fn();
    render(
      <RealtimeProvider createConnection={() => connection as never}>
        <Probe onEvent={jest.fn()} onReconnect={onReconnect} />
      </RealtimeProvider>
    );
    await screen.findByText('connected');
    onReconnect.mockClear();

    act(() => screen.getByText('join').click());
    await waitFor(() => expect(connection.invoked).toContainEqual(['JoinTask', 7]));

    act(() => connection.reconnecting?.());
    expect(screen.getByText('disconnected')).toBeInTheDocument();
    connection.invoked = [];
    await act(async () => connection.reconnected?.());
    expect(screen.getByText('connected')).toBeInTheDocument();
    await waitFor(() => expect(connection.invoked).toContainEqual(['JoinTask', 7]));
    expect(onReconnect).toHaveBeenCalled();

    act(() => screen.getByText('leave').click());
    await waitFor(() => expect(connection.invoked).toContainEqual(['LeaveTask', 7]));
  });

  it('retries when the hub cannot be reached, and stops on unmount', async () => {
    jest.useFakeTimers();
    try {
      const connection = new FakeConnection();
      connection.start.mockRejectedValueOnce(new Error('negotiate 404'));
      const { unmount } = render(
        <RealtimeProvider createConnection={() => connection as never}>
          <Probe onEvent={jest.fn()} onReconnect={jest.fn()} />
        </RealtimeProvider>
      );
      await act(async () => {
        await Promise.resolve();
      });
      expect(screen.getByText('disconnected')).toBeInTheDocument();
      await act(async () => {
        jest.advanceTimersByTime(1000);
        await Promise.resolve();
      });
      expect(connection.start).toHaveBeenCalledTimes(2);
      unmount();
      expect(connection.stop).toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('without a provider nothing is connected (components keep polling)', async () => {
    const Bare = () => {
      const realtime = useRealtime();
      return <span>{realtime.connected ? 'yes' : 'no'}</span>;
    };
    render(<Bare />);
    expect(screen.getByText('no')).toBeInTheDocument();
  });
});
