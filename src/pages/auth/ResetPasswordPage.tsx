import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { PasswordStrengthMeter } from '../../components/auth/PasswordStrengthMeter';
import { validatePasswordPolicy } from '../../utils/passwordValidator';
import { authService } from '../../services/authService';

export const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const token = useMemo(() => searchParams.get('token')?.trim() ?? '', [searchParams]);
  const [newPassword, setNewPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!token) {
      setError('Reset token is missing. Please open the reset link from your email again.');
      return;
    }

    const policy = validatePasswordPolicy(newPassword);
    if (!policy.isValid) {
      setError(policy.message ?? 'Password does not meet security requirements.');
      return;
    }

    if (newPassword !== passwordConfirmation) {
      setError('Password and confirmation do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      await authService.resetPassword(token, newPassword, passwordConfirmation);
      setSuccess(true);
      setTimeout(() => navigate('/auth/login'), 1200);
    } catch (err: any) {
      const message = err?.response?.message || err?.message || 'Reset token is invalid or expired.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gray-50">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-6 sm:p-8 border border-gray-100">
        <div className="mb-6 text-center">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">Choose New Password</h1>
          <p className="mt-2 text-base sm:text-lg text-gray-600">
            Set a new password for your account.
          </p>
        </div>

        {success ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-700 bg-green-50 border border-green-200 rounded-lg p-3">
              Password reset successful. Redirecting to login...
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div>
              <label htmlFor="reset-password" className="block text-sm font-medium text-gray-700 mb-2">
                New password
              </label>
              <input
                id="reset-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-2 text-base border rounded-lg focus:outline-none focus:ring-2 border-gray-300 focus:ring-primary"
                autoComplete="new-password"
                required
              />
              <div className="mt-2">
                <PasswordStrengthMeter password={newPassword} showFeedback={true} />
              </div>
            </div>

            <div>
              <label htmlFor="reset-confirm" className="block text-sm font-medium text-gray-700 mb-2">
                Confirm new password
              </label>
              <input
                id="reset-confirm"
                type="password"
                value={passwordConfirmation}
                onChange={(e) => setPasswordConfirmation(e.target.value)}
                className="w-full px-4 py-2 text-base border rounded-lg focus:outline-none focus:ring-2 border-gray-300 focus:ring-primary"
                autoComplete="new-password"
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
              {isSubmitting ? 'Resetting...' : 'Reset Password'}
            </button>
          </form>
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
