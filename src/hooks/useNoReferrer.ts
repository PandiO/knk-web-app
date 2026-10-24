import { useEffect } from 'react';

/**
 * Sends no Referer from this page while it is open (DESIGN.md § 3.3 in knk-workspace: invite, reset
 * and link pages carry a secret in their URL). Adds <meta name="referrer" content="no-referrer"> and
 * removes it again on unmount.
 */
export function useNoReferrer(): void {
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'referrer';
    meta.content = 'no-referrer';
    document.head.appendChild(meta);
    return () => {
      meta.remove();
    };
  }, []);
}
