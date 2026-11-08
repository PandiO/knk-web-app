import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { matchRoute, RouteMeta } from './routeTable';

/** The route-meta table entry of the current URL (PandiO/knk-workspace#30), or null. */
export function useRouteMeta(): RouteMeta | null {
  const { pathname } = useLocation();
  return useMemo(() => matchRoute(pathname)?.route ?? null, [pathname]);
}
