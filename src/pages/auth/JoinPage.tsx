import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Ticket } from 'lucide-react';
import { invitationClient } from '../../apiClients/invitationClient';
import { InviteSignupForm } from '../../components/auth/InviteSignupForm';
import { useAuth } from '../../contexts/AuthContext';
import { usePageTitle } from '../../hooks/usePageTitle';
import { useNoReferrer } from '../../hooks/useNoReferrer';
import { AFTER_SIGNUP_PATH, InvalidInvite } from './InvitePage';

type Step = 'code' | 'checking' | 'invalid' | 'signup';

/**
 * /join?code=KNK-XXXXX-XXXXX (KNG-212, DESIGN.md § 5.3): sign-up with a shared invitation code. The
 * code can come from the link or be typed; the player types their own email (unverified until KNG-159).
 */
export const JoinPage: React.FC = () => {
  usePageTitle('Join the closed alpha');
  useNoReferrer();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isLoggedIn, isLoading } = useAuth();
  const [code, setCode] = useState(() => searchParams.get('code') ?? '');
  const [step, setStep] = useState<Step>(() => (searchParams.get('code') ? 'checking' : 'code'));
  const signedUp = useRef(false);

  const check = async (value: string) => {
    if (!value.trim()) {
      setStep('code');
      return;
    }
    setStep('checking');
    try {
      const result = await invitationClient.check({ code: value.trim() });
      setStep(result?.valid && result.kind === 'Shared' ? 'signup' : 'invalid');
    } catch {
      setStep('invalid');
    }
  };

  useEffect(() => {
    const fromLink = searchParams.get('code');
    if (fromLink) check(fromLink);
    // Only the code the page was opened with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isLoading && isLoggedIn && !signedUp.current) {
      navigate('/account', { replace: true });
    }
  }, [isLoading, isLoggedIn, navigate]);

  return (
    <main className="min-h-screen flex items-center justify-center py-8 sm:py-12 px-4 bg-gray-50">
      <div className="w-full max-w-xl bg-white rounded-xl shadow-lg p-6 sm:p-8 border border-gray-100">
        <div className="mb-6 text-center">
          <Ticket className="h-10 w-10 mx-auto text-primary" aria-hidden="true" />
          <h1 className="mt-3 text-2xl sm:text-3xl font-bold text-gray-900">You're invited to the Knights &amp; Kings closed alpha</h1>
        </div>

        {(step === 'code' || step === 'invalid' || step === 'checking') && (
          <form
            noValidate
            className="space-y-4"
            onSubmit={e => {
              e.preventDefault();
              check(code);
            }}
          >
            {step === 'invalid' && <InvalidInvite />}
            <div>
              <label htmlFor="join-code" className="block text-sm font-medium text-gray-700 mb-1">Invitation code</label>
              <input
                id="join-code"
                type="text"
                autoCapitalize="characters"
                spellCheck={false}
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                placeholder="KNK-XXXXX-XXXXX"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <button type="submit" disabled={step === 'checking'} className="w-full btn-primary disabled:opacity-50">
              {step === 'checking' ? 'Checking…' : 'Continue'}
            </button>
          </form>
        )}

        {step === 'signup' && (
          <>
            <p className="mb-6 text-center text-sm text-gray-600">
              Code <span className="font-mono">{code.trim()}</span> is valid. Choose the email and password for your account.
            </p>
            <InviteSignupForm
              inviteCode={code.trim()}
              onSuccess={() => {
                signedUp.current = true;
                navigate(AFTER_SIGNUP_PATH, { replace: true });
              }}
              onInvalidInvite={() => setStep('invalid')}
            />
          </>
        )}
      </div>
    </main>
  );
};

export default JoinPage;
