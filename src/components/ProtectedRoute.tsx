import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isLoggedIn, isLoading, refresh } = useAuth();
  const [attemptedRefresh, setAttemptedRefresh] = useState(false);
  const location = useLocation();

  useEffect(() => {
    // If not logged in and haven't tried refresh yet, attempt silent refresh once
    if (!isLoggedIn && !isLoading && !attemptedRefresh) {
      (async () => {
        await refresh();
        setAttemptedRefresh(true);
      })();
    }
  }, [isLoggedIn, isLoading, attemptedRefresh, refresh]);

  // Show loading state while checking auth or during refresh attempt
  if (isLoading || (!isLoggedIn && !attemptedRefresh)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // After refresh attempt, if still not logged in, redirect to login
  if (!isLoggedIn) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
