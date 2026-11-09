import { useEffect, useRef } from 'react';
import { useRealtime, useRealtimeEvent, useRealtimeReconnected } from './RealtimeProvider';

/**
 * PandiO/knk-workspace#183 (Realtime S4, DESIGN §6.5, §9): live updates on the web hub. The API sends
 * these only to staff who hold the node that gates the same data over REST (`knk.admin.content`
 * for the dashboard and detail page, `knk.admin.user.manage` for users and presence). Both are
 * doorbells: the page re-reads over REST. Without a hub connection nothing arrives and the pages
 * work as before (Reload, Back, their own polls).
 */

/** `EntityChanged` on the web hub. */
export interface EntityChangedPayload {
  /** The dashboard type name (`Town`; a town also sends one for `Domain`). */
  type: string;
  /** Null when many of that type changed at once: re-read the list. */
  id?: number | null;
  op: 'Created' | 'Updated' | 'Deleted' | string;
  /** The web user who saved it; null for the game server or a background job. */
  actorUserId?: number | null;
  actorName?: string | null;
}

/** `PresenceChanged` on the web hub. */
export interface PresenceChangedPayload {
  /** Null when many players changed at once (a server reconnect): re-read. */
  userId?: number | null;
  online?: boolean | null;
  serverId?: string | null;
  lastSeenAt?: string | null;
}

/** What the debounced callback is told. */
export interface LiveChange {
  /** Names of the other staff who changed it, in order; empty for the game server, a job or a reconnect. */
  actors: string[];
  /** True when the watched entity (an `id` was given) was deleted. */
  deleted: boolean;
  /** True when the hub (re)connected: something may have changed while it was down. */
  reconnect: boolean;
}

/** How long a burst of changes is gathered into one refresh. */
export const LIVE_REFRESH_DEBOUNCE_MS = 750;

const sameType = (a: string | null | undefined, b: string | null | undefined) =>
  !!a && !!b && a.toLowerCase() === b.toLowerCase();

/**
 * Whether `payload` concerns the watched type (and entity, when `id` is given), and isn't the
 * viewer's own change (their own save already refreshes the page they return to).
 */
export function isRelevantChange(
  payload: EntityChangedPayload | null | undefined,
  type: string | null | undefined,
  id: number | null | undefined,
  ownUserId: number | null | undefined,
): boolean {
  if (!payload || !sameType(payload.type, type)) return false;
  if (id != null && payload.id != null && payload.id !== id) return false;
  if (ownUserId != null && payload.actorUserId != null && payload.actorUserId === ownUserId) return false;
  return true;
}

/** "Updated by alice", "Updated by alice and bob", "Updated by alice, bob and 2 others"; "Updated" without names. */
export function describeActors(actors: string[], verb = 'Updated'): string {
  if (actors.length === 0) return verb;
  if (actors.length === 1) return `${verb} by ${actors[0]}`;
  if (actors.length === 2) return `${verb} by ${actors[0]} and ${actors[1]}`;
  const rest = actors.length - 2;
  return `${verb} by ${actors[0]}, ${actors[1]} and ${rest} other${rest === 1 ? '' : 's'}`;
}

interface Pending {
  actors: string[];
  deleted: boolean;
  reconnect: boolean;
  timer?: ReturnType<typeof setTimeout>;
}

/**
 * Calls `onChange` once per burst of `EntityChanged` events for `type` (and `id`) from someone else,
 * debounced, and after every hub (re)connect. `type` null watches nothing.
 */
export function useLiveEntityChanges(
  type: string | null | undefined,
  onChange: (change: LiveChange) => void,
  options: { id?: number | null; debounceMs?: number } = {},
): void {
  const ownUserId = useRealtime().userId ?? null;
  const { id = null, debounceMs = LIVE_REFRESH_DEBOUNCE_MS } = options;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const pendingRef = useRef<Pending>({ actors: [], deleted: false, reconnect: false });

  const schedule = (update: (pending: Pending) => void) => {
    const pending = pendingRef.current;
    update(pending);
    if (pending.timer) clearTimeout(pending.timer);
    pending.timer = setTimeout(() => {
      const { actors, deleted, reconnect } = pendingRef.current;
      pendingRef.current = { actors: [], deleted: false, reconnect: false };
      onChangeRef.current({ actors, deleted, reconnect });
    }, debounceMs);
  };

  // A different type or entity starts from nothing; leaving drops what was gathered.
  useEffect(() => () => {
    if (pendingRef.current.timer) clearTimeout(pendingRef.current.timer);
    pendingRef.current = { actors: [], deleted: false, reconnect: false };
  }, [type, id]);

  useRealtimeEvent<EntityChangedPayload>('EntityChanged', payload => {
    if (!type || !isRelevantChange(payload, type, id, ownUserId)) return;
    const name = payload.actorName?.trim();
    schedule(pending => {
      if (name && !pending.actors.includes(name)) pending.actors.push(name);
      if (id != null && payload.id === id && payload.op === 'Deleted') pending.deleted = true;
    });
  });

  useRealtimeReconnected(() => {
    if (!type) return;
    schedule(pending => {
      pending.reconnect = true;
    });
  });
}

/** Calls `onChange` for every `PresenceChanged` (null `userId`: re-read), and after every hub (re)connect with null. */
export function usePresenceChanges(onChange: (payload: PresenceChangedPayload | null) => void): void {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  useRealtimeEvent<PresenceChangedPayload>('PresenceChanged', payload => onChangeRef.current(payload ?? null));
  useRealtimeReconnected(() => onChangeRef.current(null));
}
