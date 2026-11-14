import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests (PandiO/knk-workspace#423): Playwright Test against the production build, served
 * by e2e/support/serve-build.mjs, with the API mocked per spec (e2e/support/mockApi.ts). Nothing
 * talks to a real API or database.
 *
 * `npm run test:e2e` builds first; `npx playwright test` reuses an existing `build/`.
 * PLAYWRIGHT_CHROMIUM_PATH points at a Chromium that is already installed (for example
 * /opt/pw-browsers/chromium in a cloud session) instead of `npx playwright install chromium`.
 */
const port = Number(process.env.E2E_PORT ?? 4173);
const baseURL = `http://127.0.0.1:${port}`;
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  outputDir: './test-results',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 30_000,
  expect: { timeout: 7_000 },
  reporter: process.env.CI
    ? [['list'], ['github'], ['html', { open: 'never', outputFolder: 'playwright-report' }]]
    : [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    viewport: { width: 1280, height: 720 },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 }, launchOptions: { executablePath } },
    },
  ],
  webServer: {
    command: 'node e2e/support/serve-build.mjs build',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    env: { E2E_PORT: String(port) },
    timeout: 30_000,
  },
});
