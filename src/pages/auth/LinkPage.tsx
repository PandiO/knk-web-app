import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, KeyRound } from 'lucide-react';
import { admissionClient } from '../../apiClients/admissionClient';
import { useAuth } from '../../contexts/AuthContext';
import { usePageTitle } from '../../hooks/usePageTitle';
import { useNoReferrer } from '../../hooks/useNoReferrer';
import { authService } from '../../services/authService';
import { apiRefusalReason } from '../../utils/apiRefusalReason';
import {
  CLAIM_CODE_LENGTH,
  CLAIM_CODE_STAYS_VALID,
  PendingClaim,
  clearPendingClaim,
  formatClaimCode,
  loadPendingClaim,
  normalizeClaimCode,
  savePendingClaim,
} from '../../utils/claimCode';

type Step = 'code' | 'checking' | 'verified' | 'linking' | 'linked';

const INVALID_CODE = `This code is invalid or has expired. ${CLAIM_CODE_STAYS_VALID}`;

/**
 * /link (KNG-214, DESIGN.md § 5.3), open without an account: the player enters the claim code from the
 * server's disconnect screen. Once the API has verified it, a logged-in player without Minecraft links
 * straight away; anyone else logs in or signs up with an invitation, and the verified code is kept in
 * sessionStorage for its 15 minutes so it survives that detour (the invite pages and /account/link pick
 * it up). `/link?code=XXXX-XXXX` (from the register page, which recognises a claim code typed into its
 * link-code field) fills the code in and checks it at once; the code leaves the address bar.
 */
export const LinkPage: React.FC = () => {
  usePageTitle('Link your Minecraft account');
  useNoReferrer();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isLoggedIn, user, refresh } = useAuth();
  // Read once: the URL no longer holds it after the replaceState below.
  const [codeFromUrl] = useState(() => searchParams.get('code') ?? '');
  const [claim, setClaim] = useState<PendingClaim | null>(() => loadPendingClaim());
  const [step, setStep] = useState<Step>(() => (loadPendingClaim() ? 'verified' : 'code'));
  const [code, setCode] = useState(() => formatClaimCode(codeFromUrl));
  const [error, setError] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState('');

  const checkCode = async (value: string) => {
    const normalized = normalizeClaimCode(value);
    if (normalized.length !== CLAIM_CODE_LENGTH) {
      setError(`Enter the ${CLAIM_CODE_LENGTH}-character code from the server, like K7QH-M2XA.`);
      return;
    }
    setError(null);
    setStep('checking');
    try {
      const result = await admissionClient.checkClaim(normalized);
      if (result?.valid && result.minecraftName && result.expiresAt) {
        const verified = { code: normalized, minecraftName: result.minecraftName, expiresAt: result.expiresAt };
        savePendingClaim(verified);
        setClaim(verified);
        setStep('verified');
      } else {
        setError(INVALID_CODE);
        setStep('code');
      }
    } catch (err) {
      setError(apiRefusalReason(err) ?? INVALID_CODE);
      setStep('code');
    }
  };

  useEffect(() => {
    if (!codeFromUrl) return;
    if (window.location.search) {
      window.history.replaceState(window.history.state, '', '/link');
    }
    if (!loadPendingClaim()) checkCode(codeFromUrl);
    // Only the code the page was opened with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codeFromUrl]);

  const linkNow = async () => {
    if (!claim) return;
    setError(null);
    setStep('linking');
    try {
      await authService.linkMinecraftAccount({ linkCode: claim.code });
      clearPendingClaim();
      await refresh();
      setStep('linked');
    } catch (err) {
      setError(`${apiRefusalReason(err) ?? 'Linking failed.'} ${CLAIM_CODE_STAYS_VALID}`);
      setStep('verified');
    }
  };

  const startOver = () => {
    clearPendingClaim();
    setClaim(null);
    setCode('');
    setError(null);
    setStep('code');
  };

  const joinWithInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    navigate(`/join?code=${encodeURIComponent(inviteCode.trim().toUpperCase())}`);
  };

  const alreadyLinked = isLoggedIn && !!user && (user.minecraftLinked ?? !!user.uuid);

  return (
    <main className="min-h-screen flex items-center justify-center py-8 sm:py-12 px-4 bg-gray-50">
      <div className="w-full max-w-xl bg-white rounded-xl shadow-lg p-6 sm:p-8 border border-gray-100">
        <div className="mb-6 text-center">
          <KeyRound className="h-10 w-10 mx-auto text-primary" aria-hidden="true" />
          <h1 className="mt-3 text-2xl sm:text-3xl font-bold text-gray-900">Link your Minecraft account</h1>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4" role="alert">
            <p className="text-sm font-medium text-red-800">{error}</p>
          </div>
        )}

        {(step === 'code' || step === 'checking') && (
          <form
            noValidate
            onSubmit={e => {
              e.preventDefault();
              checkCode(code);
            }}
            className="space-y-4"
          >
            <p className="text-sm text-gray-600">
              Joining the server showed you a code on the disconnect screen. Enter it here. Never give this code to anyone; staff never ask for it.
            </p>
            <div>
              <label htmlFor="claim-code" className="block text-sm font-medium text-gray-700 mb-1">Code from the server</label>
              <input
                id="claim-code"
                type="text"
                autoComplete="one-time-code"
                autoCapitalize="characters"
                spellCheck={false}
                value={code}
                onChange={e => setCode(formatClaimCode(e.target.value))}
                placeholder="K7QH-M2XA"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <button type="submit" disabled={step === 'checking'} className="w-full btn-primary disabled:opacity-50">
              {step === 'checking' ? 'Checking…' : 'Continue'}
            </button>
          </form>
        )}

        {(step === 'verified' || step === 'linking') && claim && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-4">
              <CheckCircle2 className="h-5 w-5 text-green-700" aria-hidden="true" />
              <p className="text-sm text-green-900">
                Verified: Minecraft account <strong>{claim.minecraftName}</strong>
              </p>
            </div>

            {isLoggedIn && !alreadyLinked && (
              <button type="button" onClick={linkNow} disabled={step === 'linking'} className="w-full btn-primary disabled:opacity-50">
                {step === 'linking' ? 'Linking…' : `Link ${claim.minecraftName} to my account`}
              </button>
            )}

            {isLoggedIn && alreadyLinked && (
              <p className="text-sm text-gray-700">
                Your web account is already linked to a Minecraft account. Log out first to use this code with another account.
              </p>
            )}

            {!isLoggedIn && (
              <>
                <div>
                  <h2 className="text-base font-semibold text-gray-900">Already have an account?</h2>
                  <Link to="/auth/login?returnTo=/link" className="mt-2 inline-block btn-primary">Log in</Link>
                </div>
                <div className="border-t pt-6">
                  <h2 className="text-base font-semibold text-gray-900">New here? Create your account with an invitation</h2>
                  <p className="mt-1 text-sm text-gray-600">
                    Got an invitation mail? Open its link now; your Minecraft account is linked when you create the account.
                    Or enter an invitation code:
                  </p>
                  <form noValidate onSubmit={joinWithInvite} className="mt-3 flex gap-2">
                    <label htmlFor="link-invite-code" className="sr-only">Invitation code</label>
                    <input
                      id="link-invite-code"
                      type="text"
                      autoCapitalize="characters"
                      spellCheck={false}
                      value={inviteCode}
                      onChange={e => setInviteCode(e.target.value.toUpperCase())}
                      placeholder="KNK-XXXXX-XXXXX"
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <button type="submit" className="btn-primary">Continue</button>
                  </form>
                  <p className="mt-4 text-sm text-gray-500">
                    No invitation? The Knights &amp; Kings alpha is invite-only. Keep this page open: the code works for 15 minutes.
                  </p>
                </div>
              </>
            )}

            <button type="button" onClick={startOver} className="text-sm text-gray-500 underline">Use another code</button>
          </div>
        )}

        {step === 'linked' && claim && (
          <div className="space-y-4 text-center">
            <CheckCircle2 className="h-10 w-10 mx-auto text-green-600" aria-hidden="true" />
            <p className="text-gray-800">
              <strong>{claim.minecraftName}</strong> is linked to your account. Join the server again to play.
            </p>
            <Link to="/account" className="inline-block btn-primary">Go to my account</Link>
          </div>
        )}
      </div>
    </main>
  );
};

export default LinkPage;
