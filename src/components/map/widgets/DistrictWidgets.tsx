import React from 'react';
import type { MapDistrictPanelDto } from '../../../types/dtos/map/MapDtos';
import type { MapWidgetProps } from '../mapActionRegistry';
import { MapDescription, MapFields } from './MapFields';

/** Public district fields (O32): description and town. */
export const DistrictInfoWidget: React.FC<MapWidgetProps<MapDistrictPanelDto>> = ({ data }) => (
  <div className="space-y-3">
    <MapFields rows={[{ label: 'Town', value: data.townName }]} />
    <MapDescription text={data.description} />
  </div>
);
