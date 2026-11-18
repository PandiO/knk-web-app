import type { MapStructurePanelDto } from '../../types/dtos/map/MapDtos';
import type { MapActionRegistry } from './mapActionRegistry';
import { GATE_ADMIN_NODE, GateCommandsWidget } from './widgets/GateCommandsWidget';

export const GATE_COMMANDS_WIDGET_ID = 'gate-commands';

/**
 * Gate command buttons for gate structures (PandiO/knk-workspace#742; § 4 item 6, § 5 rules 11 and 13, O14, O17):
 * a staff widget under knk.gate.admin, shown for a gate while the API's `Map:GateCommands:Enabled` is on
 * (`config.gateCommands.enabled`). The panel mounts it only for a viewer holding the node, so anonymous viewers make
 * no permission calls and nobody without the node asks for door ids or sends commands. The public `gate-doors` widget
 * stays as it is for everyone.
 */
export function registerGateCommands(registry: MapActionRegistry): MapActionRegistry {
  return registry.addWidget<MapStructurePanelDto>('structure', 'staff', {
    id: GATE_COMMANDS_WIDGET_ID,
    node: GATE_ADMIN_NODE,
    visible: (data, context) => data.gate !== null && context.gateCommands.enabled,
    Component: GateCommandsWidget,
  });
}
