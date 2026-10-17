import { defineConfig, devices } from "@playwright/test";

const port = process.env.E2E_PORT ?? "3200";

/**
 * End-to-end tests in a real browser at phone width. `npm run e2e` expects a
 * production build (`npm run build`). Locally, set PW_CHANNEL=msedge (or chrome)
 * to use an installed browser instead of downloading Playwright's Chromium.
 */
export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${port}`,
    ...devices["Pixel 5"],
    viewport: { width: 360, height: 780 },
    channel: process.env.PW_CHANNEL,
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node scripts/e2e-server.mjs",
    url: `http://localhost:${port}/sign-in`,
    timeout: 180_000,
    reuseExistingServer: false,
  },
});
