import React, { Suspense } from 'react';
import type { MapDistrictPanelDto, MapStructurePanelDto, MapTownPanelDto } from '../../types/dtos/map/MapDtos';
import type { MapActionRegistry, MapWidgetProps } from './mapActionRegistry';

/**
 * The read node of the world model types (knk-web-api `StaffPermissions.ManageWorld`, the dashboard area of Town,
 * District, Structure and GateStructure; also matched by knk.admin.* and *).
 */
export const WORLD_READ_NODE = 'knk.admin.world';

export const STAFF_DETAILS_WIDGET_ID = 'staff-details';

/** A gate is a GateStructure (same id), whose display configuration shows its doors and siege settings. */
export const structureEntityType = (data: Pick<MapStructurePanelDto, 'gate'>): string =>
  data.gate !== null ? 'GateStructure' : 'Structure';

// The display renderer is only needed by staff: a separate chunk, loaded the first time the widget mounts.
const StaffDetails = React.lazy(() => import('./widgets/StaffDetailsWidget'));

function staffDetailsWidget<T>(entityType: (data: T) => string): React.FC<MapWidgetProps<T>> {
  const Widget: React.FC<MapWidgetProps<T>> = ({ data, context }) => (
    <Suspense fallback={<p className="text-sm text-muted" role="status">Loading details…</p>}>
      <StaffDetails entityType={entityType(data)} id={context.id} />
    </Suspense>
  );
  Widget.displayName = 'StaffDetailsWidget';
  return Widget;
}

/**
 * Staff "Details" for towns, districts and structures (PandiO/knk-workspace#740, § 5 rule 10, O16): the compact
 * display-configuration renderer under the public part, as a staff widget under the type's read node. The panel
 * mounts a staff widget only for a viewer holding its node, so nobody else triggers a display-configuration request.
 */
export function registerStaffDetails(registry: MapActionRegistry): MapActionRegistry {
  return registry
    .addWidget<MapTownPanelDto>('town', 'staff', {
      id: STAFF_DETAILS_WIDGET_ID, node: WORLD_READ_NODE, Component: staffDetailsWidget<MapTownPanelDto>(() => 'Town'),
    })
    .addWidget<MapDistrictPanelDto>('district', 'staff', {
      id: STAFF_DETAILS_WIDGET_ID, node: WORLD_READ_NODE,
      Component: staffDetailsWidget<MapDistrictPanelDto>(() => 'District'),
    })
    .addWidget<MapStructurePanelDto>('structure', 'staff', {
      id: STAFF_DETAILS_WIDGET_ID, node: WORLD_READ_NODE,
      Component: staffDetailsWidget<MapStructurePanelDto>(structureEntityType),
    });
}
