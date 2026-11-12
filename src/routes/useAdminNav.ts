import { useMemo } from 'react';
import { usePermissions } from '../hooks/useStaffAccess';
import { ADMIN_GROUPS, ADMIN_NODES, AdminGroupId, RouteMeta, routeAllowed, SIDEBAR_ROUTES } from './routeTable';

export type AdminNavGroup = { id: AdminGroupId; label: string; items: RouteMeta[] };

/**
 * The admin pages the logged-in user may open, grouped (PandiO/knk-workspace#30): every sidebar page of the
 * route table whose node the user holds. Pages show once their check answered "allowed"; `checking` while
 * any answer is still out. The API enforces every node itself; this only decides what to show.
 */
export function useAdminNav(): { groups: AdminNavGroup[]; any: boolean; checking: boolean } {
  const statuses = usePermissions(ADMIN_NODES);
  return useMemo(() => {
    const allowed = (route: RouteMeta) => routeAllowed(route.access, statuses);
    const groups = ADMIN_GROUPS
      .map(group => ({ id: group.id, label: group.label, items: SIDEBAR_ROUTES.filter(r => r.group === group.id && allowed(r)) }))
      .filter(group => group.items.length > 0);
    const checking = Object.values(statuses).some(status => status === 'checking');
    return { groups, any: groups.length > 0, checking };
  }, [statuses]);
}
