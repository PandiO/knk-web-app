import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { CLOUDFLARE_SESSION_MESSAGE, cloudflareSessionMissing } from '../services/cloudflareAccess';
import { reloadPage } from '../utils/navigation';

/**
 * The one app-wide message for a missing Cloudflare Access session (2026-10-25): shown above the
 * page when the service-call layer detected it, with the only fix — a full page load, so Cloudflare
 * can show its login and mail the one-time code. The app session stays; nothing retries on its own.
 */
export const CloudflareSessionBanner: React.FC = () => {
  const [missing, setMissing] = React.useState(false);

  React.useEffect(() => {
    const subscription = cloudflareSessionMissing.subscribe(value => setMissing(value));
    return () => subscription.unsubscribe();
  }, []);

  if (!missing) return null;

  return (
    <div
      role="alert"
      data-testid="cloudflare-session-banner"
      className="fixed inset-x-0 top-0 z-[110] flex flex-col items-start gap-3 border-b border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow sm:flex-row sm:items-center"
    >
      <ShieldAlert className="h-5 w-5 flex-shrink-0 text-amber-700" aria-hidden="true" />
      <p className="flex-1">
        {CLOUDFLARE_SESSION_MESSAGE} Cloudflare asks for your email and emails you a 6-digit code (sender: Cloudflare).
      </p>
      <button
        type="button"
        onClick={() => {
          cloudflareSessionMissing.next(false);
          reloadPage();
        }}
        className="rounded-lg bg-amber-700 px-4 py-2 font-medium text-white hover:bg-amber-800 focus:outline-none focus:ring-2 focus:ring-amber-700"
      >
        Sign in with Cloudflare
      </button>
    </div>
  );
};
