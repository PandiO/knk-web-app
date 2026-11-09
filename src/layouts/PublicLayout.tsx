import React from 'react';
import { Outlet } from 'react-router-dom';
import { RouteErrorBoundary } from '../components/ErrorBoundary';
import { PageFrame } from './PageFrame';
import { RouteTitle } from './RouteTitle';

/**
 * The public site (PandiO/knk-workspace#30): landing, sign-in pages, leaderboards, guides, public profiles,
 * 404. Its own error boundary (X-4): a crash here leaves the rest of the app working.
 */
export const PublicLayout: React.FC = () => (
  <PageFrame>
    <RouteTitle />
    <RouteErrorBoundary>
      <Outlet />
    </RouteErrorBoundary>
  </PageFrame>
);
