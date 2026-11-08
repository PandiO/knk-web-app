import React from 'react';
import { Link } from 'react-router-dom';
import { AdminNavGroup } from '../../routes/useAdminNav';
import { isWithin, RouteMeta } from '../../routes/routeTable';

type Props = {
  groups: AdminNavGroup[];
  /** The current page's table entry: its link (or its breadcrumb parent's) is the current one. */
  current: RouteMeta | null;
  /** Used for the group headings' ids (the sidebar and the phone menu are on the page at once). */
  idPrefix: string;
  onNavigate?: () => void;
};

/**
 * The grouped admin pages (PandiO/knk-workspace#30): one heading per sidebar group, then its pages. Only
 * what the user's nodes allow is passed in (useAdminNav). A page below a sidebar page (a player profile under
 * Player moderation, Entity setup under Dashboard) lights up that page's link.
 */
export const AdminNavList: React.FC<Props> = ({ groups, current, idPrefix, onNavigate }) => (
  <div className="space-y-4">
    {groups.map(group => {
      const headingId = `${idPrefix}-${group.id}`;
      return (
        <div key={group.id} role="group" aria-labelledby={headingId}>
          <h2 id={headingId} className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted">
            {group.label}
          </h2>
          <ul className="space-y-0.5">
            {group.items.map(item => {
              const active = isWithin(current, item.id);
              const Icon = item.sidebar!.icon;
              return (
                <li key={item.id}>
                  <Link
                    to={item.path}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
                      active
                        ? 'bg-primary/10 font-medium text-primary'
                        : 'text-fg hover:bg-surface-hover'
                    }`}
                  >
                    <Icon className={`h-4 w-4 flex-shrink-0 ${active ? 'text-primary' : 'text-muted'}`} aria-hidden="true" />
                    <span className="min-w-0 truncate">{item.title}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      );
    })}
  </div>
);
