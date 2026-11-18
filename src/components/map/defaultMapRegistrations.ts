import { mapClient } from '../../apiClients/mapClient';
import type { MapDistrictPanelDto, MapStructurePanelDto, MapTownPanelDto } from '../../types/dtos/map/MapDtos';
import type { MapActionRegistry } from './mapActionRegistry';
import { DistrictInfoWidget } from './widgets/DistrictWidgets';
import { GateDoorsWidget } from './widgets/GateDoorsWidget';
import { StructureInfoWidget, structureTypeLabel } from './widgets/StructureWidgets';
import { RegionToggleWidget, TownInfoWidget } from './widgets/TownWidgets';

/**
 * The built-in map entities (PandiO/knk-workspace#737): the public panels of towns, districts and structures (O16,
 * O32), the town's "Show region" toggle (O05) and a gate's doors (O06). No staff widgets or actions yet: staff details
 * (#740), gate commands (#742) and the player panel (#743) register theirs.
 */
export function registerDefaultMapEntities(registry: MapActionRegistry): MapActionRegistry {
  registry.register<MapTownPanelDto>({
    kind: 'town',
    load: id => mapClient.getTown(id),
    title: data => data.name,
    subtitle: () => 'Town',
    publicWidgets: [
      { id: 'town-info', Component: TownInfoWidget },
      { id: 'region-toggle', Component: RegionToggleWidget },
    ],
    staffWidgets: [],
    actions: [],
  });
  registry.register<MapDistrictPanelDto>({
    kind: 'district',
    load: id => mapClient.getDistrict(id),
    title: data => data.name,
    subtitle: () => 'District',
    publicWidgets: [{ id: 'district-info', Component: DistrictInfoWidget }],
    staffWidgets: [],
    actions: [],
  });
  registry.register<MapStructurePanelDto>({
    kind: 'structure',
    load: id => mapClient.getStructure(id),
    title: data => data.name,
    subtitle: data => structureTypeLabel(data),
    publicWidgets: [
      { id: 'structure-info', Component: StructureInfoWidget },
      { id: 'gate-doors', visible: data => data.gate !== null, Component: GateDoorsWidget },
    ],
    staffWidgets: [],
    actions: [],
  });
  return registry;
}
