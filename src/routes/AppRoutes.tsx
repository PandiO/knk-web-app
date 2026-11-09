import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { PublicLayout } from '../layouts/PublicLayout';
import { PlayerLayout } from '../layouts/PlayerLayout';
import { AdminLayout } from '../layouts/AdminLayout';
import { LayoutKind, REDIRECTS, ROUTE_LIST, RouteId } from './routeTable';
import { RouteGate } from './RouteGate';

/** The page of every route-meta entry (App.tsx). */
export type RouteElements = Record<RouteId, React.ReactNode>;

const LAYOUTS: Record<LayoutKind, React.ComponentType> = {
  public: PublicLayout,
  player: PlayerLayout,
  admin: AdminLayout,
};

/**
 * The app's routes, built from the route-meta table (PandiO/knk-workspace#30): three layout routes (public,
 * player, admin; each with its own error boundary, X-4), every page behind the gate its entry names, plus the
 * redirects of old URLs.
 */
export const AppRoutes: React.FC<{ elements: RouteElements }> = ({ elements }) => (
  <Routes>
    {(Object.keys(LAYOUTS) as LayoutKind[]).map(layout => {
      const Layout = LAYOUTS[layout];
      return (
        <Route key={layout} element={<Layout />}>
          {ROUTE_LIST.filter(route => route.layout === layout).map(route => (
            <Route
              key={route.id}
              path={route.path}
              element={<RouteGate access={route.access}>{elements[route.id as RouteId]}</RouteGate>}
            />
          ))}
          {layout === 'admin' && REDIRECTS.map(redirect => (
            <Route key={redirect.from} path={redirect.from} element={<Navigate to={redirect.to} replace />} />
          ))}
        </Route>
      );
    })}
  </Routes>
);
