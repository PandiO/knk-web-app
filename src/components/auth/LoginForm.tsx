import React, { useState, useCallback } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { FeedbackModal } from '../FeedbackModal';
import { ERROR_MESSAGES } from '../../utils/authConstants';
import { useAuth } from '../../hooks/useAuth';
import { validateEmailFormat } from '../../utils/passwordValidator';

interface LoginFormProps {
  onLoginSuccess?: () => void;
}

interface FormState {
  email: string;
  password: string;
  rememberMe: boolean;
}

interface FormErrors {
  email?: string;
  password?: string;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onLoginSuccess }) => {
  const { login } = useAuth();
  const [form, setForm] = useState<FormState>({ email: '', password: '', rememberMe: true });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [feedback, setFeedback] = useState<{
    open: boolean;
    title: string;
    message: string;
    status: 'success' | 'error' | 'info';
  }>({ open: false, title: '', message: '', status: 'info' });
  const [errorAnnouncement, setErrorAnnouncement] = useState<string>('');

  const updateField = useCallback((field: keyof FormState, value: string | boolean) => {
    setForm(prev => ({ ...prev, [field]: value } as FormState));
  }, []);

  const validate = (): boolean => {
    const nextErrors: FormErrors = {};
    if (!form.email.trim()) {
      nextErrors.email = 'Email is required';
    } else if (!validateEmailFormat(form.email)) {
      nextErrors.email = 'Please enter a valid email address';
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
      await login({ email: form.email, password: form.password, rememberMe: form.rememberMe });
      setFeedback({ open: true, title: 'Login Successful', message: 'Welcome back!', status: 'success' });
      if (onLoginSuccess) {
        setTimeout(() => onLoginSuccess(), 500);
      }
    } catch (error: any) {
      let message = ERROR_MESSAGES.InvalidCredentials;
      const code = error?.code || error?.response?.code;
      if (code === 'InvalidCredentials') message = ERROR_MESSAGES.InvalidCredentials;
      else if (error?.response?.message) message = error.response.message;
      setErrorAnnouncement(message);
      setFeedback({ open: true, title: 'Login Failed', message, status: 'error' });
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

      <div>
        <label htmlFor="login-email" className="block text-sm font-medium text-gray-700 mb-2">
          Email <span aria-label="required">*</span>
        </label>
        <input
          id="login-email"
          type="email"
          value={form.email}
          onChange={e => updateField('email', e.target.value)}
          className={`w-full px-4 py-2 text-base border rounded-lg focus:outline-none focus:ring-2 transition-colors ${errors.email ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-primary'}`}
          placeholder="you@example.com"
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? 'login-email-error' : undefined}
          autoComplete="email"
          required
        />
        {errors.email && (
          <p id="login-email-error" className="mt-1 text-sm text-red-600" role="alert">
            {errors.email}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="login-password" className="block text-sm font-medium text-gray-700 mb-2">
          Password <span aria-label="required">*</span>
        </label>
        <div className="relative">
          <input
            id="login-password"
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
            tabIndex={0}
          >
            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>
        {errors.password && (
          <p id="login-password-error" className="mt-1 text-sm text-red-600" role="alert">
            {errors.password}
          </p>
        )}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
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
        <p id="remember-help" className="text-xs text-gray-500">
          Keeps you logged in for 30 days
        </p>
        <a href="#" className="text-sm text-primary hover:text-primary-dark focus:outline-none focus:ring-2 focus:ring-primary rounded px-2 py-1">
          Forgot password?
        </a>
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className={`w-full px-4 py-2 text-base font-medium rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary ${
          isSubmitting ? 'bg-primary-light text-white opacity-60 cursor-not-allowed' : 'bg-primary text-white hover:bg-primary-dark'
        }`}
        aria-label={isSubmitting ? 'Logging in, please wait' : 'Log in'}
      >
        {isSubmitting ? (
          <>
            <span className="inline-block animate-spin mr-2">⏳</span>
            Logging in...
          </>
        ) : (
          'Log In'
        )}
      </button>

      <div className="text-center text-sm text-gray-600">
        <span>New here? </span>
        <a href="/auth/register" className="text-primary hover:text-primary-dark focus:outline-none focus:ring-2 focus:ring-primary rounded px-2 py-1">
          Create an account
        </a>
      </div>

      <FeedbackModal
        open={feedback.open}
        title={feedback.title}
        message={feedback.message}
        status={feedback.status}
        onClose={() => setFeedback(prev => ({ ...prev, open: false }))}
        autoCloseMs={feedback.status === 'success' ? 1000 : undefined}
      />
    </form>
  );
};
