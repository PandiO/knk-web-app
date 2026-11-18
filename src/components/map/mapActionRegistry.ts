import type React from 'react';
import type { MapEntityKind } from './bridgeProtocol';
import { registerDefaultMapEntities } from './defaultMapRegistrations';

/**
 * The map action registry (OVERVIEW_MAP_DESIGN § 5 rule 13, O14, O16; PandiO/knk-workspace#737, A22).
 *
 * Each entity kind the map can show registers how its panel loads, its public widgets (everyone, the O32 fields),
 * its staff widgets and its actions, each with the permission node that unlocks it. The panel (MapPanel) renders
 * whatever is registered; the bridge script never hears about any of it, so a new action or widget never touches
 * BlueMap's side. Later links add to the registry: staff details (#740), gate command buttons (#742), the player
 * moderation panel (#743), for example:
 *
 *     mapActionRegistry.addAction<MapStructurePanelDto>('structure', {
 *       id: 'gate-open', label: 'Open gate', node: 'knk.gate.admin',
 *       visible: data => data.gate !== null,
 *       run: async (data, context) => { await ...; context.reload(); },
 *     });
 */

/** What a widget or action can do in the panel besides reading its entity. */
export interface MapPanelContext {
  kind: MapEntityKind;
  id: number;
  /** Whether this entity's region (with its districts, for a town) is shown on the map (O05 toggle). */
  regionShown: boolean;
  /** Turns the region on or off; false when the entity has no region on the map. */
  canShowRegion: boolean;
  setRegionShown: (shown: boolean) => void;
  /** Reads the entity again (after an action changed it, O03: fresh on click). */
  reload: () => void;
}

export interface MapWidgetProps<T> {
  data: T;
  context: MapPanelContext;
}

export interface MapPanelWidget<T> {
  /** Unique per kind; registering the same id again replaces the widget. */
  id: string;
  /** The node a viewer needs to see it; null or absent for everyone (public widgets). */
  node?: string | null;
  /** Shown only when this returns true (for example only for a gate). */
  visible?: (data: T) => boolean;
  Component: React.ComponentType<MapWidgetProps<T>>;
}

export interface MapPanelAction<T> {
  /** Unique per kind; registering the same id again replaces the action. */
  id: string;
  label: string;
  /** The node a viewer needs to see the button; null for everyone. The API checks again on its own. */
  node: string | null;
  visible?: (data: T) => boolean;
  run: (data: T, context: MapPanelContext) => void | Promise<void>;
}

export interface MapEntityRegistration<T> {
  kind: MapEntityKind;
  /** Loads the public panel data (404 = no longer on the map). */
  load: (id: number) => Promise<T>;
  title: (data: T) => string;
  subtitle?: (data: T) => string | null;
  publicWidgets: MapPanelWidget<T>[];
  staffWidgets: MapPanelWidget<T>[];
  actions: MapPanelAction<T>[];
}

export type MapWidgetSection = 'public' | 'staff';

function upsert<T extends { id: string }>(list: T[], item: T): T[] {
  const index = list.findIndex(existing => existing.id === item.id);
  if (index < 0) return [...list, item];
  const copy = [...list];
  copy[index] = item;
  return copy;
}

export class MapActionRegistry {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly entries = new Map<MapEntityKind, MapEntityRegistration<any>>();

  register<T>(registration: MapEntityRegistration<T>): this {
    this.entries.set(registration.kind, registration);
    return this;
  }

  get<T = unknown>(kind: MapEntityKind): MapEntityRegistration<T> | undefined {
    return this.entries.get(kind) as MapEntityRegistration<T> | undefined;
  }

  kinds(): MapEntityKind[] {
    return Array.from(this.entries.keys());
  }

  addWidget<T>(kind: MapEntityKind, section: MapWidgetSection, widget: MapPanelWidget<T>): this {
    const entry = this.require<T>(kind);
    if (section === 'public') entry.publicWidgets = upsert(entry.publicWidgets, widget);
    else entry.staffWidgets = upsert(entry.staffWidgets, widget);
    return this;
  }

  addAction<T>(kind: MapEntityKind, action: MapPanelAction<T>): this {
    const entry = this.require<T>(kind);
    entry.actions = upsert(entry.actions, action);
    return this;
  }

  /** Every node a kind's widgets and actions ask for, for one permission check per node. */
  nodesFor(kind: MapEntityKind): string[] {
    const entry = this.entries.get(kind);
    if (!entry) return [];
    const nodes = [...entry.publicWidgets, ...entry.staffWidgets, ...entry.actions]
      .map(item => item.node)
      .filter((node): node is string => typeof node === 'string' && node.length > 0);
    return Array.from(new Set(nodes)).sort();
  }

  private require<T>(kind: MapEntityKind): MapEntityRegistration<T> {
    const entry = this.entries.get(kind);
    if (!entry) throw new Error(`No map entity registered for "${kind}"`);
    return entry as MapEntityRegistration<T>;
  }
}

/** A registry with the built-in kinds (town, district, structure) and their public widgets. */
export function createMapActionRegistry(): MapActionRegistry {
  return registerDefaultMapEntities(new MapActionRegistry());
}

/** The app's registry: the map page reads it; later features add their widgets and actions to it. */
export const mapActionRegistry = createMapActionRegistry();
