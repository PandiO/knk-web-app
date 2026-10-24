// Invitations (KNG-212; knk-web-api InvitationsController, knk-workspace docs/specs/invitations/DESIGN.md § 3).
// Links and codes are only in the create, resend and rotate responses, and shown once.

/** The admin page and every staff call need this node (the API enforces it as well). */
export const INVITATION_NODES = { manage: 'knk.admin.invites' } as const;

export type InvitationKind = 'Personal' | 'Shared';

export type InvitationStatus = 'Active' | 'Paused' | 'Exhausted' | 'Expired' | 'Revoked';

export const INVITATION_STATUSES: InvitationStatus[] = ['Active', 'Paused', 'Exhausted', 'Expired', 'Revoked'];

export interface InvitationDto {
  id: number;
  kind: InvitationKind;
  status: InvitationStatus;
  codeHint: string;
  email?: string | null;
  label?: string | null;
  note?: string | null;
  groupId?: number | null;
  groupName?: string | null;
  maxUses: number;
  useCount: number;
  createdAt: string;
  createdByUserId: number;
  createdByName?: string | null;
  expiresAt: string;
  pausedAt?: string | null;
  revokedAt?: string | null;
  sendCount: number;
  lastSentAt?: string | null;
}

export interface InvitationPageDto {
  items: InvitationDto[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
}

export interface InvitationQuery {
  pageNumber?: number;
  pageSize?: number;
  status?: InvitationStatus | '';
  kind?: InvitationKind | '';
}

export interface CreatePersonalInvitationsRequestDto {
  emails: string[];
  expiryDays?: number;
  groupId?: number | null;
  note?: string;
  sendEmail: boolean;
}

export interface CreateSharedInvitationRequestDto {
  label: string;
  maxUses?: number;
  expiryDays?: number;
  groupId?: number | null;
}

export interface PersonalInvitationResultDto {
  email: string;
  /** Created, or Skipped with a reason. */
  outcome: 'Created' | 'Skipped';
  /** InvalidEmail, EmailInUse or Duplicate. */
  reason?: string | null;
  invitation?: InvitationDto | null;
  link?: string | null;
  /** Pending, Suppressed, ... or null when no mail was queued. */
  mailStatus?: string | null;
  replacedInvitationId?: number | null;
}

export interface CreatePersonalInvitationsResponseDto {
  results: PersonalInvitationResultDto[];
}

export interface SharedInvitationResultDto {
  invitation: InvitationDto;
  code: string;
  link: string;
}

export interface InvitationRedemptionDto {
  userId: number;
  username?: string | null;
  emailMasked?: string | null;
  redeemedAt: string;
  minecraftLinked: boolean;
}

export interface InvitableGroupDto {
  id: number;
  name: string;
}

export interface InvitationOptionsDto {
  groups: InvitableGroupDto[];
  defaultExpiryDays: number;
  maxExpiryDays: number;
  sharedDefaultMaxUses: number;
  sharedMaxUsesCap: number;
  /** LinkCode, Invite or Open: whether the sign-up pages accept invitations yet. */
  registrationMode: string;
}

export interface CheckInvitationRequestDto {
  token?: string;
  code?: string;
}

export interface CheckInvitationResponseDto {
  valid: boolean;
  /** InvalidInvite for every failure. */
  error?: string | null;
  kind?: InvitationKind | null;
  /** Personal invites: the address the invitation was sent to. */
  email?: string | null;
  emailHint?: string | null;
  expiresAt?: string | null;
}

/** GET Invitations/access-sync (KNG-216): the API's Cloudflare Access sync. Never holds emails. */
export interface CloudflareAccessSyncStatusDto {
  enabled: boolean;
  configured: boolean;
  lastSuccessAt?: string | null;
  lastAttemptAt?: string | null;
  /** Null while the last run went through. */
  lastError?: string | null;
  pendingAdds: number;
  pendingRemoves: number;
  listSize?: number | null;
  reconcileMinutes: number;
}

/** Human text for a skipped address. */
export const SKIP_REASONS: Record<string, string> = {
  InvalidEmail: 'Not a valid email address',
  EmailInUse: 'An account already uses this address',
  Duplicate: 'Listed twice',
};
