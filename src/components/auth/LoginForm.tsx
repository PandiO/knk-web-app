import React, { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { ERROR_MESSAGES } from '../../utils/authConstants';
import { useAuth } from '../../contexts/AuthContext';

interface LoginFormProps {
  /** Called after a successful login; the login page decides where to go. */
  onLoginSuccess?: () => void;
}

interface FormState {
  login: string;
  password: string;
  rememberMe: boolean;
}

interface FormErrors {
  login?: string;
  password?: string;
  general?: string;
}

/** A user-facing message for a failed login. Never says which of the two fields was wrong. */
export function describeLoginError(error: any): string {
  const code = error?.code ?? error?.response?.error;
  const status = error?.status;
  if (code === 'TooManyAttempts' || status === 429) {
    const apiMessage = error?.response?.message;
    if (typeof apiMessage === 'string' && apiMessage) return apiMessage;
    const seconds = Number(error?.retryAfter);
    return Number.isFinite(seconds) && seconds > 0
      ? `Too many attempts. Try again in ${Math.ceil(seconds / 60)} minute${seconds > 60 ? 's' : ''}.`
      : 'Too many attempts. Wait a few minutes and try again.';
  }
  if (code === 'InvalidCredentials' || status === 401) {
    return ERROR_MESSAGES.InvalidCredentials;
  }
  if (error instanceof TypeError || status === undefined) {
    return ERROR_MESSAGES.NetworkError;
  }
  return ERROR_MESSAGES.ServerError;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onLoginSuccess }) => {
  const { login } = useAuth();
  // Remember me is opt-in: without it the session ends when the browser closes.
  const [form, setForm] = useState<FormState>({ login: '', password: '', rememberMe: false });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorAnnouncement, setErrorAnnouncement] = useState<string>('');

  const updateField = useCallback((field: keyof FormState, value: string | boolean) => {
    setForm(prev => ({ ...prev, [field]: value } as FormState));
    // Clear errors when user starts typing
    if (field === 'login' || field === 'password') {
      setErrors(prev => ({ ...prev, [field]: undefined, general: undefined }));
    }
  }, []);

  const validate = (): boolean => {
    const nextErrors: FormErrors = {};
    if (!form.login.trim()) {
      nextErrors.login = 'Enter your email or Minecraft name';
    }
    if (!form.password) {
      nextErrors.password = 'Password is required';
    }
    setErrors(nextErrors);

    // Announce errors to screen readers
    if (Object.keys(nextErrors).length > 0) {
      const errorList = Object.values(nextErrors).filter(Boolean).join('. ');
      setErrorAnnouncement(`Login form has errors: ${errorList}`);
    }

    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await login({ login: form.login.trim(), password: form.password, rememberMe: form.rememberMe });
      onLoginSuccess?.();
    } catch (error: any) {
      const message = describeLoginError(error);
      setErrors({ general: message });
      setErrorAnnouncement(message);
      // Clear the password, keep what was typed as the login
      setForm(prev => ({ ...prev, password: '' }));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      {/* Screen reader announcements */}
      <div className="sr-only" role="alert" aria-live="assertive" aria-atomic="true">
        {errorAnnouncement}
      </div>

      {/* General login error message */}
      {errors.general && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4" data-testid="login-error">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-red-800">
                {errors.general}
              </p>
            </div>
          </div>
        </div>
      )}

      <div>
        <label htmlFor="login-identifier" className="block text-sm font-medium text-gray-700 mb-2">
          Email or Minecraft name <span aria-hidden="true">*</span>
        </label>
        <input
          id="login-identifier"
          name="username"
          type="text"
          value={form.login}
          onChange={e => updateField('login', e.target.value)}
          className={`w-full px-4 py-2 text-base border rounded-lg focus:outline-none focus:ring-2 transition-colors ${errors.login ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-primary'}`}
          placeholder="you@example.com or Steve"
          aria-invalid={!!errors.login}
          aria-describedby={errors.login ? 'login-identifier-error' : undefined}
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
        />
        {errors.login && (
          <p id="login-identifier-error" className="mt-1 text-sm text-red-600" role="alert">
            {errors.login}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="login-password" className="block text-sm font-medium text-gray-700 mb-2">
          Password <span aria-hidden="true">*</span>
        </label>
        <div className="relative">
          <input
            id="login-password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            value={form.password}
            onChange={e => updateField('password', e.target.value)}
            className={`w-full px-4 py-2 text-base border rounded-lg pr-10 focus:outline-none focus:ring-2 transition-colors ${errors.password ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-primary'}`}
            placeholder="••••••••"
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? 'login-password-error' : undefined}
            autoComplete="current-password"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(v => !v)}
            className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-500 hover:text-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary rounded-r-lg"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            aria-pressed={showPassword}
          >
            {showPassword ? <EyeOff className="h-5 w-5" aria-hidden="true" /> : <Eye className="h-5 w-5" aria-hidden="true" />}
          </button>
        </div>
        {errors.password && (
          <p id="login-password-error" className="mt-1 text-sm text-red-600" role="alert">
            {errors.password}
          </p>
        )}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <label htmlFor="login-remember" className="inline-flex items-center gap-2 cursor-pointer">
            <input
              id="login-remember"
              type="checkbox"
              checked={form.rememberMe}
              onChange={e => updateField('rememberMe', e.target.checked)}
              className="h-4 w-4 text-primary border-gray-300 rounded focus:ring-2 focus:ring-primary"
              aria-describedby="remember-help"
            />
            <span className="text-sm text-gray-700">Remember me</span>
          </label>
          <p id="remember-help" className="text-xs text-gray-500 mt-1">
            Stay logged in for 30 days. Don't use on a shared computer.
          </p>
        </div>
        <Link to="/auth/forgot-password" className="text-sm text-primary hover:text-primary-dark focus:outline-none focus:ring-2 focus:ring-primary rounded px-2 py-1">
          Forgot password?
        </Link>
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className={`w-full px-4 py-2 text-base font-medium rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary ${
          isSubmitting ? 'bg-primary-light text-white opacity-60 cursor-not-allowed' : 'bg-primary text-white hover:bg-primary-dark'
        }`}
      >
        {isSubmitting ? 'Logging in…' : 'Log In'}
      </button>

      <div className="text-center text-sm text-gray-600">
        <span>New here? </span>
        <Link to="/auth/register" className="text-primary hover:text-primary-dark focus:outline-none focus:ring-2 focus:ring-primary rounded px-2 py-1">
          Create an account
        </Link>
      </div>
    </form>
  );
};
