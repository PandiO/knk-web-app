import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { ProtectedRoute } from './ProtectedRoute';
import { STAFF_PERMISSION_NODE, usePermission } from '../hooks/useStaffAccess';

/**
 * A logged-in route that only staff (STAFF_PERMISSION_NODE, or the given `node`) may open - the
 * web moderation and staff configuration pages. Everyone else gets a short "staff only" notice
 * instead of the page; the API refuses their requests as well, so this is about not showing a
 * broken page, not the security boundary.
 */
export const StaffRoute: React.FC<{ children: React.ReactNode; node?: string }> = ({ children, node }) => (
  <ProtectedRoute>
    <StaffGate node={node ?? STAFF_PERMISSION_NODE}>{children}</StaffGate>
  </ProtectedRoute>
);

const StaffGate: React.FC<{ children: React.ReactNode; node: string }> = ({ children, node }) => {
  const { allowed: isStaff, isChecking } = usePermission(node);

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
          This page needs the <code className="text-xs bg-gray-100 px-1 rounded">{node}</code> permission.
        </p>
        <Link to="/" className="mt-6 inline-block text-sm font-medium text-primary hover:underline">Back to home</Link>
      </div>
    );
  }

  return <>{children}</>;
};
