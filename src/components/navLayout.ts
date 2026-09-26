// How the left half of the navigation bar is laid out, from roomiest to tightest. The
// static "Dashboard" title is the first thing to go: the link labels matter more.
export type NavLayout = 'labels+title' | 'labels' | 'icons+title' | 'icons' | 'menu';

// Natural (unwrapped) widths, in px, of the pieces that can sit left of the account button.
export type NavWidths = { logo: number; title: number; labels: number; icons: number };

// Matches the gap-4 between the pieces in the left half of the bar.
export const NAV_GAP = 16;

// Picks the roomiest layout that fits in `available` px. Breakpoints can't do this: the
// room the links need depends on display scaling, browser zoom, font loading and whether
// the staff-only link is shown, so a fixed 2xl cut-off hid the labels on many wide screens.
export function pickNavLayout(available: number, w: NavWidths): NavLayout {
  const fits = (...parts: number[]) =>
    parts.reduce((sum, part) => sum + part, 0) + NAV_GAP * (parts.length - 1) <= available;
  if (fits(w.logo, w.title, w.labels)) return 'labels+title';
  if (fits(w.logo, w.labels)) return 'labels';
  if (fits(w.logo, w.title, w.icons)) return 'icons+title';
  if (fits(w.logo, w.icons)) return 'icons';
  return 'menu';
}
