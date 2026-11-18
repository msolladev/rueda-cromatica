import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests (docs/07 §14) against the built site, served by
 * `vite preview`: what only the build and the service worker can show. Run
 * `pnpm build` first.
 */
export default defineConfig({
  testDir: "e2e",
  // The service worker and its caches are shared state: one test at a time.
  workers: 1,
  forbidOnly: process.env["CI"] !== undefined,
  reporter: process.env["CI"] === undefined ? "list" : "github",
  use: { baseURL: "http://localhost:4173" },
  webServer: {
    command: "pnpm exec vite preview --port 4173 --strictPort",
    url: "http://localhost:4173/",
    reuseExistingServer: process.env["CI"] === undefined,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
