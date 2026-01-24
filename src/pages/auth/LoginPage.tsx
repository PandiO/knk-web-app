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
    <div className="min-h-screen flex items-center justify-center py-12">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8 border border-gray-100">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-bold text-gray-900">Welcome Back</h1>
          <p className="mt-2 text-gray-600">Log in to continue your adventure.</p>
        </div>

        {error && (
          <div className="mb-4">
            <ErrorView content={error} color={ErrorColor.Red} />
          </div>
        )}

        <LoginForm onLoginSuccess={handleSuccess} />
      </div>
    </div>
  );
};
