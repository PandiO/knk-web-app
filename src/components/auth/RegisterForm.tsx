import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, CheckCircle2 } from 'lucide-react';
import { FormStepper } from './FormStepper';
import { FormStep1 } from './FormStep1';
import { authClient } from '../../apiClients/authClient';
import { ERROR_MESSAGES, PASSWORD_MIN_LENGTH } from '../../utils/authConstants';
import { validateEmailFormat, validatePasswordPolicy, calculatePasswordStrength } from '../../utils/passwordValidator';
import { useAuth } from '../../contexts/AuthContext';
import { appConfig } from '../../config/appConfig';
import { LINK_CODE_LENGTH, normalizeLinkCode, normalizeLinkCodeInput } from '../../utils/linkCode';
import { CLAIM_CODE_STAYS_VALID, couldBeClaimCode, formatClaimCode, looksLikeClaimCode } from '../../utils/claimCode';
import { apiRefusalReason } from '../../utils/apiRefusalReason';
import { useRegistrationMode } from '../../hooks/useOnboardingInfo';


interface AccountData {
  email: string;
  password: string;
  confirmPassword: string;
}

interface FormErrors {
  linkCode?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  /** Errors about the Minecraft account itself (AlreadyRegistered). */
  account?: string;
  /** Registration is invite-only and this account isn't admitted (KNG-212 InviteRequired). */
  invite?: string;
  general?: string;
}

interface RegisterFormProps {
  /** Called right before the account is created, and with false when that fails. */
  onRegistering?: (registering: boolean) => void;
  /** Called once the account exists and the player is logged in. */
  onRegistrationSuccess?: () => void;
}

const STEPS = ['Link code', 'Email & password', 'Done'];

const INVITE_ENTRY_HELP = 'Enter an invitation code like KNK-XXXXX-XXXXX, or the code from the server like K7QH-M2XA.';

/** /link with the claim code in the URL (the page checks it on arrival). */
const claimPath = (code: string) => `/link?code=${encodeURIComponent(formatClaimCode(code))}`;

const errorCodeOf = (error: any): string | undefined => error?.code ?? error?.response?.error;
const apiMessageOf = (error: any): string | undefined =>
  typeof error?.response?.message === 'string' && error.response.message ? error.response.message : undefined;

/**
 * Registration (D1, game -> web): the player runs `/account link` in game, enters the code here,
 * which decides the Minecraft account and name, then sets an email and a password. The API logs
 * them in right away.
 *
 * With invitations on (Security:Registration:Mode=Invite, KNG-212) that path only works for
 * grandfathered players, so the form opens on an invitation step instead: an invitation code goes
 * to /join, the claim code from the server's disconnect screen to /link, and the link-code step
 * sits behind "Already playing and got a code from /account link?". A claim code typed into the
 * link-code field (XXXX-XXXX) is recognised and sent to /link too (alpha finding, 2026-10-25).
 */
export const RegisterForm: React.FC<RegisterFormProps> = ({ onRegistering, onRegistrationSuccess }) => {
  const { register } = useAuth();
  const navigate = useNavigate();
  const { inviteSignup } = useRegistrationMode();
  const serverAddress = appConfig.minecraft.serverAddress;
  const [currentStep, setCurrentStep] = useState(0);
  // As typed (a dash is kept, so a claim code can be told apart); the API gets the 8 characters.
  const [linkCodeInput, setLinkCodeInput] = useState('');
  const linkCode = normalizeLinkCode(linkCodeInput);
  const claimCodeTyped = looksLikeClaimCode(linkCodeInput);
  // Invite mode: the link-code step is folded away until the player says they have one.
  const [linkCodePathOpen, setLinkCodePathOpen] = useState(false);
  const [inviteEntry, setInviteEntry] = useState('');
  const [inviteEntryError, setInviteEntryError] = useState<string | null>(null);
  const showLinkCodePath = !inviteSignup || linkCodePathOpen;
  const [minecraftName, setMinecraftName] = useState<string | null>(null);
  const [account, setAccount] = useState<AccountData>({ email: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isBusy, setIsBusy] = useState(false);
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);
  const isFirstRender = useRef(true);

  // Move focus to the new step's heading so keyboard and screen reader users follow along.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    stepHeadingRef.current?.focus();
  }, [currentStep]);

  const handleAccountChange = useCallback((field: string, value: string) => {
    setAccount(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleAccountError = useCallback((field: string, error: string | null) => {
    setErrors(prev => ({ ...prev, [field]: error || undefined }));
  }, []);

  /** The invitation step: decide from the shape of what was typed where it is handled. */
  const continueWithEntry = () => {
    const raw = inviteEntry.trim();
    if (!raw) {
      setInviteEntryError(INVITE_ENTRY_HELP);
      return;
    }
    if (looksLikeClaimCode(raw)) {
      navigate(claimPath(raw));
      return;
    }
    const asLinkCode = normalizeLinkCode(raw);
    if (!raw.includes('-') && asLinkCode.length === LINK_CODE_LENGTH && asLinkCode === raw.toUpperCase()) {
      // 8 plain characters: an /account link code. Open that path with it filled in.
      setInviteEntryError(null);
      setLinkCodeInput(asLinkCode);
      setLinkCodePathOpen(true);
      return;
    }
    navigate(`/join?code=${encodeURIComponent(raw.toUpperCase())}`);
  };

  const handleCheckCode = async () => {
    if (claimCodeTyped) {
      // The code from the server's disconnect screen, not an /account link code: the claim flow takes it.
      navigate(claimPath(linkCodeInput));
      return;
    }
    if (linkCode.length !== LINK_CODE_LENGTH) {
      setErrors({ linkCode: `Enter the ${LINK_CODE_LENGTH}-character code from /account link.` });
      return;
    }
    setIsBusy(true);
    setErrors({});
    try {
      const result = await authClient.validateLinkCode(linkCode);
      if (result?.isValid && result.username) {
        setMinecraftName(result.username);
        setCurrentStep(1);
      } else {
        setErrors({ linkCode: ERROR_MESSAGES.InvalidLinkCode });
      }
    } catch (error: any) {
      setErrors({
        linkCode: errorCodeOf(error) === 'TooManyAttempts' || error?.status === 429
          ? apiMessageOf(error) ?? ERROR_MESSAGES.TooManyAttempts
          : apiRefusalReason(error) ?? ERROR_MESSAGES.ServerError,
      });
    } finally {
      setIsBusy(false);
    }
  };

  const validateAccount = (): boolean => {
    const next: FormErrors = {};
    if (!account.email.trim()) {
      next.email = 'Email is required';
    } else if (!validateEmailFormat(account.email)) {
      next.email = 'Please enter a valid email address';
    }

    if (!account.password) {
      next.password = 'Password is required';
    } else {
      const policy = validatePasswordPolicy(account.password);
      if (!policy.isValid) {
        next.password = policy.message;
      } else if (calculatePasswordStrength(account.password).score < 2) {
        next.password = calculatePasswordStrength(account.password).feedback[0]
          || `Password is too weak. Use at least ${PASSWORD_MIN_LENGTH} characters and avoid common patterns.`;
      }
    }

    if (!account.confirmPassword) {
      next.confirmPassword = 'Confirm password is required';
    } else if (account.password !== account.confirmPassword) {
      next.confirmPassword = 'Passwords do not match';
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleRegister = async () => {
    if (!validateAccount()) return;
    setIsBusy(true);
    onRegistering?.(true);
    try {
      await register({
        linkCode,
        email: account.email.trim(),
        password: account.password,
        passwordConfirmation: account.confirmPassword,
      });
      setErrors({});
      setCurrentStep(2);
      onRegistrationSuccess?.();
    } catch (error: any) {
      onRegistering?.(false);
      const code = errorCodeOf(error);
      if (code === 'DuplicateEmail') {
        setErrors({ email: ERROR_MESSAGES.DuplicateEmail });
      } else if (code === 'InviteRequired') {
        setErrors({ invite: ERROR_MESSAGES.InviteRequired });
      } else if (code === 'AlreadyRegistered') {
        setErrors({ account: ERROR_MESSAGES.AlreadyRegistered });
      } else if (code === 'InvalidLinkCode') {
        // The code expired or was used meanwhile: back to step 1 for a new one.
        setMinecraftName(null);
        setCurrentStep(0);
        setErrors({ linkCode: ERROR_MESSAGES.InvalidLinkCode });
      } else if (code === 'TooManyAttempts' || error?.status === 429) {
        setErrors({ general: apiMessageOf(error) ?? ERROR_MESSAGES.TooManyAttempts });
      } else if (code === 'ValidationFailed') {
        setErrors({ general: apiMessageOf(error) ?? ERROR_MESSAGES.RegistrationFailed });
      } else {
        setErrors({ general: apiMessageOf(error) ?? ERROR_MESSAGES.RegistrationFailed });
      }
    } finally {
      setIsBusy(false);
    }
  };

  const startOver = () => {
    setMinecraftName(null);
    setLinkCodeInput('');
    setErrors({});
    setCurrentStep(0);
  };

  return (
    <form
      className="w-full max-w-2xl mx-auto"
      noValidate
      onSubmit={e => {
        e.preventDefault();
        if (currentStep === 0) {
          if (showLinkCodePath) handleCheckCode();
          else continueWithEntry();
        } else if (currentStep === 1) {
          handleRegister();
        }
      }}
    >
      {showLinkCodePath && <FormStepper steps={STEPS} currentStep={currentStep} />}

      <div className="mt-6 sm:mt-8 mb-6 sm:mb-8">
        <h2 ref={stepHeadingRef} tabIndex={-1} className="text-xl font-semibold text-gray-900 mb-4 focus:outline-none">
          {currentStep === 0 && (showLinkCodePath ? 'Enter your link code' : 'Sign up with your invitation')}
          {currentStep === 1 && 'Choose your email and password'}
          {currentStep === 2 && 'You’re all set'}
        </h2>

        {errors.general && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4" role="alert">
            <p className="text-sm font-medium text-red-800">{errors.general}</p>
          </div>
        )}

        {errors.invite && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4" role="alert" data-testid="invite-required">
            <p className="text-sm font-medium text-amber-900">{errors.invite}</p>
            <p className="mt-1 text-sm text-amber-900">
              Got an invitation code? <Link to="/join" className="font-medium underline">Sign up with it</Link>.
            </p>
          </div>
        )}

        {currentStep === 0 && inviteSignup && !linkCodePathOpen && (
          <div className="space-y-4" data-testid="invite-mode">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-medium">Knights &amp; Kings is invite-only right now.</p>
              <p className="mt-1">
                Got an invitation <strong>link</strong> in your mail? Open it: it creates your account. Got an invitation{' '}
                <strong>code</strong> (KNK-XXXXX-XXXXX), or the code the server showed you when you tried to join
                (like K7QH-M2XA)? Enter it below.
              </p>
            </div>
            <div>
              <label htmlFor="invite-entry" className="block text-sm font-medium text-gray-700 mb-2">
                Invitation code or code from the server
              </label>
              <input
                id="invite-entry"
                data-testid="invite-entry"
                type="text"
                autoComplete="one-time-code"
                autoCapitalize="characters"
                spellCheck={false}
                value={inviteEntry}
                onChange={e => {
                  setInviteEntry(e.target.value);
                  setInviteEntryError(null);
                }}
                placeholder="KNK-XXXXX-XXXXX or K7QH-M2XA"
                className={`w-full px-4 py-2 border rounded-lg font-mono tracking-wider focus:outline-none focus:ring-2 ${
                  inviteEntryError ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-primary'
                }`}
                aria-invalid={!!inviteEntryError}
                aria-describedby={inviteEntryError ? 'invite-entry-error' : undefined}
              />
              {inviteEntryError && (
                <p id="invite-entry-error" className="mt-1 text-sm text-red-600" role="alert">{inviteEntryError}</p>
              )}
            </div>
            <button type="submit" className="w-full btn-primary">Continue</button>
            <button
              type="button"
              onClick={() => setLinkCodePathOpen(true)}
              className="block mx-auto text-sm font-medium text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-primary rounded"
            >
              Already playing and got a code from /account link?
            </button>
          </div>
        )}

        {currentStep === 0 && showLinkCodePath && (
          <div className="space-y-4">
            {inviteSignup && (
              <p className="text-sm text-gray-600" data-testid="grandfathered-note">
                For players from before the invitations. New here?{' '}
                <button type="button" onClick={() => setLinkCodePathOpen(false)} className="font-medium text-primary underline">
                  Sign up with your invitation instead
                </button>.
              </p>
            )}
            <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700" id="link-code-help">
              <li>Join <code className="rounded bg-gray-100 px-1 py-0.5 font-mono">{serverAddress}</code> in Minecraft.</li>
              <li>Type <code className="rounded bg-gray-100 px-1 py-0.5 font-mono">/account link</code> in chat.</li>
              <li>Enter the {LINK_CODE_LENGTH}-character code below. It's valid for 20 minutes.</li>
            </ol>
            <div>
              <label htmlFor="linkCode" className="block text-sm font-medium text-gray-700 mb-2">
                Link code <span aria-hidden="true">*</span>
              </label>
              <input
                id="linkCode"
                data-testid="link-code"
                type="text"
                inputMode="text"
                autoComplete="one-time-code"
                autoCapitalize="characters"
                spellCheck={false}
                value={linkCodeInput}
                onChange={e => {
                  setLinkCodeInput(normalizeLinkCodeInput(e.target.value));
                  setErrors(prev => ({ ...prev, linkCode: undefined }));
                }}
                className={`w-full px-4 py-2 border rounded-lg font-mono text-lg tracking-widest uppercase focus:outline-none focus:ring-2 transition-colors ${
                  errors.linkCode ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-primary'
                }`}
                placeholder="ABCD1234"
                aria-invalid={!!errors.linkCode}
                aria-describedby={errors.linkCode ? 'link-code-help link-code-error' : 'link-code-help'}
                required
              />
              {errors.linkCode && (
                <p id="link-code-error" className="mt-1 text-sm text-red-600" role="alert">
                  {errors.linkCode}
                </p>
              )}
              {claimCodeTyped && (
                <p className="mt-2 text-sm text-amber-900" data-testid="claim-code-detected">
                  That's the code from the server's disconnect screen, not an /account link code. Continue and it is
                  used to link your Minecraft account.
                </p>
              )}
              {errors.linkCode && !claimCodeTyped && couldBeClaimCode(linkCode) && (
                <p className="mt-2 text-sm text-gray-700" data-testid="claim-code-hint">
                  Is this the code the server showed you when you tried to join (XXXX-XXXX)? Then{' '}
                  <Link to={claimPath(linkCode)} className="font-medium underline">use it to link your Minecraft account</Link>.{' '}
                  {CLAIM_CODE_STAYS_VALID}
                </p>
              )}
            </div>
          </div>
        )}

        {currentStep === 1 && minecraftName && (
          <div className="space-y-6">
            <div
              className={`rounded-lg border p-4 ${errors.account ? 'border-red-300 bg-red-50' : 'border-green-200 bg-green-50'}`}
            >
              <p className="text-sm text-gray-800" data-testid="link-code-owner">
                This code belongs to <strong>{minecraftName}</strong>.
              </p>
              {errors.account && (
                <div id="account-error" className="mt-2 text-sm text-red-700" role="alert">
                  <p>{errors.account}</p>
                  <p className="mt-1">
                    <Link to="/auth/login" className="font-medium underline">Log in</Link>
                    {' or '}
                    <Link to="/auth/forgot-password" className="font-medium underline">reset your password</Link>.
                  </p>
                </div>
              )}
              <button
                type="button"
                onClick={startOver}
                className="mt-2 text-sm font-medium text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-primary rounded"
              >
                Not you? Use a different code
              </button>
            </div>

            <FormStep1
              data={account}
              errors={{ email: errors.email, password: errors.password, confirmPassword: errors.confirmPassword }}
              onChange={handleAccountChange}
              onError={handleAccountError}
            />
          </div>
        )}

        {currentStep === 2 && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-6 text-center" role="status">
            <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" aria-hidden="true" />
            <p className="mt-3 text-base text-gray-800">
              Welcome, <strong>{minecraftName}</strong>! Your web account is ready and you're logged in.
            </p>
            <Link
              to="/account"
              className="mt-4 inline-block rounded-lg bg-primary px-6 py-2 font-medium text-white hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
            >
              Go to your account
            </Link>
          </div>
        )}
      </div>

      {currentStep < 2 && showLinkCodePath && (
        <div className="flex flex-col-reverse sm:flex-row gap-4 justify-between">
          {currentStep === 1 ? (
            <button
              type="button"
              onClick={startOver}
              disabled={isBusy}
              className="flex items-center justify-center gap-2 px-6 py-2 text-base rounded-lg font-medium bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
              Back
            </button>
          ) : (
            <span />
          )}
          <button
            type="submit"
            disabled={isBusy}
            className="flex items-center justify-center gap-2 px-6 py-2 text-base rounded-lg font-medium bg-primary text-white hover:bg-primary-dark shadow-md disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
          >
            {isBusy && (
              <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" aria-hidden="true" />
            )}
            {currentStep === 0
              ? (isBusy ? 'Checking…' : claimCodeTyped ? 'Continue with this code' : 'Check code')
              : (isBusy ? 'Creating account…' : 'Create account')}
          </button>
        </div>
      )}
    </form>
  );
};
