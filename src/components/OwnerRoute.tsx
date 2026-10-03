import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { ProtectedRoute } from './ProtectedRoute';
import { usePermission } from '../hooks/useStaffAccess';

/**
 * A logged-in route for owner-only pages (KNG-34 D12: diagnostics, GDPR deletion). The node is
 * checked for display only - the API requires an exact grant of it and answers 403 to wildcard
 * holders, so the pages also show {@link OwnerOnlyNotice} on a 403.
 */
export const OwnerRoute: React.FC<{ children: React.ReactNode; node: string }> = ({ children, node }) => (
  <ProtectedRoute>
    <OwnerGate node={node}>{children}</OwnerGate>
  </ProtectedRoute>
);

const OwnerGate: React.FC<{ children: React.ReactNode; node: string }> = ({ children, node }) => {
  const { allowed, isChecking } = usePermission(node);

  if (isChecking) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
      </div>
    );
  }
  return allowed ? <>{children}</> : <OwnerOnlyNotice node={node} />;
};

/** "Owner only": shown without the node, and when the API refuses (403) a wildcard holder. */
export const OwnerOnlyNotice: React.FC<{ node: string }> = ({ node }) => (
  <div className="max-w-md mx-auto mt-16 bg-white shadow-sm rounded-lg border border-gray-200 p-8 text-center" role="alert">
    <ShieldAlert className="h-10 w-10 mx-auto text-amber-500" />
    <h1 className="mt-4 text-lg font-semibold text-gray-900">Owner only</h1>
    <p className="mt-2 text-sm text-gray-600">
      This page needs an explicit grant of <code className="text-xs bg-gray-100 px-1 rounded">{node}</code> on your
      account. Wildcard grants such as <code className="text-xs bg-gray-100 px-1 rounded">knk.*</code> don't count.
    </p>
    <Link to="/" className="mt-6 inline-block text-sm font-medium text-primary hover:underline">Back to home</Link>
  </div>
);
