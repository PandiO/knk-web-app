import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { FeedbackModal } from '../FeedbackModal';
import { ERROR_MESSAGES } from '../../utils/authConstants';
import { useAuth } from '../../contexts/AuthContext';
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
  general?: string;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onLoginSuccess }) => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const navigationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isSuccessfulLoginRef = useRef<boolean>(false);
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
  const [loginAttempted, setLoginAttempted] = useState(false);

  // Cleanup timeout on component unmount
  useEffect(() => {
    console.log('[LoginForm] Mounted and setting up cleanup for navigation timeout');
    return () => {
      console.log('[LoginForm] Unmounting - cleaning up');
      if (navigationTimeoutRef.current) {
        console.log('[LoginForm] Clearing pending navigation timeout on unmount');
        clearTimeout(navigationTimeoutRef.current);
        navigationTimeoutRef.current = null;
      }
      isSuccessfulLoginRef.current = false;
    };
  }, []);

  const updateField = useCallback((field: keyof FormState, value: string | boolean) => {
    setForm(prev => ({ ...prev, [field]: value } as FormState));
    // Clear errors when user starts typing
    if (field === 'email' || field === 'password') {
      setErrors(prev => ({ ...prev, [field]: undefined, general: undefined }));
    }
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
    
    // Reset success flag at start of new attempt
    isSuccessfulLoginRef.current = false;
    console.log('[LoginForm] Starting new login attempt, reset success flag');
    
    // Clear any pending navigation timeout from previous attempts
    if (navigationTimeoutRef.current) {
      console.log('[LoginForm] Clearing pending timeout from previous attempt');
      clearTimeout(navigationTimeoutRef.current);
      navigationTimeoutRef.current = null;
    }
    
    setIsSubmitting(true);
    setLoginAttempted(true);
    try {
      console.log('[LoginForm] Attempting login with email:', form.email);
      await login({ email: form.email, password: form.password, rememberMe: form.rememberMe });
      console.log('[LoginForm] Login successful - setting success flag');
      
      // Mark login as successful BEFORE setting any callbacks
      isSuccessfulLoginRef.current = true;
      
      setFeedback({ open: true, title: 'Login Successful', message: 'Welcome back!', status: 'success' });
      
      // Only set navigation timeout after successful login AND with success flag set
      navigationTimeoutRef.current = setTimeout(() => {
        console.log('[LoginForm] Navigation timeout fired, checking success flag:', isSuccessfulLoginRef.current);
        if (isSuccessfulLoginRef.current) {
          console.log('[LoginForm] Success flag is true, proceeding with navigation');
          navigate('/dashboard');
          console.log('[LoginForm] Calling onLoginSuccess callback');
          if (onLoginSuccess) {
            onLoginSuccess();
          }
        } else {
          console.warn('[LoginForm] Success flag is false, NOT navigating!');
        }
      }, 1000);
    } catch (error: any) {
      console.error('[LoginForm] Login error caught - setting success flag to false');
      isSuccessfulLoginRef.current = false;
      
      console.error('[LoginForm] Login error:', error);
      console.error('[LoginForm] Error details:', {
        message: error?.message,
        response: error?.response,
        code: error?.code,
        status: error?.status,
      });
      
      let message = ERROR_MESSAGES.InvalidCredentials;
      const code = error?.code || error?.response?.code;
      if (code === 'InvalidCredentials') message = ERROR_MESSAGES.InvalidCredentials;
      else if (error?.response?.message) message = error.response.message;
      else if (error?.message) message = error.message;
      
      console.log('[LoginForm] Setting error message:', message);
      
      // Set inline error message
      setErrors({ 
        general: 'Invalid email or password. Please check your credentials and try again.'
      });
      setErrorAnnouncement(message);
      setFeedback({ open: true, title: 'Login Failed', message, status: 'error' });
      
      // Clear password field for security, but keep email
      setForm(prev => ({ ...prev, password: '' }));
      console.log('[LoginForm] Form state after error, email preserved:', form.email);
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
      {errors.general && loginAttempted && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4" role="alert">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
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
        open={feedback.open && feedback.status === 'success'}
        title={feedback.title}
        message={feedback.message}
        status={feedback.status}
        onClose={() => setFeedback(prev => ({ ...prev, open: false }))}
        autoCloseMs={feedback.status === 'success' ? 1000 : undefined}
      />
    </form>
  );
};
