// The mail log on /admin/email (KNG-206; knk-web-api EmailOutboxController). Recipients come
// masked and bodies are never sent to the browser.

/** The page and every call need this node (the API enforces it as well). */
export const EMAIL_ADMIN_NODE = 'knk.admin.config';

export type EmailOutboxStatus = 'Pending' | 'Sent' | 'Failed' | 'Expired' | 'Suppressed';

export const EMAIL_OUTBOX_STATUSES: EmailOutboxStatus[] = ['Pending', 'Sent', 'Failed', 'Expired', 'Suppressed'];

export const EMAIL_KINDS = [
  'PasswordReset',
  'EmailChanged',
  'PrivacyDeletionConfirm',
  'PrivacyDeletionScheduled',
  'Invitation',
  'Welcome',
  'MinecraftLinked',
  'FinishLinking',
  'EmailVerification',
  'Test',
] as const;

export interface EmailOutboxItemDto {
  id: number;
  kind: string;
  toMasked: string;
  subject: string;
  status: EmailOutboxStatus;
  attempts: number;
  nextAttemptAt: string;
  expiresAt?: string | null;
  lastError?: string | null;
  createdAt: string;
  sentAt?: string | null;
  userId?: number | null;
  /** A Failed mail that still has its content (it carried no link or code). */
  canRetry: boolean;
}

export interface EmailOutboxPageDto {
  items: EmailOutboxItemDto[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  /** Smtp, Log or Pickup. */
  transport: string;
  last24Hours: number;
  dailyCap: number;
}

export interface EmailOutboxQuery {
  pageNumber?: number;
  pageSize?: number;
  status?: EmailOutboxStatus | '';
  kind?: string;
}
