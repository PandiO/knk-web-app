import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { RouteErrorBoundary } from '../components/ErrorBoundary';
import { Breadcrumbs, BreadcrumbPrefixContext } from '../components/Breadcrumbs';
import { AdminNavList } from '../components/admin/AdminNavList';
import { useAdminNav } from '../routes/useAdminNav';
import { useRouteMeta } from '../routes/useRouteMeta';
import { groupCrumb, trailFor } from '../routes/routeTable';
import { PageFrame } from './PageFrame';
import { RouteTitle } from './RouteTitle';

/**
 * The admin console (PandiO/knk-workspace#30): the grouped sidebar (from xl; a "Admin pages" menu button
 * below that), the breadcrumb trail from the route-meta table, and its own error boundary (X-4). The sidebar
 * lists only the pages the user's nodes allow.
 *
 * Pages whose entry says `breadcrumbs: 'page'` (an open form, the detail page) draw their own trail; the
 * layout gives it the group crumb through BreadcrumbPrefixContext.
 *
 * `--admin-chrome` is the height of the row above the page (menu button, trail): the dashboard and Entity
 * setup fill the window below it (ObjectDashboard.css).
 */
export const AdminLayout: React.FC = () => {
  const route = useRouteMeta();
  const adminNav = useAdminNav();
  // The /admin overview is the sidebar as a page: no sidebar or menu next to it.
  const nav = route?.id === 'adminHome' ? { ...adminNav, any: false } : adminNav;
  const trail = route?.breadcrumbs === 'page' ? [] : trailFor(route);
  const prefix = React.useMemo(() => groupCrumb(route), [route]);
  const chromeRef = useRef<HTMLDivElement>(null);
  const [chromeHeight, setChromeHeight] = useState(0);
  const showChrome = nav.any || trail.length > 0;

  useLayoutEffect(() => {
    const element = chromeRef.current;
    if (!element) {
      setChromeHeight(0);
      return;
    }
    const measure = () => {
      const height = element.offsetHeight;
      const margin = height > 0 ? parseFloat(window.getComputedStyle(element).marginBottom) || 0 : 0;
      setChromeHeight(height + margin);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [showChrome]);

  return (
    <PageFrame wide>
      <RouteTitle />
      <div className="xl:flex xl:items-start xl:gap-6">
        {nav.any && (
          <nav
            aria-label="Admin"
            className="sticky top-20 hidden max-h-[calc(100vh-6rem)] w-56 flex-none overflow-y-auto rounded-lg border border-line bg-surface/95 p-3 shadow-sm xl:block"
          >
            <AdminNavList groups={nav.groups} current={route} idPrefix="admin-sidebar" />
          </nav>
        )}
        <div className="min-w-0 flex-1" style={{ '--admin-chrome': `${chromeHeight}px` } as React.CSSProperties}>
          {showChrome && (
            <div
              ref={chromeRef}
              className={`mb-4 flex flex-col items-start gap-2 sm:flex-row sm:gap-3 ${trail.length > 0 ? '' : 'xl:hidden'}`}
            >
              {nav.any && <AdminMenu nav={nav} route={route} />}
              {trail.length > 0 && <Breadcrumbs trail={trail} className="min-w-0 sm:py-1.5" />}
            </div>
          )}
          <BreadcrumbPrefixContext.Provider value={prefix}>
            <RouteErrorBoundary>
              <Outlet />
            </RouteErrorBoundary>
          </BreadcrumbPrefixContext.Provider>
        </div>
      </div>
    </PageFrame>
  );
};

/** Below xl: the sidebar's list behind a button (closes on a choice, Escape or a click outside). */
const AdminMenu: React.FC<{ nav: ReturnType<typeof useAdminNav>; route: ReturnType<typeof useRouteMeta> }> = ({ nav, route }) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { pathname } = useLocation();

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative flex-shrink-0 xl:hidden">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(value => !value)}
        aria-expanded={open}
        aria-controls="admin-menu-panel"
        className="btn-secondary px-3 py-1.5 text-sm"
      >
        {open ? <X className="h-4 w-4" aria-hidden="true" /> : <Menu className="h-4 w-4" aria-hidden="true" />}
        Admin pages
      </button>
      {open && (
        <nav
          id="admin-menu-panel"
          aria-label="Admin"
          className="absolute left-0 z-40 mt-2 max-h-[70vh] w-72 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-lg border border-line bg-surface p-3 shadow-lg"
        >
          <AdminNavList groups={nav.groups} current={route} idPrefix="admin-menu" onNavigate={() => setOpen(false)} />
        </nav>
      )}
    </div>
  );
};
