import { defineConfig, devices } from '@playwright/test';

const PORT = 5288;

export default defineConfig({
  testDir: 'e2e',
  // playing through a whole chapter takes a while
  timeout: 90_000,
  fullyParallel: true,
  // each test plays through chapters in its own browser; more workers make the dev server the bottleneck
  workers: 2,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    // the app picks its language from the browser; the tests check German texts
    locale: 'de-DE',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
