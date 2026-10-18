import { useEffect } from 'react';

export const SITE_NAME = 'Knights & Kings';

/** "Account · Knights & Kings", or just the site name without a page title. */
export function formatPageTitle(title?: string | null): string {
  const trimmed = title?.trim();
  return trimmed ? `${trimmed} · ${SITE_NAME}` : SITE_NAME;
}

/** Sets document.title while the page is shown; back to the site name when it unmounts. */
export function usePageTitle(title?: string | null): void {
  useEffect(() => {
    document.title = formatPageTitle(title);
    return () => {
      document.title = SITE_NAME;
    };
  }, [title]);
}
