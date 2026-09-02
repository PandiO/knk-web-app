// Global configuration settings
export const appConfig = {
  // When true, uses test data instead of making API calls
  useTestData: false,
  
  // API configuration
  api: {
    // Match the active local backend listener. The app is running against the HTTP
    // profile while the HTTPS redirect is also configured, so the browser must not
    // call the redirected HTTPS URL directly in development.
    baseUrl: 'http://localhost:5294/api',
    timeout: 15000, // 15 seconds
  }
} as const;

// Type-safe accessor for config values
export function getConfig<K extends keyof typeof appConfig>(key: K): typeof appConfig[K] {
  return appConfig[key];
}