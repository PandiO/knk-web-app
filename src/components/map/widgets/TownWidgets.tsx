import React from 'react';
import type { MapTownPanelDto } from '../../../types/dtos/map/MapDtos';
import type { MapWidgetProps } from '../mapActionRegistry';
import { MapDescription, MapFields } from './MapFields';

/** Public town fields (O32): description and number of districts. */
export const TownInfoWidget: React.FC<MapWidgetProps<MapTownPanelDto>> = ({ data }) => (
  <div className="space-y-3">
    <MapDescription text={data.description} />
    <MapFields rows={[{ label: 'Districts', value: String(data.districtCount) }]} />
  </div>
);

/**
 * The "Show region" toggle (O05, O30): on, the town outline and all its districts stay visible with their names until
 * it is switched off or another town is toggled.
 */
export function RegionToggleWidget<T>({ context }: MapWidgetProps<T>): React.ReactElement | null {
  if (!context.canShowRegion) return null;
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-md border border-line px-3 py-2 text-sm text-fg">
      <span>Show region</span>
      <input
        type="checkbox"
        role="switch"
        aria-checked={context.regionShown}
        checked={context.regionShown}
        onChange={event => context.setRegionShown(event.target.checked)}
        className="h-4 w-4"
      />
    </label>
  );
}
