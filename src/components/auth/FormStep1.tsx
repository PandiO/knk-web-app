import React, { useState, useEffect } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { PasswordStrengthMeter } from './PasswordStrengthMeter';
import {
  validateEmailFormat,
  validatePasswordLength,
} from '../../utils/passwordValidator';
import { PASSWORD_MIN_LENGTH } from '../../utils/authConstants';

interface FormStep1Props {
  data: {
    email: string;
    password: string;
    confirmPassword: string;
  };
  errors: {
    email?: string;
    password?: string;
    confirmPassword?: string;
  };
  onChange: (field: string, value: string) => void;
  onError: (field: string, error: string | null) => void;
  onCheckEmail?: (email: string) => Promise<boolean>;
}

/**
 * Step 1 of registration: Email and password entry
 * Includes real-time validation and password strength meter
 */
export const FormStep1: React.FC<FormStep1Props> = ({
  data,
  errors,
  onChange,
  onError,
  onCheckEmail,
}) => {
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [emailAvailable, setEmailAvailable] = useState<boolean | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Validate email on blur
  const handleEmailBlur = async () => {
    if (!data.email.trim()) {
      onError('email', 'Email is required');
      setEmailAvailable(null);
      return;
    }

    if (!validateEmailFormat(data.email)) {
      onError('email', 'Please enter a valid email address (e.g., player@example.com)');
      setEmailAvailable(null);
      return;
    }

    if (onCheckEmail) {
      setIsCheckingEmail(true);
      try {
        const available = await onCheckEmail(data.email.trim());
        if (!available) {
          onError('email', 'Email already registered. Try logging in or use a different email.');
          setEmailAvailable(false);
          return;
        }
        setEmailAvailable(true);
      } catch (error) {
        console.error('Failed to check email availability:', error);
        onError('email', 'Unable to verify email. Please try again.');
        setEmailAvailable(null);
        return;
      } finally {
        setIsCheckingEmail(false);
      }
    }

    onError('email', null);
  };

  // Validate password on blur
  const handlePasswordBlur = () => {
    if (!data.password) {
      onError('password', 'Password is required');
      return;
    }

    if (!validatePasswordLength(data.password)) {
      onError(
        'password',
        `Password must be between ${PASSWORD_MIN_LENGTH} and 128 characters`
      );
      return;
    }

    onError('password', null);
  };

  // Validate confirm password whenever either password field changes
  useEffect(() => {
    if (data.confirmPassword && data.password !== data.confirmPassword) {
      onError('confirmPassword', 'Passwords do not match');
    } else {
      onError('confirmPassword', null);
    }
  }, [data.password, data.confirmPassword, onError]);

  return (
    <div className="space-y-6">
      {/* Email field */}
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
          Email Address *
        </label>
        <input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          data-testid="email"
          value={data.email}
          onChange={(e) => {
            onChange('email', e.target.value);
            setEmailAvailable(null);
          }}
          onBlur={handleEmailBlur}
          className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
            errors.email
              ? 'border-red-500 focus:ring-red-500'
              : emailAvailable
                ? 'border-green-500 focus:ring-green-500'
              : 'border-gray-300 focus:ring-primary'
          }`}
          placeholder="you@example.com"
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? 'email-error' : undefined}
        />
        {/* Status indicator */}
        {isCheckingEmail && (
          <div className="mt-2 text-xs text-gray-500">Checking availability...</div>
        )}
        {emailAvailable === true && !errors.email && (
          <div className="mt-2 text-xs text-green-600">Email is available</div>
        )}
        {errors.email && (
          <p id="email-error" className="mt-1 text-sm text-red-600" role="alert">
            {errors.email}
          </p>
        )}
      </div>

      {/* Password field */}
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
          Password *
        </label>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            data-testid="password"
            value={data.password}
            onChange={(e) => onChange('password', e.target.value)}
            onBlur={handlePasswordBlur}
            className={`w-full px-4 py-2 pr-10 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
              errors.password
                ? 'border-red-500 focus:ring-red-500'
                : 'border-gray-300 focus:ring-primary'
            }`}
            placeholder={`At least ${PASSWORD_MIN_LENGTH} characters`}
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? 'password-error' : undefined}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            tabIndex={-1}
          >
            {showPassword ? (
              <EyeOff className="h-5 w-5" />
            ) : (
              <Eye className="h-5 w-5" />
            )}
          </button>
        </div>
        {errors.password && (
          <p id="password-error" className="mt-1 text-sm text-red-600" role="alert">
            {errors.password}
          </p>
        )}
        {data.password && (
          <div className="mt-3">
            <PasswordStrengthMeter password={data.password} showFeedback={true} />
          </div>
        )}
      </div>

      {/* Confirm password field */}
      <div>
        <label
          htmlFor="confirmPassword"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          Confirm Password *
        </label>
        <div className="relative">
          <input
            id="confirmPassword"
            type={showConfirmPassword ? 'text' : 'password'}
            autoComplete="new-password"
            data-testid="confirm-password"
            value={data.confirmPassword}
            onChange={(e) => onChange('confirmPassword', e.target.value)}
            className={`w-full px-4 py-2 pr-10 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
              errors.confirmPassword
                ? 'border-red-500 focus:ring-red-500'
                : 'border-gray-300 focus:ring-primary'
            }`}
            placeholder="Re-enter your password"
            aria-invalid={!!errors.confirmPassword}
            aria-describedby={errors.confirmPassword ? 'confirm-password-error' : undefined}
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
            aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
            tabIndex={-1}
          >
            {showConfirmPassword ? (
              <EyeOff className="h-5 w-5" />
            ) : (
              <Eye className="h-5 w-5" />
            )}
          </button>
        </div>
        {errors.confirmPassword && (
          <p
            id="confirm-password-error"
            className="mt-1 text-sm text-red-600"
            role="alert"
          >
            {errors.confirmPassword}
          </p>
        )}
      </div>

      {/* Info box */}
      <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
        <p className="text-sm text-blue-900">
          <strong>Password tips:</strong> Use a mix of uppercase, lowercase, numbers, and symbols for a strong password. Length is more important than complexity.
        </p>
      </div>
    </div>
  );
};
