import { useSyncExternalStore } from 'react';

/**
 * Landing image 1 behind every page (PandiO/knk-workspace#231), for a live comparison before the developer
 * decides. With it on, `data-page-bg="on"` on <html> turns the page backdrop, the cards and the auth backdrop
 * into translucent layers over the image (pageBackground.css; the alphas are per-theme tokens in tokens.css).
 *
 * Off by default, so players see no change. Which setting a tab uses, first match wins (like the theme):
 *  1. `?bg=on` / `?bg=off` in the URL (any page): this tab only, kept in sessionStorage.
 *  2. The toggle in the account menu, next to the theme picker (localStorage, every tab; staff only, or
 *     everyone with REACT_APP_THEME_PICKER=on).
 *  3. REACT_APP_PAGE_BACKGROUND=on at build time turns it on by default; otherwise off.
 * Storage can be blocked (private windows, cleared site data): every access is wrapped in try/catch.
 */
export type PageBackgroundSetting = 'on' | 'off';

export const PAGE_BACKGROUND_STORAGE_KEY = 'knk.pageBackground';
export const PAGE_BACKGROUND_QUERY_PARAM = 'bg';
export const PAGE_BACKGROUND_ATTRIBUTE = 'data-page-bg';

/** The compressed copies of public/images/1.jpg (1920 px wide): AVIF where the browser takes it, else WebP. */
export const PAGE_BACKGROUND_IMAGES = {
  avif: `${process.env.PUBLIC_URL ?? ''}/images/1-1920.avif`,
  webp: `${process.env.PUBLIC_URL ?? ''}/images/1-1920.webp`,
};

export function defaultPageBackground(flag: string | undefined = process.env.REACT_APP_PAGE_BACKGROUND): PageBackgroundSetting {
  return flag === 'on' ? 'on' : 'off';
}

function isSetting(value: unknown): value is PageBackgroundSetting {
  return value === 'on' || value === 'off';
}

function read(storage: () => Storage): string | null {
  try {
    return storage().getItem(PAGE_BACKGROUND_STORAGE_KEY);
  } catch {
    return null;
  }
}

function write(storage: () => Storage, value: PageBackgroundSetting) {
  try {
    storage().setItem(PAGE_BACKGROUND_STORAGE_KEY, value);
  } catch {
    // Not stored: the choice still applies until the tab is closed.
  }
}

const local = () => window.localStorage;
const session = () => window.sessionStorage;

/** The setting this tab should use (see the order above). A `?bg=` value is remembered for the tab. */
export function resolveInitialPageBackground(search: string = window.location.search): PageBackgroundSetting {
  let fromUrl: string | null = null;
  try {
    fromUrl = new URLSearchParams(search).get(PAGE_BACKGROUND_QUERY_PARAM);
  } catch {
    fromUrl = null;
  }
  if (isSetting(fromUrl)) {
    write(session, fromUrl);
    return fromUrl;
  }
  const fromTab = read(session);
  if (isSetting(fromTab)) return fromTab;
  const saved = read(local);
  return isSetting(saved) ? saved : defaultPageBackground();
}

let active: PageBackgroundSetting = 'off';
const listeners = new Set<() => void>();

/** Sets the attribute that pageBackground.css switches on. */
export function applyPageBackground(setting: PageBackgroundSetting) {
  active = setting;
  document.documentElement.setAttribute(PAGE_BACKGROUND_ATTRIBUTE, setting);
  listeners.forEach(listener => listener());
}

/** The toggle's choice: applies it now and remembers it for every tab (and for this tab over `?bg=`). */
export function selectPageBackground(setting: PageBackgroundSetting) {
  write(local, setting);
  write(session, setting);
  applyPageBackground(setting);
}

export function getPageBackground(): PageBackgroundSetting {
  return active;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The current setting, re-rendering when it changes. */
export function usePageBackground(): PageBackgroundSetting {
  return useSyncExternalStore(subscribe, getPageBackground, getPageBackground);
}
