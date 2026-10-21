import { logging, Controllers, HttpMethod } from '../utils';
import {
  CheckInvitationRequestDto,
  CheckInvitationResponseDto,
  CreatePersonalInvitationsRequestDto,
  CreatePersonalInvitationsResponseDto,
  CreateSharedInvitationRequestDto,
  InvitationDto,
  InvitationOptionsDto,
  InvitationPageDto,
  InvitationQuery,
  InvitationRedemptionDto,
  PersonalInvitationResultDto,
  SharedInvitationResultDto,
} from '../types/dtos/invitations/InvitationDtos';
import { ObjectManager } from './objectManager';

// Invitations (KNG-212). Every call but check needs knk.admin.invites; the API answers 403 otherwise.
export class InvitationClient extends ObjectManager {
  private static instance: InvitationClient;

  public static getInstance() {
    if (!InvitationClient.instance) {
      InvitationClient.instance = new InvitationClient();
      InvitationClient.instance.logger = logging.getLogger('InvitationClient');
    }
    return InvitationClient.instance;
  }

  list(query: InvitationQuery = {}): Promise<InvitationPageDto> {
    // Only the filters that are set - serviceCall would send an undefined one as "undefined".
    const params: Record<string, string | number> = {};
    if (query.pageNumber !== undefined) params.pageNumber = query.pageNumber;
    if (query.pageSize !== undefined) params.pageSize = query.pageSize;
    if (query.status) params.status = query.status;
    if (query.kind) params.kind = query.kind;
    return this.invokeServiceCall(params, '', Controllers.Invitations, HttpMethod.Get);
  }

  options(): Promise<InvitationOptionsDto> {
    return this.invokeServiceCall(null, 'options', Controllers.Invitations, HttpMethod.Get);
  }

  createPersonal(data: CreatePersonalInvitationsRequestDto): Promise<CreatePersonalInvitationsResponseDto> {
    return this.invokeServiceCall(data, 'personal', Controllers.Invitations, HttpMethod.Post);
  }

  createShared(data: CreateSharedInvitationRequestDto): Promise<SharedInvitationResultDto> {
    return this.invokeServiceCall(data, 'shared', Controllers.Invitations, HttpMethod.Post);
  }

  /** Personal only: a new link (the old one dies) and a fresh expiry. 429 over the daily limit. */
  resend(id: number, sendEmail = true): Promise<PersonalInvitationResultDto> {
    return this.invokeServiceCall({ sendEmail }, `${id}/resend`, Controllers.Invitations, HttpMethod.Post);
  }

  /** Shared only: a new code with the same counters. */
  rotate(id: number): Promise<SharedInvitationResultDto> {
    return this.invokeServiceCall(null, `${id}/rotate`, Controllers.Invitations, HttpMethod.Post);
  }

  pause(id: number): Promise<InvitationDto> {
    return this.invokeServiceCall(null, `${id}/pause`, Controllers.Invitations, HttpMethod.Post);
  }

  resume(id: number): Promise<InvitationDto> {
    return this.invokeServiceCall(null, `${id}/resume`, Controllers.Invitations, HttpMethod.Post);
  }

  revoke(id: number): Promise<InvitationDto> {
    return this.invokeServiceCall(null, `${id}/revoke`, Controllers.Invitations, HttpMethod.Post);
  }

  redemptions(id: number): Promise<InvitationRedemptionDto[]> {
    return this.invokeServiceCall(null, `${id}/redemptions`, Controllers.Invitations, HttpMethod.Get);
  }

  /** Anonymous: is this token or code usable now? Every failure is { valid: false, error: 'InvalidInvite' }. */
  check(data: CheckInvitationRequestDto): Promise<CheckInvitationResponseDto> {
    return this.invokeServiceCall(data, 'check', Controllers.Invitations, HttpMethod.Post);
  }
}

export const invitationClient = InvitationClient.getInstance();
