import React from 'react';
import { usePageTitle } from '../hooks/usePageTitle';
import { useRouteMeta } from '../routes/useRouteMeta';

/**
 * Sets `document.title` from the route-meta table (PandiO/knk-workspace#30). Rendered before the page, so a
 * page that knows more (the entity's name on the detail page) can still set its own with usePageTitle.
 */
export const RouteTitle: React.FC = () => {
  const route = useRouteMeta();
  usePageTitle(route?.title);
  return null;
};
