// Global configuration settings
export const appConfig = {
  // When true, uses test data instead of making API calls
  useTestData: false,
  
  // API configuration
  api: {
    // Must match the API's HTTPS listener: UseHttpsRedirection turns any http:// call
    // into a cross-origin 307, which kills CORS (Origin becomes null on redirect).
    baseUrl: 'https://localhost:7104/api',
    timeout: 15000, // 15 seconds
  }
} as const;

// Type-safe accessor for config values
export function getConfig<K extends keyof typeof appConfig>(key: K): typeof appConfig[K] {
  return appConfig[key];
}