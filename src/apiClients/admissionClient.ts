import { logging, Controllers, HttpMethod } from '../utils';
import { ClaimCheckResponseDto } from '../types/dtos/auth/AuthDtos';
import { ObjectManager } from './objectManager';

// The admission gate's claim codes (KNG-214). claim/check is anonymous (per-IP lookup limit); the
// gate itself (GET Admission/{uuid}) is the game server's.
export class AdmissionClient extends ObjectManager {
  private static instance: AdmissionClient;

  public static getInstance() {
    if (!AdmissionClient.instance) {
      AdmissionClient.instance = new AdmissionClient();
      AdmissionClient.instance.logger = logging.getLogger('AdmissionClient');
    }
    return AdmissionClient.instance;
  }

  /** Always 200: `{ valid: false }` for a wrong, used or expired code. */
  checkClaim(code: string): Promise<ClaimCheckResponseDto> {
    return this.invokeServiceCall({ code }, 'claim/check', Controllers.Admission, HttpMethod.Post);
  }
}

export const admissionClient = AdmissionClient.getInstance();
