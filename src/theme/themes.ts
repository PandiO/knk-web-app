import { useSyncExternalStore } from 'react';

/**
 * Switchable themes for a live design comparison (PandiO/knk-workspace#95). A theme is a set of CSS
 * variables in tokens.css under :root[data-theme="…"]; switching only changes that attribute, so it is
 * instant and needs no reload.
 *
 * Which theme a tab shows, first match wins:
 *  1. `?theme=` in the URL (any page): only this tab, so two tabs can show two themes side by side.
 *     It is kept in sessionStorage, so it survives a reload and in-app navigation in that tab.
 *  2. The theme picked with the theme switcher (localStorage, every tab).
 *  3. `current`.
 * Storage can be blocked (private windows, cleared site data): every access is wrapped in try/catch.
 */
export type ThemeId = 'current' | 'brand' | 'brand-red' | 'proposal';

export type ThemeInfo = { id: ThemeId; label: string; description: string };

export const THEMES: ThemeInfo[] = [
  { id: 'current', label: 'Current', description: "Today's look, on the tokens" },
  { id: 'brand', label: 'Brand', description: 'Styleguide 2020: orange, black, a red accent, Lato; Enchanted Land on player pages' },
  { id: 'brand-red', label: 'Brand (red)', description: 'Brand with the brand red as primary, to compare with the orange' },
  { id: 'proposal', label: 'Proposal', description: 'Calm brand: charcoal, orange accents, red only for danger; Cinzel on player pages' },
];

export const DEFAULT_THEME: ThemeId = 'current';
export const THEME_STORAGE_KEY = 'knk.theme';
export const THEME_QUERY_PARAM = 'theme';

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && THEMES.some(theme => theme.id === value);
}

function read(storage: () => Storage): string | null {
  try {
    return storage().getItem(THEME_STORAGE_KEY);
  } catch {
    return null;
  }
}

function write(storage: () => Storage, value: string | null) {
  try {
    if (value === null) storage().removeItem(THEME_STORAGE_KEY);
    else storage().setItem(THEME_STORAGE_KEY, value);
  } catch {
    // Not stored: the choice still applies until the tab is closed.
  }
}

const local = () => window.localStorage;
const session = () => window.sessionStorage;

/** The theme this tab should show (see the order above). A `?theme=` value is remembered for the tab. */
export function resolveInitialTheme(search: string = window.location.search): ThemeId {
  let fromUrl: string | null = null;
  try {
    fromUrl = new URLSearchParams(search).get(THEME_QUERY_PARAM);
  } catch {
    fromUrl = null;
  }
  if (isThemeId(fromUrl)) {
    write(session, fromUrl);
    return fromUrl;
  }
  const fromTab = read(session);
  if (isThemeId(fromTab)) return fromTab;
  const saved = read(local);
  return isThemeId(saved) ? saved : DEFAULT_THEME;
}

let activeTheme: ThemeId = DEFAULT_THEME;
const listeners = new Set<() => void>();

/** Sets the attribute that tokens.css switches on. */
export function applyTheme(theme: ThemeId) {
  activeTheme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  listeners.forEach(listener => listener());
}

/** The picker's choice: applies it now and remembers it for every tab (and for this tab over `?theme=`). */
export function selectTheme(theme: ThemeId) {
  write(local, theme);
  write(session, theme);
  applyTheme(theme);
}

export function getActiveTheme(): ThemeId {
  return activeTheme;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The active theme, re-rendering when it changes. */
export function useActiveTheme(): ThemeId {
  return useSyncExternalStore(subscribe, getActiveTheme, getActiveTheme);
}

/**
 * The theme switcher (a cogwheel, src/theme/ThemeSwitcher.tsx) shows for every visitor, logged in or not
 * (developer request 2026-11-04). `REACT_APP_THEME_PICKER=off` hides it (the `?theme=` parameter still
 * works); any other value, or none, shows it.
 */
export function themePickerVisible(flag: string | undefined = process.env.REACT_APP_THEME_PICKER): boolean {
  return flag !== 'off';
}
