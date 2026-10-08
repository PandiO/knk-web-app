import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, CheckCircle2 } from 'lucide-react';
import { FormStepper } from './FormStepper';
import { FormStep1 } from './FormStep1';
import { authClient } from '../../apiClients/authClient';
import { ERROR_MESSAGES, PASSWORD_MIN_LENGTH } from '../../utils/authConstants';
import { validateEmailFormat, validatePasswordPolicy, calculatePasswordStrength } from '../../utils/passwordValidator';
import { useAuth } from '../../contexts/AuthContext';
import { appConfig } from '../../config/appConfig';
import { LINK_CODE_LENGTH, normalizeLinkCode } from '../../utils/linkCode';


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
  general?: string;
}

interface RegisterFormProps {
  /** Called right before the account is created, and with false when that fails. */
  onRegistering?: (registering: boolean) => void;
  /** Called once the account exists and the player is logged in. */
  onRegistrationSuccess?: () => void;
}

const STEPS = ['Link code', 'Email & password', 'Done'];

const errorCodeOf = (error: any): string | undefined => error?.code ?? error?.response?.error;
const apiMessageOf = (error: any): string | undefined =>
  typeof error?.response?.message === 'string' && error.response.message ? error.response.message : undefined;

/**
 * Registration (D1, game -> web): the player runs `/account link` in game, enters the code here,
 * which decides the Minecraft account and name, then sets an email and a password. The API logs
 * them in right away.
 */
export const RegisterForm: React.FC<RegisterFormProps> = ({ onRegistering, onRegistrationSuccess }) => {
  const { register } = useAuth();
  const serverAddress = appConfig.minecraft.serverAddress;
  const [currentStep, setCurrentStep] = useState(0);
  const [linkCode, setLinkCode] = useState('');
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

  const handleCheckCode = async () => {
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
          : ERROR_MESSAGES.ServerError,
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
    setLinkCode('');
    setErrors({});
    setCurrentStep(0);
  };

  return (
    <form
      className="w-full max-w-2xl mx-auto"
      noValidate
      onSubmit={e => {
        e.preventDefault();
        if (currentStep === 0) handleCheckCode();
        else if (currentStep === 1) handleRegister();
      }}
    >
      <FormStepper steps={STEPS} currentStep={currentStep} />

      <div className="mt-6 sm:mt-8 mb-6 sm:mb-8">
        <h2 ref={stepHeadingRef} tabIndex={-1} className="text-xl font-semibold text-gray-900 mb-4 focus:outline-none">
          {currentStep === 0 && 'Enter your link code'}
          {currentStep === 1 && 'Choose your email and password'}
          {currentStep === 2 && 'You’re all set'}
        </h2>

        {errors.general && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4" role="alert">
            <p className="text-sm font-medium text-red-800">{errors.general}</p>
          </div>
        )}

        {currentStep === 0 && (
          <div className="space-y-4">
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
                value={linkCode}
                onChange={e => {
                  setLinkCode(normalizeLinkCode(e.target.value));
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

      {currentStep < 2 && (
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
            {currentStep === 0 ? (isBusy ? 'Checking…' : 'Check code') : (isBusy ? 'Creating account…' : 'Create account')}
          </button>
        </div>
      )}
    </form>
  );
};
