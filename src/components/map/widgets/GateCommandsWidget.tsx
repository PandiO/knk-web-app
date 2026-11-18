import React, { useCallback, useEffect, useRef, useState } from 'react';
import { gateCommandClient } from '../../../apiClients/gateCommandClient';
import { gateDoorClient } from '../../../apiClients/gateDoorClient';
import { useActionGate } from '../../../hooks/useActionGate';
import type { GateDoorDto } from '../../../types/dtos/gateStructure/GateDoorDto';
import type { GateCommandAction, GateCommandResponseDto, MapStructurePanelDto } from '../../../types/dtos/map/MapDtos';
import type { MapWidgetProps } from '../mapActionRegistry';
import { doorStateLabel } from './GateDoorsWidget';

/** The node of gate commands (knk-web-api `RequirePermission(GateAdmin)`, O17). */
export const GATE_ADMIN_NODE = 'knk.gate.admin';

export const SIEGE_HINT = 'Gate is in a running siege';

export const GATE_COMMAND_ACTIONS: ReadonlyArray<{ action: GateCommandAction; label: string }> = [
  { action: 'open', label: 'Open' },
  { action: 'close', label: 'Close' },
  { action: 'toggle', label: 'Toggle' },
  { action: 'repair', label: 'Repair' },
];

export type GateCommandOutcome = { tone: 'success' | 'warning' | 'error'; text: string; siege?: boolean };

const apiMessage = (err: unknown): string | null => {
  const message = (err as { message?: unknown } | null)?.message;
  return typeof message === 'string' && message && !message.startsWith('HTTP ') && message !== 'promise timeout'
    ? message
    : null;
};

/** What the panel says after a command (§ 5 rule 11: done, refused with reason, timed out after 5 s). */
export function describeGateCommandResult(response: GateCommandResponseDto): GateCommandOutcome {
  const message = response.message?.trim() || null;
  if (response.result === 'done') return { tone: 'success', text: message ? `Done: ${message}` : 'Done.' };
  if (response.result === 'refused') {
    return { tone: 'warning', text: `Refused: ${message ?? 'the game server refused the command.'}` };
  }
  return { tone: 'error', text: message ?? `Unexpected answer "${response.result}".` };
}

export function describeGateCommandError(err: unknown): GateCommandOutcome {
  const status = (err as { status?: number } | null)?.status;
  const message = apiMessage(err);
  switch (status) {
    case 409:
      return { tone: 'error', text: SIEGE_HINT, siege: true };
    case 503:
      return { tone: 'error', text: message ?? 'No game server is connected.' };
    case 504:
      return { tone: 'error', text: message ?? 'The game server did not answer: timed out after 5 s.' };
    case 404:
      return { tone: 'error', text: message ?? 'Gate commands are off, or the gate no longer exists.' };
    case 403:
      return { tone: 'error', text: `Requires ${GATE_ADMIN_NODE}` };
    default:
      return { tone: 'error', text: message ?? 'The command could not be sent.' };
  }
}

type DoorsState = { status: 'loading' } | { status: 'loaded'; doors: GateDoorDto[] } | { status: 'error' };

const TONE_CLASSES: Record<GateCommandOutcome['tone'], string> = {
  success: 'border-success-line bg-success-soft text-success-strong',
  warning: 'border-warning-line bg-warning-soft text-warning-strong',
  error: 'border-danger-line bg-danger-soft text-danger-strong',
};

/**
 * Gate commands in the map panel (PandiO/knk-workspace#742; OVERVIEW_MAP_DESIGN § 4 item 6, § 5 rules 11 and 13, O14,
 * O17; A18). Open, Close, Toggle and Repair for the whole gate and per door, for a viewer with knk.gate.admin while
 * `Map:GateCommands:Enabled` is on (both checked by the registration before this mounts). Door ids come from
 * `GET api/GateStructures/{id}/doors` (the public panel has none). During a siege match on the gate every button is
 * disabled with "Gate is in a running siege". After each command it shows the result and reads the panel and the
 * doors again; the door may still be opening.
 */
export const GateCommandsWidget: React.FC<MapWidgetProps<MapStructurePanelDto>> = ({ data, context }) => {
  const gateId = context.id;
  const access = useActionGate(GATE_ADMIN_NODE);
  const [doors, setDoors] = useState<DoorsState>({ status: 'loading' });
  const [doorsKey, setDoorsKey] = useState(0);
  const [running, setRunning] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<GateCommandOutcome | null>(null);
  const [siegeRefused, setSiegeRefused] = useState(false);
  const mounted = useRef(true);
  const { reload } = context;

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    gateDoorClient.getByStructureId(gateId).then(
      list => { if (!cancelled) setDoors({ status: 'loaded', doors: Array.isArray(list) ? list : [] }); },
      () => { if (!cancelled) setDoors({ status: 'error' }); },
    );
    return () => { cancelled = true; };
  }, [gateId, doorsKey]);

  // A 409 keeps the buttons disabled until the panel is opened again, or until the public panel, having said
  // "under siege", says the siege is over.
  const underSiege = data.gate?.underSiege === true;
  const wasUnderSiege = useRef(underSiege);
  useEffect(() => {
    if (wasUnderSiege.current && !underSiege) setSiegeRefused(false);
    wasUnderSiege.current = underSiege;
  }, [underSiege]);

  const send = useCallback(async (action: GateCommandAction, doorId?: number) => {
    const key = `${doorId ?? 'gate'}:${action}`;
    setRunning(key);
    setOutcome(null);
    let result: GateCommandOutcome;
    try {
      const response = await gateCommandClient.send(gateId, doorId === undefined ? { action } : { action, doorId });
      result = describeGateCommandResult(response);
    } catch (err) {
      result = describeGateCommandError(err);
    }
    if (!mounted.current) return;
    setRunning(null);
    setOutcome(result);
    if (result.siege) setSiegeRefused(true);
    // Fresh state after the result (O03): the public panel and the staff door list.
    reload();
    setDoorsKey(key => key + 1);
  }, [gateId, reload]);

  if (!data.gate) return null;
  const locked = underSiege || siegeRefused;
  const disabled = locked || running !== null || !access.allowed;
  const hint = locked ? SIEGE_HINT : access.hint ?? undefined;

  const buttons = (target: string, doorId?: number) => (
    <div className="flex flex-wrap gap-2">
      {GATE_COMMAND_ACTIONS.map(({ action, label }) => {
        const key = `${doorId ?? 'gate'}:${action}`;
        return (
          <button
            key={action}
            type="button"
            aria-label={`${label} ${target}`}
            title={hint}
            disabled={disabled}
            aria-busy={running === key}
            onClick={() => send(action, doorId)}
            className="rounded-md border border-line bg-surface-alt px-3 py-1.5 text-sm font-medium text-fg hover:bg-surface-hover
              focus:outline-none focus:ring-2 focus:ring-focus disabled:cursor-not-allowed disabled:opacity-50"
          >
            {running === key ? `${label}…` : label}
          </button>
        );
      })}
    </div>
  );

  return (
    <section aria-label="Gate commands" className="space-y-3">
      <h3 className="text-sm font-semibold text-fg">Gate commands</h3>
      {locked && (
        <p className="rounded-md border border-danger-line bg-danger-soft px-3 py-2 text-sm text-danger-strong">{SIEGE_HINT}</p>
      )}
      <div className="space-y-2 rounded-md border border-line px-3 py-2">
        <p className="text-sm font-medium text-fg">Whole gate</p>
        {buttons('whole gate')}
      </div>
      {doors.status === 'loading' && <p className="text-sm text-muted" role="status">Loading doors…</p>}
      {doors.status === 'error' && (
        <div className="space-y-1">
          <p className="text-sm text-muted">The doors could not be loaded.</p>
          <button type="button" onClick={() => setDoorsKey(key => key + 1)} className="text-sm text-primary underline">
            Try again
          </button>
        </div>
      )}
      {doors.status === 'loaded' && doors.doors.length === 0 && (
        <p className="text-sm text-muted">This gate has no doors.</p>
      )}
      {doors.status === 'loaded' && doors.doors.length > 0 && (
        <ul className="space-y-2" aria-label="Door commands">
          {doors.doors.filter(door => typeof door.id === 'number').map((door, index) => {
            const name = door.name || `Door ${index + 1}`;
            return (
              <li key={door.id} aria-label={name} className="space-y-2 rounded-md border border-line px-3 py-2">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate font-medium text-fg">{name}</span>
                  <span className="flex shrink-0 items-center gap-1">
                    {door.isDestroyed && (
                      <span className="rounded-full bg-danger-soft px-2 py-0.5 text-xs font-medium text-danger">Destroyed</span>
                    )}
                    <span className="rounded-full bg-surface-alt px-2 py-0.5 text-xs text-fg">
                      {doorStateLabel(door.openedState ?? '')}
                    </span>
                  </span>
                </div>
                {buttons(name, door.id)}
              </li>
            );
          })}
        </ul>
      )}
      <div aria-live="polite">
        {outcome && (
          <p role="status" className={`rounded-md border px-3 py-2 text-sm ${TONE_CLASSES[outcome.tone]}`}>{outcome.text}</p>
        )}
      </div>
    </section>
  );
};
