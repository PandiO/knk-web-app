import React from 'react';
import { RealtimeContext, RealtimeContextValue, RealtimeHandler } from '../realtime/RealtimeProvider';

/**
 * A stand-in web hub for component tests (#181, #183): wrap the component in `hub.Provider`, then
 * `hub.emit(type, payload, actorUserId?)` delivers an event and `hub.reconnect()` runs the
 * reconnect handlers, as RealtimeProvider would.
 */
export function fakeRealtime(options: { connected?: boolean; userId?: number | null } = {}) {
  const handlers = new Map<string, Set<RealtimeHandler<any>>>();
  const reconnected = new Set<() => void>();
  const value: RealtimeContextValue = {
    connected: options.connected ?? true,
    userId: options.userId ?? null,
    subscribe: (type, handler) => {
      if (!handlers.has(type)) handlers.set(type, new Set());
      handlers.get(type)!.add(handler as RealtimeHandler<any>);
      return () => {
        handlers.get(type)?.delete(handler as RealtimeHandler<any>);
      };
    },
    onReconnected: handler => {
      reconnected.add(handler);
      return () => {
        reconnected.delete(handler);
      };
    },
    joinTask: async () => true,
    leaveTask: () => undefined,
  };
  let seq = 1;
  const emit = (type: string, payload: unknown, actorUserId: number | null = null) => {
    seq += 1;
    const envelope = { v: 1, seq, type, at: '2026-11-05T20:00:00Z', actor: { userId: actorUserId, source: 'web' }, payload };
    handlers.get(type)?.forEach(handler => handler(payload, envelope as never));
  };
  const reconnect = () => reconnected.forEach(handler => handler());
  const listeners = (type: string) => handlers.get(type)?.size ?? 0;
  const Provider: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>
  );
  return { value, emit, reconnect, listeners, Provider };
}
