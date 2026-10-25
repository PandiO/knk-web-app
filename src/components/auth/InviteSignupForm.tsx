import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, EyeOff, KeyRound } from 'lucide-react';
import { PasswordStrengthMeter } from './PasswordStrengthMeter';
import { useAuth } from '../../contexts/AuthContext';
import { ERROR_MESSAGES, PASSWORD_MIN_LENGTH } from '../../utils/authConstants';
import { calculatePasswordStrength, validateEmailFormat, validatePasswordPolicy } from '../../utils/passwordValidator';
import { PendingClaim, clearPendingClaim, loadPendingClaim } from '../../utils/claimCode';

interface InviteSignupFormProps {
  /** A personal invite: its token and the address it was sent to (shown locked). */
  inviteToken?: string;
  lockedEmail?: string | null;
  /** A shared code: the redeemer types their own email. */
  inviteCode?: string;
  /** Called once the account exists and the player is logged in (after the PIN step, if shown). */
  onSuccess: () => void;
  /** Called as soon as the account exists, before any PIN step, so the page doesn't treat the new
   *  login as "already signed in" (KNG-216). */
  onRegistered?: () => void;
  /** The invite stopped working while the form was open (used up, revoked): show the invalid state. */
  onInvalidInvite: () => void;
}

interface Errors {
  email?: string;
  password?: string;
  confirmPassword?: string;
  rules?: string;
  general?: string;
}

const errorCodeOf = (error: any): string | undefined => error?.code ?? error?.response?.error;
const apiMessageOf = (error: any): string | undefined =>
  typeof error?.response?.message === 'string' && error.response.message ? error.response.message : undefined;

/**
 * The sign-up form of /invite/:token and /join (KNG-212): email (locked for a personal invite),
 * password with the strength meter, and acceptance of the alpha rules. The API creates the web
 * account and logs the player in; Minecraft is linked afterwards (KNG-214). When /link kept a verified
 * claim code (game-first), it goes along and the account is linked in the same step.
 */
export const InviteSignupForm: React.FC<InviteSignupFormProps> = ({ inviteToken, lockedEmail, inviteCode, onSuccess, onRegistered, onInvalidInvite }) => {
  const { register } = useAuth();
  const [email, setEmail] = useState(lockedEmail ?? '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedRules, setAcceptedRules] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [claim, setClaim] = useState<PendingClaim | null>(() => loadPendingClaim());
  // KNG-216: the API's Cloudflare Access sync is on, so the site asks for a PIN next.
  const [pinStepFor, setPinStepFor] = useState<string | null>(null);

  const validate = (): boolean => {
    const next: Errors = {};
    if (!email.trim()) {
      next.email = 'Email is required';
    } else if (!validateEmailFormat(email.trim())) {
      next.email = 'Please enter a valid email address';
    }
    if (!password) {
      next.password = 'Password is required';
    } else {
      const policy = validatePasswordPolicy(password);
      if (!policy.isValid) {
        next.password = policy.message;
      } else if (calculatePasswordStrength(password).score < 2) {
        next.password = calculatePasswordStrength(password).feedback[0]
          || `Password is too weak. Use at least ${PASSWORD_MIN_LENGTH} characters and avoid common patterns.`;
      }
    }
    if (!confirmPassword) {
      next.confirmPassword = 'Confirm password is required';
    } else if (password !== confirmPassword) {
      next.confirmPassword = 'Passwords do not match';
    }
    if (!acceptedRules) {
      next.rules = 'Please accept the alpha rules to continue.';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setBusy(true);
    try {
      const result = await register({
        inviteToken,
        inviteCode,
        email: email.trim(),
        password,
        passwordConfirmation: confirmPassword,
        claimCode: claim?.code,
      });
      if (claim) clearPendingClaim();
      onRegistered?.();
      if (result?.accessGate) {
        setPinStepFor(result.user?.email || email.trim());
        return;
      }
      onSuccess();
    } catch (error: any) {
      const code = errorCodeOf(error);
      if (claim && (code === 'InvalidClaimCode' || code === 'AlreadyRegistered' || code === 'AlreadyLinked')) {
        // The game code no longer works; nothing was created. Without it the account can still be made.
        clearPendingClaim();
        setClaim(null);
        setErrors({ general: `${apiMessageOf(error) ?? 'The code from the server no longer works.'} Submit again to create your account without it; you can link Minecraft on the next page.` });
      } else if (code === 'InvalidInvite') {
        onInvalidInvite();
      } else if (code === 'DuplicateEmail') {
        setErrors({ email: ERROR_MESSAGES.DuplicateEmail });
      } else if (code === 'InviteEmailMismatch' || code === 'InvalidEmail') {
        setErrors({ email: apiMessageOf(error) ?? 'Please enter a valid email address' });
      } else if (code === 'InvalidPassword' || code === 'PasswordMismatch') {
        setErrors({ password: apiMessageOf(error) ?? ERROR_MESSAGES.RegistrationFailed });
      } else if (error?.status === 429) {
        setErrors({ general: apiMessageOf(error) ?? ERROR_MESSAGES.TooManyAttempts });
      } else {
        setErrors({ general: apiMessageOf(error) ?? ERROR_MESSAGES.RegistrationFailed });
      }
    } finally {
      setBusy(false);
    }
  };

  if (pinStepFor) {
    return (
      <div className="space-y-5 text-center" data-testid="access-pin-step">
        <KeyRound className="h-10 w-10 mx-auto text-primary" aria-hidden="true" />
        <h2 className="text-xl font-semibold text-gray-900">Your account is ready</h2>
        <p className="text-sm text-gray-700">
          Next, Cloudflare emails you a one-time PIN to open the site. Use the same address: <strong>{pinStepFor}</strong>.
        </p>
        <p className="text-xs text-gray-500">
          The PIN mail comes from Cloudflare, not from Knights &amp; Kings. After that you stay signed in on this device for a while.
        </p>
        <button type="button" onClick={onSuccess} className="w-full btn-primary">Continue</button>
      </div>
    );
  }

  const inputClass = (invalid: boolean) =>
    `w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${invalid ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-primary'}`;

  return (
    <form noValidate onSubmit={submit} className="space-y-5">
      {claim && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-900" data-testid="pending-claim">
          Your Minecraft account <strong>{claim.minecraftName}</strong> will be linked to this account.
        </div>
      )}
      {errors.general && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4" role="alert">
          <p className="text-sm font-medium text-red-800">{errors.general}</p>
        </div>
      )}

      <div>
        <label htmlFor="invite-email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
        <input
          id="invite-email"
          type="email"
          autoComplete="email"
          value={email}
          readOnly={!!lockedEmail}
          aria-readonly={!!lockedEmail}
          onChange={e => setEmail(e.target.value)}
          className={`${inputClass(!!errors.email)} ${lockedEmail ? 'bg-gray-100 text-gray-700' : ''}`}
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? 'invite-email-error' : lockedEmail ? 'invite-email-locked' : undefined}
        />
        {lockedEmail && !errors.email && (
          <p id="invite-email-locked" className="mt-1 text-xs text-gray-500">The invitation was sent to this address, so it's already verified.</p>
        )}
        {errors.email && <p id="invite-email-error" className="mt-1 text-sm text-red-600" role="alert">{errors.email}</p>}
      </div>

      <div>
        <label htmlFor="invite-password" className="block text-sm font-medium text-gray-700 mb-1">Password</label>
        <div className="relative">
          <input
            id="invite-password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className={`${inputClass(!!errors.password)} pr-10`}
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? 'invite-password-error' : undefined}
          />
          <button type="button" onClick={() => setShowPassword(s => !s)}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500"
            aria-label={showPassword ? 'Hide password' : 'Show password'}>
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {password && <PasswordStrengthMeter password={password} />}
        {errors.password && <p id="invite-password-error" className="mt-1 text-sm text-red-600" role="alert">{errors.password}</p>}
      </div>

      <div>
        <label htmlFor="invite-confirm" className="block text-sm font-medium text-gray-700 mb-1">Confirm password</label>
        <input
          id="invite-confirm"
          type={showPassword ? 'text' : 'password'}
          autoComplete="new-password"
          value={confirmPassword}
          onChange={e => setConfirmPassword(e.target.value)}
          className={inputClass(!!errors.confirmPassword)}
          aria-invalid={!!errors.confirmPassword}
          aria-describedby={errors.confirmPassword ? 'invite-confirm-error' : undefined}
        />
        {errors.confirmPassword && <p id="invite-confirm-error" className="mt-1 text-sm text-red-600" role="alert">{errors.confirmPassword}</p>}
      </div>

      <div>
        <label className="flex items-start gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={acceptedRules} onChange={e => setAcceptedRules(e.target.checked)} className="mt-1"
            aria-describedby={errors.rules ? 'invite-rules-error' : undefined} />
          <span>
            I accept the closed-alpha rules: the game is unfinished, progress may be reset, and I keep what I see to myself
            until the alpha opens up.
          </span>
        </label>
        {errors.rules && <p id="invite-rules-error" className="mt-1 text-sm text-red-600" role="alert">{errors.rules}</p>}
      </div>

      <button type="submit" disabled={busy} className="w-full btn-primary disabled:opacity-50">
        {busy ? 'Creating your account…' : 'Create account'}
      </button>

      <p className="text-center text-sm text-gray-600">
        Already have an account? <Link to="/auth/login" className="font-medium text-primary hover:text-primary-dark">Log in</Link>
      </p>
    </form>
  );
};
