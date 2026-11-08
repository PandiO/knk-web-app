import React from 'react';
import { Outlet } from 'react-router-dom';
import { RouteErrorBoundary } from '../components/ErrorBoundary';
import { PageFrame } from './PageFrame';
import { RouteTitle } from './RouteTitle';

/**
 * The player's own pages (PandiO/knk-workspace#30): account, Minecraft link, transactions. Its own error
 * boundary (X-4). The place for the player area's tabs (/me in the target IA) once there are more pages.
 */
export const PlayerLayout: React.FC = () => (
  <PageFrame>
    <RouteTitle />
    <RouteErrorBoundary>
      <Outlet />
    </RouteErrorBoundary>
  </PageFrame>
);
