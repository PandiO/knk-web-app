import { RegistrationMode } from '../types/dtos/auth/AuthDtos';
import { isInviteSignup } from '../hooks/useRegistrationMode';
import { loadPendingClaim } from './claimCode';
import { loadPendingInvite } from './pendingInvite';

/**
 * Where "Create an account" goes. Under LinkCode (or while the mode is unknown) the link-code
 * register page; with invitations on, the page that continues what the player already has: the
 * kept personal invitation (/invite), the verified claim code from /link (which asks for an
 * invitation next), or /join to enter a shared code.
 */
export function signupPath(mode: RegistrationMode | null): string {
  if (!isInviteSignup(mode)) return '/auth/register';
  if (loadPendingInvite()) return '/invite';
  if (loadPendingClaim()) return '/link';
  return '/join';
}
