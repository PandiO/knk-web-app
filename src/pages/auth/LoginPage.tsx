import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LoginForm } from '../../components/auth/LoginForm';
import { useAuth } from '../../hooks/useAuth';
import { ErrorView } from '../../components/ErrorView';
import { ErrorColor } from '../../utils';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { isLoggedIn } = useAuth();
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (isLoggedIn) {
      navigate('/dashboard');
    }
  }, [isLoggedIn, navigate]);

  const handleSuccess = () => {
    navigate('/dashboard');
  };

  return (
    <main className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gray-50">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-6 sm:p-8 border border-gray-100">
        <div className="mb-6 text-center">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary rounded px-2 py-1">
            Welcome Back
          </h1>
          <p className="mt-2 text-base sm:text-lg text-gray-600">
            Log in to continue your adventure.
          </p>
        </div>

        {error && (
          <div className="mb-4">
            <ErrorView content={error} color={ErrorColor.Red} />
          </div>
        )}

        <LoginForm onLoginSuccess={handleSuccess} />

        {/* Accessibility help text */}
        <p className="mt-6 text-xs text-gray-500 text-center">
          This login form is keyboard accessible. Use Tab to navigate and Enter to submit.
        </p>
      </div>
    </main>
  );
};
