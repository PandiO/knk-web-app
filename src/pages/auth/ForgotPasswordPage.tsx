import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { authService } from '../../services/authService';
import { validateEmailFormat } from '../../utils/passwordValidator';

export const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setDevResetUrl(null);

    if (!email.trim()) {
      setError('Email is required.');
      return;
    }

    if (!validateEmailFormat(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await authService.requestPasswordReset(email.trim());
      if (response?.debugResetUrl) {
        setDevResetUrl(response.debugResetUrl);
      }
      setSubmitted(true);
    } catch {
      // Keep response generic to avoid account enumeration leakage in UI.
      setSubmitted(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gray-50">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-6 sm:p-8 border border-gray-100">
        <div className="mb-6 text-center">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">Reset Password</h1>
          <p className="mt-2 text-base sm:text-lg text-gray-600">
            Enter your email and we will send reset instructions.
          </p>
        </div>

        {!submitted ? (
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div>
              <label htmlFor="forgot-email" className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                id="forgot-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 text-base border rounded-lg focus:outline-none focus:ring-2 border-gray-300 focus:ring-primary"
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </div>

            {error && (
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full px-4 py-2 text-base font-medium rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary ${
                isSubmitting ? 'bg-primary-light text-white opacity-60 cursor-not-allowed' : 'bg-primary text-white hover:bg-primary-dark'
              }`}
            >
              {isSubmitting ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-700 bg-green-50 border border-green-200 rounded-lg p-3">
              If an account with that email exists, reset instructions have been sent.
            </p>

            {devResetUrl && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-xs font-semibold text-yellow-800">Development Only</p>
                <p className="text-xs text-yellow-700 mt-1 break-all">{devResetUrl}</p>
              </div>
            )}
          </div>
        )}

        <div className="mt-6 text-center text-sm text-gray-600">
          <Link to="/auth/login" className="text-primary hover:text-primary-dark">
            Back to login
          </Link>
        </div>
      </div>
    </main>
  );
};
