import React from 'react';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { StaffRoute } from '../components/StaffRoute';
import { OwnerRoute } from '../components/OwnerRoute';
import type { RouteAccess } from './routeTable';

/**
 * Opens a page only for whom its route-meta entry allows (PandiO/knk-workspace#30): everyone, a login
 * (ProtectedRoute), a staff node or any of a list (StaffRoute: "Staff only" without it) or an owner node (OwnerRoute: exact
 * grants, D24). Display only: the API checks the same node on every call.
 */
export const RouteGate: React.FC<{ access: RouteAccess; children: React.ReactNode }> = ({ access, children }) => {
  switch (access.kind) {
    case 'login':
      return <ProtectedRoute>{children}</ProtectedRoute>;
    case 'staff':
      return <StaffRoute node={access.node}>{children}</StaffRoute>;
    case 'staffAny':
      return <StaffRoute anyOf={access.nodes}>{children}</StaffRoute>;
    case 'owner':
      return <OwnerRoute node={access.node}>{children}</OwnerRoute>;
    default:
      return <>{children}</>;
  }
};
