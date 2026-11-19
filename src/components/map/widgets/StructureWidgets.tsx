import React from 'react';
import type { MapStructurePanelDto } from '../../../types/dtos/map/MapDtos';
import type { MapWidgetProps } from '../mapActionRegistry';
import { MapDescription, MapFields } from './MapFields';

export const structureTypeLabel = (data: Pick<MapStructurePanelDto, 'type' | 'subtype'>): string =>
  [data.type, data.subtype].filter(Boolean).join(', ');

export const structureAddress = (data: Pick<MapStructurePanelDto, 'streetName' | 'houseNumber'>): string | null => {
  const street = data.streetName?.trim();
  if (!street) return null;
  return data.houseNumber > 0 ? `${street} ${data.houseNumber}` : street;
};

/** Public structure fields (O32): type and subtype, district and town, street and house number, description. */
export const StructureInfoWidget: React.FC<MapWidgetProps<MapStructurePanelDto>> = ({ data }) => (
  <div className="space-y-3">
    <MapFields
      rows={[
        { label: 'Type', value: structureTypeLabel(data) },
        { label: 'District', value: data.districtName },
        { label: 'Town', value: data.townName },
        { label: 'Address', value: structureAddress(data) },
      ]}
    />
    <MapDescription text={data.description} />
  </div>
);
