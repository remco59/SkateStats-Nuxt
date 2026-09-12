import { defineConfig, devices } from '@playwright/test'

/**
 * Phase 10 e2e smoke suite (REBUILD_PLAN.md Phase 10): login, manual add,
 * one import path, compare, export/import, admin last-admin-protection.
 * Runs against a real production build (webServer below), not `nuxt dev`,
 * since Phase 7/8 already found packaging bugs that only reproduced in a
 * production build. Uses the pre-installed Chromium
 * (PLAYWRIGHT_BROWSERS_PATH is set in this environment already).
 */
export default defineConfig({
  testDir: './test/e2e',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  globalSetup: './test/e2e/global-setup.ts',
  use: {
    baseURL: 'http://127.0.0.1:4010',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], launchOptions: { executablePath: '/opt/pw-browsers/chromium' } },
    },
  ],
  webServer: {
    command: 'node .output/server/index.mjs',
    url: 'http://127.0.0.1:4010/api/health',
    reuseExistingServer: false,
    timeout: 30_000,
    env: {
      PORT: '4010',
      NUXT_DB_PATH: './test/e2e/.tmp-e2e.db',
      SKATESTATS_DB: './test/e2e/.tmp-e2e.db',
      NUXT_SESSION_PASSWORD: 'e2e-test-session-password-32chars-min',
    },
  },
})
