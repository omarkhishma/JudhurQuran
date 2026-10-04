import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end journeys against a running site with a loaded dataset (dev server by default).
 *   E2E_BASE_URL=http://localhost:3210 pnpm e2e
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  workers: 4,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3210",
    trace: "retain-on-failure",
    // the offline worker answers a page's requests once it controls it, and Playwright's routes do not see what a
    // worker answers: it is blocked here, and allowed by the spec that tests it (offline.spec.ts)
    serviceWorkers: "block",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "phone", use: { ...devices["Pixel 7"] } },
  ],
});
