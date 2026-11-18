import React from 'react';
import type { MapGateDoorPanelDto, MapStructurePanelDto } from '../../../types/dtos/map/MapDtos';
import type { MapWidgetProps } from '../mapActionRegistry';

const STATE_LABELS: Record<string, string> = {
  open: 'Open',
  closed: 'Closed',
  opening: 'Opening',
  closing: 'Closing',
  jammed: 'Jammed',
};

export const doorStateLabel = (openState: string): string =>
  STATE_LABELS[openState?.toLowerCase()] ?? (openState ? openState : 'Unknown');

export const healthPercent = (door: Pick<MapGateDoorPanelDto, 'healthCurrent' | 'healthMax'>): number => {
  if (!door.healthMax || door.healthMax <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((door.healthCurrent / door.healthMax) * 100)));
};

const formatHealth = (value: number): string => (Number.isInteger(value) ? String(value) : value.toFixed(1));

/**
 * A gate's doors (O06, O32, A09): per door its name, open/closed, destroyed and a health bar; "Under siege" while a
 * match runs on the gate. Door health is shown always, also during a siege (O32).
 */
export const GateDoorsWidget: React.FC<MapWidgetProps<MapStructurePanelDto>> = ({ data }) => {
  const gate = data.gate;
  if (!gate) return null;
  return (
    <section aria-label="Gate doors" className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-fg">Doors</h3>
        {gate.underSiege && (
          <span className="rounded-full bg-danger-soft px-2 py-0.5 text-xs font-medium text-danger">Under siege</span>
        )}
      </div>
      {gate.doors.length === 0 ? (
        <p className="text-sm text-muted">This gate has no doors.</p>
      ) : (
        <ul className="space-y-2">
          {gate.doors.map((door, index) => {
            const percent = healthPercent(door);
            return (
              <li key={`${door.name}-${index}`} className="rounded-md border border-line px-3 py-2" aria-label={door.name || `Door ${index + 1}`}>
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-medium text-fg">{door.name || `Door ${index + 1}`}</span>
                  <span className="flex items-center gap-1">
                    {door.isDestroyed && (
                      <span className="rounded-full bg-danger-soft px-2 py-0.5 text-xs font-medium text-danger">Destroyed</span>
                    )}
                    <span className="rounded-full bg-surface-alt px-2 py-0.5 text-xs text-fg">{doorStateLabel(door.openState)}</span>
                  </span>
                </div>
                <div
                  role="progressbar"
                  aria-label={`${door.name || `Door ${index + 1}`} health`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={percent}
                  aria-valuetext={`${formatHealth(door.healthCurrent)} of ${formatHealth(door.healthMax)}`}
                  className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-alt"
                >
                  <div
                    className={`h-full ${percent > 50 ? 'bg-success' : percent > 20 ? 'bg-warning' : 'bg-danger'}`}
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <div className="mt-1 text-xs text-muted">
                  Health {formatHealth(door.healthCurrent)} / {formatHealth(door.healthMax)}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};
