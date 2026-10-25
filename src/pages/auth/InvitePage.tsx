import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { MailCheck } from 'lucide-react';
import { invitationClient } from '../../apiClients/invitationClient';
import { InviteSignupForm } from '../../components/auth/InviteSignupForm';
import { useAuth } from '../../contexts/AuthContext';
import { usePageTitle } from '../../hooks/usePageTitle';
import { useNoReferrer } from '../../hooks/useNoReferrer';
import { CheckInvitationResponseDto } from '../../types/dtos/invitations/InvitationDtos';
import { clearPendingInvite, loadPendingInvite, savePendingInvite } from '../../utils/pendingInvite';
import { AFTER_SIGNUP_PATH } from '../../utils/onboardingPaths';
import { useOnboardingInfo } from '../../hooks/useOnboardingInfo';
import { OnboardingJourney } from '../../components/auth/OnboardingJourney';

export { AFTER_SIGNUP_PATH };

type CheckState = { status: 'checking' } | { status: 'invalid' } | { status: 'valid'; invite: CheckInvitationResponseDto };

/**
 * /invite/:token (KNG-212, DESIGN.md § 5.3): the personal invitation link from the mail. The token is
 * removed from the address bar before anything else happens, then checked; the form shows the invited
 * address locked. A valid token is kept for the tab (sessionStorage), so /invite without a token
 * resumes it after a detour through the login page, and the login page's "Create an account" can
 * point back here (2026-10-25: a tester clicked Log in here and lost the invitation).
 */
export const InvitePage: React.FC = () => {
  usePageTitle('Accept your invitation');
  useNoReferrer();
  const params = useParams<{ token?: string }>();
  const navigate = useNavigate();
  const { isLoggedIn, isLoading } = useAuth();
  const { accessGate } = useOnboardingInfo();
  // Read once: the URL no longer holds it after the replaceState below. Without one, the token kept
  // from an earlier visit in this tab.
  const [token] = useState(() => params.token || loadPendingInvite()?.token || '');
  const [state, setState] = useState<CheckState>(token ? { status: 'checking' } : { status: 'invalid' });
  const signedUp = useRef(false);

  useEffect(() => {
    if (token && window.location.pathname !== '/invite') {
      window.history.replaceState(window.history.state, '', '/invite');
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    invitationClient.check({ token })
      .then(result => {
        if (cancelled) return;
        if (result?.valid && result.kind === 'Personal') {
          savePendingInvite({ token, email: result.email, expiresAt: result.expiresAt });
          setState({ status: 'valid', invite: result });
        } else {
          clearPendingInvite();
          setState({ status: 'invalid' });
        }
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'invalid' });
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Someone already logged in has an account (the redirect after sign-up is handled below).
  useEffect(() => {
    if (!isLoading && isLoggedIn && !signedUp.current) {
      navigate('/account', { replace: true });
    }
  }, [isLoading, isLoggedIn, navigate]);

  return (
    <main className="min-h-screen flex items-center justify-center py-8 sm:py-12 px-4 bg-gray-50">
      <div className="w-full max-w-xl bg-white rounded-xl shadow-lg p-6 sm:p-8 border border-gray-100">
        <div className="mb-6 text-center">
          <MailCheck className="h-10 w-10 mx-auto text-primary" aria-hidden="true" />
          <h1 className="mt-3 text-2xl sm:text-3xl font-bold text-gray-900">You're invited to the Knights &amp; Kings closed alpha</h1>
        </div>

        {state.status === 'checking' && (
          <p className="text-center text-gray-600" role="status">Checking your invitation…</p>
        )}

        {state.status === 'invalid' && <InvalidInvite />}

        {state.status === 'valid' && (
          <>
            <p className="mb-4 text-center text-sm text-gray-600">
              New here? Sign up with this invitation: choose a password and your account is created. The invitation is
              valid until {state.invite.expiresAt ? new Date(state.invite.expiresAt).toLocaleString() : 'it expires'}.
            </p>
            <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">What happens next</p>
              <OnboardingJourney accessGate={accessGate} />
            </div>
            <InviteSignupForm
              inviteToken={token}
              lockedEmail={state.invite.email}
              loginReturnTo="/invite"
              onRegistered={() => {
                signedUp.current = true;
                clearPendingInvite();
              }}
              onSuccess={() => {
                signedUp.current = true;
                navigate(AFTER_SIGNUP_PATH, { replace: true });
              }}
              onInvalidInvite={() => {
                clearPendingInvite();
                setState({ status: 'invalid' });
              }}
            />
          </>
        )}
      </div>
    </main>
  );
};

/** One message for every failure: wrong, used, expired or revoked look the same (DESIGN.md § 3.2). */
export const InvalidInvite: React.FC = () => (
  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" role="alert" data-testid="invalid-invite">
    <p className="font-medium">This invitation is invalid or has expired.</p>
    <p className="mt-1">Ask whoever invited you for a new one. If you already created your account, <Link to="/auth/login" className="underline">log in</Link>.</p>
    <p className="mt-1">Got a code instead of a link? <Link to="/join" className="underline">Enter it here</Link>.</p>
  </div>
);

export default InvitePage;
