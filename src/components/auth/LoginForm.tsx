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
      setFeedback({ open: true, title: 'Login Failed', message, status: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700">Email</label>
        <input
          type="email"
          value={form.email}
          onChange={e => updateField('email', e.target.value)}
          className={`mt-1 w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary ${errors.email ? 'border-red-400' : 'border-gray-300'}`}
          placeholder="you@example.com"
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? 'login-email-error' : undefined}
        />
        {errors.email && (
          <p id="login-email-error" className="mt-1 text-sm text-red-600">{errors.email}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Password</label>
        <div className="mt-1 relative">
          <input
            type={showPassword ? 'text' : 'password'}
            value={form.password}
            onChange={e => updateField('password', e.target.value)}
            className={`w-full px-3 py-2 border rounded-md pr-10 focus:outline-none focus:ring-2 focus:ring-primary ${errors.password ? 'border-red-400' : 'border-gray-300'}`}
            placeholder="••••••••"
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? 'login-password-error' : undefined}
          />
          <button
            type="button"
            onClick={() => setShowPassword(v => !v)}
            className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-500 hover:text-gray-700"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>
        {errors.password && (
          <p id="login-password-error" className="mt-1 text-sm text-red-600">{errors.password}</p>
        )}
      </div>

      <div className="flex items-center justify-between">
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.rememberMe}
            onChange={e => updateField('rememberMe', e.target.checked)}
            className="h-4 w-4 text-primary border-gray-300 rounded"
          />
          <span className="text-sm text-gray-700">Remember me (30 days)</span>
        </label>
        <a href="#" className="text-sm text-primary hover:text-primary-dark">Forgot password?</a>
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className={`w-full px-4 py-2 rounded-md font-medium transition-all ${
          isSubmitting ? 'bg-primary-light text-white opacity-60 cursor-not-allowed' : 'bg-primary text-white hover:bg-primary-dark'
        }`}
        aria-label="Log in"
      >
        {isSubmitting ? 'Logging in...' : 'Log In'}
      </button>

      <div className="text-center text-sm text-gray-600">
        <span>New here?</span>{' '}
        <a href="/auth/register" className="text-primary hover:text-primary-dark">Create an account</a>
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
