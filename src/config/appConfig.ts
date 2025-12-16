// Global configuration settings
export const appConfig = {
  // When true, uses test data instead of making API calls
  useTestData: false,
  
  // API configuration
  api: {
    baseUrl: 'http://localhost:5294/api',
    timeout: 15000, // 15 seconds
  }
} as const;

// Type-safe accessor for config values
export function getConfig<K extends keyof typeof appConfig>(key: K): typeof appConfig[K] {
  return appConfig[key];
}