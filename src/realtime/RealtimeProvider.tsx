import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
} from '@microsoft/signalr';
import { appConfig } from '../config/appConfig';
import { tokenService } from '../utils/tokenService';
import { refreshSession } from '../services/sessionRefresh';
import { useAuth } from '../contexts/AuthContext';

/**
 * PandiO/knk-workspace#181 (WT2, DESIGN §4.5): the browser's connection to knk-web-api's web hub
 * (`/api/hubs/web`, JWT as `access_token`). One connection per logged-in tab; nothing connects while
 * logged out. Components subscribe to event types; while the hub is not connected they keep polling
 * (P5), and after a reconnect they re-read what they show (P2), told through `onReconnected`.
 */

/** The envelope every hub message carries (DESIGN §4.2). */
export interface RealtimeEnvelope<T = unknown> {
  v: number;
  seq: number;
  type: string;
  at: string;
  actor?: { userId?: number | null; source: string } | null;
  payload: T;
}

export type RealtimeHandler<T = unknown> = (payload: T, envelope: RealtimeEnvelope<T>) => void;

export interface RealtimeContextValue {
  /** True while the web hub connection is up. */
  connected: boolean;
  /** #183: the logged-in user the connection is for (null without one), so live updates can skip your own changes. */
  userId?: number | null;
  /** Listen for one event type; returns the unsubscribe. */
  subscribe: <T = unknown>(type: string, handler: RealtimeHandler<T>) => () => void;
  /** Called after every (re)connect: re-read what you show. Returns the unsubscribe. */
  onReconnected: (handler: () => void) => () => void;
  /** Receive `WorldTaskUpdated` for this task (the API checks it is yours); joined again after a reconnect. */
  joinTask: (taskId: number) => Promise<boolean>;
  leaveTask: (taskId: number) => void;
}

/** The event types the web app listens for (DESIGN §6.5; EntityChanged and PresenceChanged: #183). */
export const WEB_EVENT_TYPES = ['WorldTaskUpdated', 'CatalogScanUpdated', 'EntityChanged', 'PresenceChanged'] as const;

/** Without a provider (tests, logged out): never connected, so every consumer keeps polling. */
const disconnected: RealtimeContextValue = {
  connected: false,
  userId: null,
  subscribe: () => () => undefined,
  onReconnected: () => () => undefined,
  joinTask: async () => false,
  leaveTask: () => undefined,
};

/** Exported for tests (a fake connection state); components use `useRealtime`. */
export const RealtimeContext = createContext<RealtimeContextValue>(disconnected);

export const useRealtime = (): RealtimeContextValue => useContext(RealtimeContext);

/** Reconnect delays after the connection closed for good (SignalR's own reconnect gave up, or a token expired). */
export const RESTART_DELAYS_MS = [1000, 2000, 5000, 10000, 30000];

/** `${baseUrl}/hubs/web`: `/api/hubs/web` behind the same-origin proxy. */
export function webHubUrl(baseUrl: string = appConfig.api.baseUrl): string {
  return `${baseUrl.replace(/\/+$/, '')}/hubs/web`;
}

export interface RealtimeProviderProps {
  children: React.ReactNode;
  /** Tests: builds the connection. */
  createConnection?: (url: string, accessToken: () => Promise<string>) => HubConnection;
}

const defaultCreateConnection = (url: string, accessToken: () => Promise<string>): HubConnection =>
  new HubConnectionBuilder()
    .withUrl(url, { accessTokenFactory: accessToken })
    .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
    .configureLogging(LogLevel.Warning)
    .build();

export const RealtimeProvider: React.FC<RealtimeProviderProps> = ({ children, createConnection = defaultCreateConnection }) => {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [connected, setConnected] = useState(false);
  const connectionRef = useRef<HubConnection | null>(null);
  const handlersRef = useRef(new Map<string, Set<RealtimeHandler<any>>>());
  const reconnectedRef = useRef(new Set<() => void>());
  const tasksRef = useRef(new Set<number>());

  const rejoinAndNotify = useCallback(async (connection: HubConnection) => {
    for (const taskId of Array.from(tasksRef.current)) {
      try {
        await connection.invoke('JoinTask', taskId);
      } catch {
        // The next reconnect tries again; the component polls meanwhile.
      }
    }
    reconnectedRef.current.forEach(handler => {
      try {
        handler();
      } catch (error) {
        console.error('Realtime reconnect handler failed:', error);
      }
    });
  }, []);

  useEffect(() => {
    if (userId === null) return undefined;
    let stopped = false;
    let attempt = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const accessToken = async (): Promise<string> => {
      const token = tokenService.getAccessToken();
      if (token) return token;
      // An expired session: one renewal through the single-flight refresh (the refresh cookie).
      await refreshSession();
      return tokenService.getAccessToken() ?? '';
    };

    const connection = createConnection(webHubUrl(), accessToken);
    connectionRef.current = connection;
    WEB_EVENT_TYPES.forEach(type => {
      connection.on(type, (envelope: RealtimeEnvelope) => {
        handlersRef.current.get(type)?.forEach(handler => {
          try {
            handler(envelope?.payload, envelope);
          } catch (error) {
            console.error(`Realtime handler for ${type} failed:`, error);
          }
        });
      });
    });
    connection.onreconnecting(() => setConnected(false));
    connection.onreconnected(() => {
      setConnected(true);
      void rejoinAndNotify(connection);
    });

    const start = async () => {
      if (stopped) return;
      try {
        await connection.start();
        if (stopped) {
          await connection.stop();
          return;
        }
        attempt = 0;
        setConnected(true);
        await rejoinAndNotify(connection);
      } catch {
        if (stopped) return;
        // The hub may be unreachable (API down, proxy without the hub path): polls keep working.
        const delay = RESTART_DELAYS_MS[Math.min(attempt, RESTART_DELAYS_MS.length - 1)];
        attempt += 1;
        timer = setTimeout(() => void start(), delay);
      }
    };

    connection.onclose(() => {
      setConnected(false);
      if (stopped) return;
      // Closed for good (e.g. the API closes it when the access token expires): start again with a fresh token.
      timer = setTimeout(() => void start(), RESTART_DELAYS_MS[0]);
    });

    void start();

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      setConnected(false);
      connectionRef.current = null;
      void connection.stop().catch(() => undefined);
    };
  }, [userId, createConnection, rejoinAndNotify]);

  const subscribe = useCallback(<T,>(type: string, handler: RealtimeHandler<T>) => {
    const handlers = handlersRef.current;
    if (!handlers.has(type)) handlers.set(type, new Set());
    handlers.get(type)!.add(handler as RealtimeHandler<any>);
    return () => {
      handlers.get(type)?.delete(handler as RealtimeHandler<any>);
    };
  }, []);

  const onReconnected = useCallback((handler: () => void) => {
    reconnectedRef.current.add(handler);
    return () => {
      reconnectedRef.current.delete(handler);
    };
  }, []);

  const joinTask = useCallback(async (taskId: number): Promise<boolean> => {
    tasksRef.current.add(taskId);
    const connection = connectionRef.current;
    if (!connection || connection.state !== HubConnectionState.Connected) return false;
    try {
      return !!(await connection.invoke<boolean>('JoinTask', taskId));
    } catch {
      return false;
    }
  }, []);

  const leaveTask = useCallback((taskId: number) => {
    tasksRef.current.delete(taskId);
    const connection = connectionRef.current;
    if (connection && connection.state === HubConnectionState.Connected) {
      void connection.invoke('LeaveTask', taskId).catch(() => undefined);
    }
  }, []);

  const value = useMemo<RealtimeContextValue>(
    () => ({ connected, userId, subscribe, onReconnected, joinTask, leaveTask }),
    [connected, userId, subscribe, onReconnected, joinTask, leaveTask],
  );

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
};

/** Subscribes `handler` to `type` for the component's lifetime (the latest handler is used). */
export function useRealtimeEvent<T = unknown>(type: string, handler: RealtimeHandler<T>): void {
  const { subscribe } = useRealtime();
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  useEffect(() => subscribe<T>(type, (payload, envelope) => handlerRef.current(payload, envelope)), [subscribe, type]);
}

/** Runs `handler` after every hub (re)connect (re-read what the component shows). */
export function useRealtimeReconnected(handler: () => void): void {
  const { onReconnected } = useRealtime();
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  useEffect(() => onReconnected(() => handlerRef.current()), [onReconnected]);
}
