import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests (docs/07 §14) in the full Chromium:
 *
 * - `built`: the built site, served by `vite preview`; run `pnpm build`
 *   first. What only the build and the service worker can show.
 * - `dev`: the development server, which must render the pages like the
 *   build, styles included.
 */
export default defineConfig({
  testDir: "e2e",
  // The service worker and its caches are shared state: one test at a time.
  workers: 1,
  forbidOnly: process.env["CI"] !== undefined,
  reporter: process.env["CI"] === undefined ? "list" : "github",
  webServer: [
    {
      command: "pnpm exec vite preview --port 4173 --strictPort",
      url: "http://localhost:4173/",
      reuseExistingServer: process.env["CI"] === undefined,
    },
    {
      command: "pnpm exec vite --port 5174 --strictPort",
      url: "http://localhost:5174/",
      reuseExistingServer: process.env["CI"] === undefined,
    },
  ],
  projects: [
    {
      name: "built",
      testIgnore: "dev.spec.ts",
      use: {
        ...devices["Desktop Chrome"],
        channel: "chromium",
        baseURL: "http://localhost:4173",
      },
    },
    {
      name: "dev",
      testMatch: "dev.spec.ts",
      use: {
        ...devices["Desktop Chrome"],
        channel: "chromium",
        baseURL: "http://localhost:5174",
      },
    },
  ],
});
