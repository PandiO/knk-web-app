import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { usePermissions } from '../../hooks/useStaffAccess';
import type { MapEntityKind } from './bridgeProtocol';
import type { MapActionRegistry, MapPanelAction, MapPanelContext, MapPanelWidget } from './mapActionRegistry';
import { useMapAvailability } from './useMapAvailability';

export interface MapSelection {
  kind: MapEntityKind;
  id: number;
}

interface Props {
  registry: MapActionRegistry;
  selection: MapSelection;
  regionShown: boolean;
  canShowRegion: boolean;
  onRegionShownChange: (shown: boolean) => void;
  onClose: () => void;
}

type LoadState<T> = { status: 'loading' } | { status: 'loaded'; data: T } | { status: 'missing' } | { status: 'error' };

/** Shown when the node is null, or the viewer holds it (map panels hide what a viewer can't use: agent decision). */
const allowedBy = (node: string | null | undefined, statuses: Record<string, string>): boolean =>
  !node || statuses[node] === 'allowed';

/**
 * The side panel (a bottom sheet on a phone) for a clicked pin (O03, O16; § 4 items 2–3). It reads the entity fresh
 * on every click and renders what the map action registry holds for its kind: public widgets for everyone, staff
 * widgets and actions only under their nodes.
 */
export const MapPanel: React.FC<Props> = ({ registry, selection, regionShown, canShowRegion, onRegionShownChange, onClose }) => {
  const registration = registry.get<unknown>(selection.kind);
  const [state, setState] = useState<LoadState<unknown>>({ status: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);
  const shownKey = useRef<string | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const nodes = useMemo(() => registry.nodesFor(selection.kind), [registry, selection.kind]);
  const statuses = usePermissions(nodes);
  // The page's shared config answer (one api/Map/config per page load): no extra request.
  const availability = useMapAvailability();
  const gateCommandsEnabled = availability.status === 'on' && availability.config.gateCommands?.enabled === true;

  useEffect(() => {
    if (!registration) {
      setState({ status: 'error' });
      return;
    }
    let cancelled = false;
    // A reload after an action keeps the current data on screen (and its widgets mounted, with what they show, such
    // as a command's result) until the fresh data arrives; a new selection starts from "Loading…".
    const selectionKey = `${selection.kind}:${selection.id}`;
    if (shownKey.current !== selectionKey) setState({ status: 'loading' });
    shownKey.current = selectionKey;
    registration.load(selection.id).then(
      data => { if (!cancelled) setState({ status: 'loaded', data }); },
      err => {
        if (cancelled) return;
        setState({ status: (err as { status?: number } | null)?.status === 404 ? 'missing' : 'error' });
      },
    );
    return () => { cancelled = true; };
  }, [registration, selection.kind, selection.id, reloadKey]);

  const reload = useCallback(() => setReloadKey(key => key + 1), []);

  const context: MapPanelContext = {
    kind: selection.kind,
    id: selection.id,
    regionShown,
    canShowRegion,
    setRegionShown: onRegionShownChange,
    reload,
    gateCommands: { enabled: gateCommandsEnabled },
  };

  const renderWidgets = (widgets: MapPanelWidget<unknown>[], data: unknown) => widgets
    .filter(widget => allowedBy(widget.node, statuses) && (!widget.visible || widget.visible(data, context)))
    .map(widget => <widget.Component key={widget.id} data={data} context={context} />);

  const runAction = async (action: MapPanelAction<unknown>, data: unknown) => {
    setRunning(action.id);
    try {
      await action.run(data, context);
    } finally {
      setRunning(null);
    }
  };

  const loaded = state.status === 'loaded' ? state.data : undefined;
  const title = registration && state.status === 'loaded' ? registration.title(state.data) : '';
  const subtitle = registration?.subtitle && state.status === 'loaded' ? registration.subtitle(state.data) : null;
  const staffWidgets = registration && loaded !== undefined ? renderWidgets(registration.staffWidgets, loaded) : [];
  const actions = registration && loaded !== undefined
    ? registration.actions.filter(action => allowedBy(action.node, statuses) && (!action.visible || action.visible(loaded, context)))
    : [];

  return (
    <aside
      aria-label="Place details"
      className="absolute inset-x-0 bottom-0 z-10 max-h-[60%] overflow-y-auto rounded-t-xl border border-line bg-surface p-4 shadow-xl
        md:inset-x-auto md:bottom-auto md:right-4 md:top-4 md:max-h-[calc(100%-2rem)] md:w-96 md:rounded-xl"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          {state.status === 'loaded' ? (
            <>
              <h2 className="truncate text-lg font-semibold text-fg">{title}</h2>
              {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
            </>
          ) : (
            <h2 className="text-lg font-semibold text-fg">
              {state.status === 'loading' ? 'Loading…' : 'Not available'}
            </h2>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close details"
          className="rounded-md p-1 text-muted hover:bg-surface-hover hover:text-fg focus:outline-none focus:ring-2 focus:ring-focus"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
      {state.status === 'missing' && <p className="text-sm text-muted">This place is no longer on the map.</p>}
      {state.status === 'error' && (
        <div className="space-y-2">
          <p className="text-sm text-muted">The details could not be loaded.</p>
          <button type="button" onClick={reload} className="text-sm text-primary underline">Try again</button>
        </div>
      )}
      {registration && loaded !== undefined && (
        <div className="space-y-4">
          {renderWidgets(registration.publicWidgets, loaded)}
          {staffWidgets.length > 0 && (
            <section aria-label="Staff details" className="space-y-3 border-t border-line pt-3">{staffWidgets}</section>
          )}
          {actions.length > 0 && (
            <div role="group" aria-label="Actions" className="flex flex-wrap gap-2 border-t border-line pt-3">
              {actions.map(action => (
                <button
                  key={action.id}
                  type="button"
                  disabled={running !== null}
                  onClick={() => runAction(action, loaded)}
                  className="rounded-md border border-line bg-surface-alt px-3 py-1.5 text-sm font-medium text-fg hover:bg-surface-hover disabled:opacity-50"
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </aside>
  );
};
