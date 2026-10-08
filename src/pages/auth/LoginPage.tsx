import React from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Clock } from 'lucide-react';
import { LoginForm } from '../../components/auth/LoginForm';
import { useAuth } from '../../contexts/AuthContext';
import { CONTENT_PERMISSION_NODE, usePermission } from '../../hooks/useStaffAccess';
import { returnToFromState, sanitizeReturnTo } from '../../utils/returnTo';
import { usePageTitle } from '../../hooks/usePageTitle';

/**
 * Where a logged-in player goes: back to the page they came from (`?returnTo=` or ProtectedRoute's
 * `state.from`, same-origin paths only), otherwise the dashboard for content staff and the
 * account page for everyone else.
 */
export const LoginPage: React.FC = () => {
  usePageTitle('Log in');
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { isLoggedIn } = useAuth();
  const returnTo = sanitizeReturnTo(searchParams.get('returnTo')) ?? returnToFromState(location.state);
  const sessionExpired = searchParams.get('reason') === 'expired';
  // Only asked once someone is logged in (no user, no API call).
  const content = usePermission(CONTENT_PERMISSION_NODE);

  React.useEffect(() => {
    if (!isLoggedIn) return;
    if (returnTo) {
      navigate(returnTo, { replace: true });
      return;
    }
    if (content.isChecking) return;
    navigate(content.allowed ? '/dashboard' : '/account', { replace: true });
  }, [isLoggedIn, returnTo, content.isChecking, content.allowed, navigate]);

  return (
    <main className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gray-50">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-6 sm:p-8 border border-gray-100">
        <div className="mb-6 text-center">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">
            Welcome Back
          </h1>
          <p className="mt-2 text-base sm:text-lg text-gray-600">
            Log in to continue your adventure.
          </p>
        </div>

        {sessionExpired && (
          <div className="mb-6 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4" role="status">
            <Clock className="h-5 w-5 flex-shrink-0 text-amber-600" aria-hidden="true" />
            <p className="text-sm text-amber-900">
              Your session expired. Log in again to continue{returnTo ? ' where you left off' : ''}.
            </p>
          </div>
        )}

        <LoginForm />
      </div>
    </main>
  );
};
