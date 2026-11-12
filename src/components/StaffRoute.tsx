import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, WifiOff } from 'lucide-react';
import { ProtectedRoute } from './ProtectedRoute';
import { anyNodeStatus, PermissionStatus, STAFF_PERMISSION_NODE, usePermission, usePermissions } from '../hooks/useStaffAccess';
import { handleSessionExpired } from '../services/sessionRefresh';

/**
 * A logged-in route that only staff (STAFF_PERMISSION_NODE, or the given `node`) may open - the
 * web moderation and staff configuration pages. Everyone else gets a short "staff only" notice
 * instead of the page; the API refuses their requests as well, so this is about not showing a
 * broken page, not the security boundary. With `anyOf`, any one of the nodes opens it (PandiO/knk-workspace#280:
 * the dashboard for any area node).
 */
export const StaffRoute: React.FC<{ children: React.ReactNode; node?: string; anyOf?: readonly string[] }> = ({ children, node, anyOf }) => (
  <ProtectedRoute>
    {anyOf && anyOf.length > 0
      ? <StaffAnyGate nodes={anyOf}>{children}</StaffAnyGate>
      : <StaffGate node={node ?? STAFF_PERMISSION_NODE}>{children}</StaffGate>}
  </ProtectedRoute>
);

const StaffGate: React.FC<{ children: React.ReactNode; node: string }> = ({ children, node }) => {
  const { status, retry } = usePermission(node);
  return <GateView status={status} retry={retry} nodes={[node]}>{children}</GateView>;
};

const StaffAnyGate: React.FC<{ children: React.ReactNode; nodes: readonly string[] }> = ({ children, nodes }) => {
  const status = anyNodeStatus(usePermissions(nodes), nodes);
  // An error leaves the other answers cached; a reload asks again.
  return <GateView status={status} retry={() => window.location.reload()} nodes={nodes}>{children}</GateView>;
};

const GateView: React.FC<{ children: React.ReactNode; status: PermissionStatus; retry: () => void; nodes: readonly string[] }> = ({
  children, status, retry, nodes,
}) => {

  // An expired session isn't "staff only": end it and log in again, coming back here.
  if (status === 'checking' || status === 'unauthenticated') {
    return (
      <div className="flex items-center justify-center py-24" role="status" aria-label="Checking access">
        {status === 'unauthenticated' && <EndExpiredSession />}
        <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="max-w-md mx-auto mt-16 bg-white shadow-sm rounded-lg border border-gray-200 p-8 text-center" role="alert">
        <WifiOff className="h-10 w-10 mx-auto text-muted" aria-hidden="true" />
        <h1 className="mt-4 text-lg font-semibold text-gray-900">Couldn't check your access</h1>
        <p className="mt-2 text-sm text-gray-600">The server didn't answer. Check your connection and try again.</p>
        <button type="button" onClick={retry} className="mt-6 btn-primary">Try again</button>
      </div>
    );
  }

  if (status !== 'allowed') {
    return (
      <div className="max-w-md mx-auto mt-16 bg-white shadow-sm rounded-lg border border-gray-200 p-8 text-center">
        <ShieldAlert className="h-10 w-10 mx-auto text-amber-500" aria-hidden="true" />
        <h1 className="mt-4 text-lg font-semibold text-gray-900">Staff only</h1>
        {nodes.length === 1 ? (
          <p className="mt-2 text-sm text-gray-600">
            This page needs the <code className="text-xs bg-gray-100 px-1 rounded">{nodes[0]}</code> permission.
          </p>
        ) : (
          <p className="mt-2 text-sm text-muted">
            This page needs one of these permissions:{' '}
            {nodes.map((n, index) => (
              <React.Fragment key={n}>
                {index > 0 && ', '}
                <code className="text-xs bg-surface-alt px-1 rounded break-all">{n}</code>
              </React.Fragment>
            ))}
          </p>
        )}
        <Link to="/account" className="mt-6 inline-block text-sm font-medium text-primary hover:underline">Go to your account</Link>
      </div>
    );
  }

  return <>{children}</>;
};

/** Clears the stored session and goes to /auth/login?returnTo=<here>&reason=expired. */
const EndExpiredSession: React.FC = () => {
  useEffect(() => {
    handleSessionExpired();
  }, []);
  return null;
};
