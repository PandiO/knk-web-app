import type { MockApi } from '../support/mockApi';
import type { GateDoorDto } from '../../src/types/dtos/gateStructure/GateDoorDto';
import type {
  GateCommandRequestDto,
  GateCommandResponseDto,
  MapConfigDto,
  MapStructurePanelDto,
} from '../../src/types/dtos/map/MapDtos';
import { mapConfig, mockMapOn, northGate } from './map';

/**
 * Gate commands in the map panel (PandiO/knk-workspace#742): the North Gate (structure 9) with two doors, the staff
 * door list (`GET api/GateStructures/9/doors`) and a fake `POST api/GateStructures/9/commands` that "animates" the
 * door: the public panel and the door list read afterwards show the new state, as the game server would report it.
 */

export const gateCommandsOn: MapConfigDto = { ...mapConfig, gateCommands: { enabled: true } };

export const GATE_ADMIN = 'knk.gate.admin';

type DoorState = 'open' | 'closed' | 'opening' | 'closing';

export interface FakeGate {
  /** The bodies the page sent, in order. */
  commands: GateCommandRequestDto[];
}

/**
 * The map on (flag as given), the North Gate's public panel and staff door list, and a command endpoint that sets a
 * door (or every door) to the state the action leads to and answers `done`. `underSiege` makes the public panel say
 * so; `answer` replaces the command endpoint's answer (status and body) for error cases.
 */
export function mockGateCommands(
  api: MockApi,
  options: { enabled?: boolean; underSiege?: boolean; answer?: { status: number; body: unknown } } = {},
): FakeGate {
  const { enabled = true, underSiege = false, answer } = options;
  mockMapOn(api, enabled ? gateCommandsOn : mapConfig);
  const states: Record<number, DoorState> = { 31: 'open', 32: 'closed' };
  const health: Record<number, number> = { 31: 750, 32: 0 };
  const names: Record<number, string> = { 31: 'Left door', 32: 'Right door' };
  const ids = [31, 32];
  const fake: FakeGate = { commands: [] };

  api.on<MapStructurePanelDto>('GET', 'Map/structures/9', () => ({
    body: {
      ...northGate,
      gate: {
        underSiege,
        doors: ids.map(id => ({
          name: names[id], openState: states[id], isDestroyed: health[id] <= 0, healthCurrent: health[id], healthMax: 1000,
        })),
      },
    },
  }));
  api.on<GateDoorDto[]>('GET', 'GateStructures/9/doors', () => ({
    body: ids.map(id => ({
      id, gateStructureId: 9, name: names[id], openedState: states[id].toUpperCase() as GateDoorDto['openedState'],
      isDestroyed: health[id] <= 0, healthCurrent: health[id], healthMax: 1000,
    })),
  }));
  api.on('POST', 'GateStructures/9/commands', ({ body }) => {
    const command = body as GateCommandRequestDto;
    fake.commands.push(command);
    if (answer) return answer;
    const targets = command.doorId === undefined ? ids : [command.doorId];
    for (const id of targets) {
      if (command.action === 'open') states[id] = 'opening';
      else if (command.action === 'close') states[id] = 'closed';
      else if (command.action === 'toggle') states[id] = states[id] === 'open' || states[id] === 'opening' ? 'closing' : 'opening';
      else health[id] = 1000;
    }
    const response: GateCommandResponseDto = {
      commandId: `cmd-${fake.commands.length}`, gateId: 9, doorId: command.doorId ?? null, action: command.action,
      result: 'done', message: `${command.action} sent to ${targets.map(id => names[id]).join(' and ')}.`,
      doors: targets.map(id => ({
        doorId: id, state: states[id], healthCurrent: health[id], healthMax: 1000, destroyed: health[id] <= 0,
        outcome: 'ok', reason: null,
      })),
    };
    return { body: response };
  });
  return fake;
}
