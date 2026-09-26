import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { ProtectedRoute } from './ProtectedRoute';
import { STAFF_PERMISSION_NODE, useStaffAccess } from '../hooks/useStaffAccess';

/**
 * A logged-in route that only staff (STAFF_PERMISSION_NODE) may open - the web moderation pages.
 * Everyone else gets a short "staff only" notice instead of the page; the API refuses their
 * requests as well, so this is about not showing a broken page, not the security boundary.
 */
export const StaffRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ProtectedRoute>
    <StaffGate>{children}</StaffGate>
  </ProtectedRoute>
);

const StaffGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isStaff, isChecking } = useStaffAccess();

  if (isChecking) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isStaff) {
    return (
      <div className="max-w-md mx-auto mt-16 bg-white shadow-sm rounded-lg border border-gray-200 p-8 text-center">
        <ShieldAlert className="h-10 w-10 mx-auto text-amber-500" />
        <h1 className="mt-4 text-lg font-semibold text-gray-900">Staff only</h1>
        <p className="mt-2 text-sm text-gray-600">
          This page needs the <code className="text-xs bg-gray-100 px-1 rounded">{STAFF_PERMISSION_NODE}</code> permission.
        </p>
        <Link to="/" className="mt-6 inline-block text-sm font-medium text-primary hover:underline">Back to home</Link>
      </div>
    );
  }

  return <>{children}</>;
};
