import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useAdminNav } from '../../routes/useAdminNav';

/**
 * /admin (PandiO/knk-workspace#30): every admin page the user's nodes allow, by sidebar group, with a line
 * on what each is for. The bar's Admin link opens it; a breadcrumb's group crumb links to its group here
 * (`/admin#admin-group-economy`). Staff holding only a currency or retention node find their page here too
 * (it used to be a button on Moderation only).
 */
export const AdminHomePage: React.FC = () => {
  const { groups, any, checking } = useAdminNav();
  const { hash } = useLocation();

  // A group crumb's link: scroll to that group once it is shown.
  useEffect(() => {
    if (!hash) return;
    const target = document.getElementById(decodeURIComponent(hash.slice(1)));
    target?.scrollIntoView?.({ block: 'start' });
  }, [hash, groups.length]);

  if (!any) {
    if (checking) {
      return (
        <div className="flex items-center justify-center py-24" role="status" aria-label="Checking access">
          <div className="inline-block h-10 w-10 animate-spin rounded-full border-b-2 border-primary"></div>
        </div>
      );
    }
    return (
      <div className="panel mx-auto mt-16 max-w-md p-8 text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-warning" aria-hidden="true" />
        <h1 className="mt-4 text-lg font-semibold text-fg">No admin pages</h1>
        <p className="mt-2 text-sm text-muted">Your account holds none of the staff permissions the admin pages need.</p>
        <Link to="/account" className="mt-6 inline-block text-sm font-medium text-primary hover:underline">Go to your account</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 py-6">
      <div>
        <h1 className="text-2xl font-bold text-fg">Admin</h1>
        <p className="mt-1 text-sm text-muted">The pages your permissions open, by area.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {groups.map(group => (
          <section
            key={group.id}
            id={`admin-group-${group.id}`}
            aria-labelledby={`admin-home-${group.id}`}
            className="panel scroll-mt-24 p-4"
          >
            <h2 id={`admin-home-${group.id}`} className="text-base font-semibold text-fg">{group.label}</h2>
            <ul className="mt-3 space-y-3">
              {group.items.map(item => {
                const Icon = item.sidebar!.icon;
                return (
                  <li key={item.id}>
                    <Link to={item.path} className="group flex items-start gap-3 rounded-md p-1 -m-1 hover:bg-surface-hover">
                      <Icon className="mt-0.5 h-5 w-5 flex-shrink-0 text-muted group-hover:text-primary" aria-hidden="true" />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-primary group-hover:underline">{item.title}</span>
                        <span className="block text-sm text-muted">{item.sidebar!.description}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
};

export default AdminHomePage;
