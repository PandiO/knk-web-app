import { useEffect } from 'react';

/**
 * Marks the page as player-facing while it is mounted: `data-surface="public"` on <html> (#95, #92).
 *
 * Developer decision 2026-11-03 (live comparison of the themes): the decorative heading font
 * (`--font-display`: Enchanted Land in `brand`, Cinzel in `proposal`) is for player-facing pages only;
 * manager and admin pages (dashboard, entity detail, form wizard, admin pages, the nav title) keep Lato.
 * That split is the project's own rule: the 2020 brand guide just names Enchanted Land as the heading font.
 * index.css keys the h1 font off this attribute.
 *
 * Call it once in every player-facing page: landing, the auth pages, leaderboards, the public player
 * profile, siege match pages, the player's own account pages, the data-deletion confirmation, 404.
 */
export const PUBLIC_SURFACE_ATTRIBUTE = 'data-surface';

export function usePublicSurface() {
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute(PUBLIC_SURFACE_ATTRIBUTE, 'public');
    return () => root.removeAttribute(PUBLIC_SURFACE_ATTRIBUTE);
  }, []);
}
