// Global configuration settings.
//
// Build-time settings come from REACT_APP_* environment variables (CRA inlines them when the bundle
// is built, so changing one needs a rebuild). See README.md, "Configuration".

/** Development talks to the API's local HTTP listener; a production build expects the API on the same origin. */
const DEFAULT_API_BASE_URL = process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:5294/api';
const DEFAULT_MC_SERVER_ADDRESS = 'play.knightsandkings.net';

/** The configured value, or the fallback when it's unset or blank. A trailing slash is dropped. */
export function readSetting(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return (trimmed ? trimmed : fallback).replace(/\/+$/, '');
}

export const appConfig = {
  // When true, uses test data instead of making API calls
  useTestData: false,

  // API configuration
  api: {
    // REACT_APP_API_BASE_URL, e.g. `/api` behind the same-origin proxy or
    // `http://localhost:5294/api` for the local API's HTTP profile.
    baseUrl: readSetting(process.env.REACT_APP_API_BASE_URL, DEFAULT_API_BASE_URL),
    timeout: 15000, // 15 seconds
  },

  // The Minecraft server players join (REACT_APP_MC_SERVER_ADDRESS); shown on the landing and
  // register pages.
  minecraft: {
    serverAddress: readSetting(process.env.REACT_APP_MC_SERVER_ADDRESS, DEFAULT_MC_SERVER_ADDRESS),
  },
} as const;

// Type-safe accessor for config values
export function getConfig<K extends keyof typeof appConfig>(key: K): typeof appConfig[K] {
  return appConfig[key];
}
