import { logging, Controllers, HttpMethod } from '../utils';
import type { GateCommandRequestDto, GateCommandResponseDto } from '../types/dtos/map/MapDtos';
import { ObjectManager } from './objectManager';

// knk-web-api GateCommandsController (PandiO/knk-workspace#741, O17, § 6.2.10): live gate commands sent to the game
// server. Needs knk.gate.admin; answers 404 while Map:GateCommands:Enabled is off. Used by the map panel (#742).
const COMMAND_TIMEOUT_MS = 35 * 1000;

export class GateCommandClient extends ObjectManager {
  private static instance: GateCommandClient;

  public static getInstance() {
    if (!GateCommandClient.instance) {
      GateCommandClient.instance = new GateCommandClient();
      GateCommandClient.instance.logger = logging.getLogger('GateCommandClient');
    }
    return GateCommandClient.instance;
  }

  /** Leave `doorId` out for the whole gate. Rejects with `status`, `code` and the API's `message` on 4xx/5xx. */
  send(gateStructureId: number, command: GateCommandRequestDto): Promise<GateCommandResponseDto> {
    // The API waits for the game server up to Map:GateCommands:TimeoutSeconds (5, at most 30) and answers 504 itself.
    return this.invokeServiceCall(command, `${gateStructureId}/commands`, Controllers.GateStructures, HttpMethod.Post,
      undefined, COMMAND_TIMEOUT_MS);
  }
}

export const gateCommandClient = GateCommandClient.getInstance();
