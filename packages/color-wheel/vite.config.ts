import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

// Two passes of `vite build` (docs/05 §8.2):
// - by default, the ESM module for npm, without culori or spectral.js;
// - with `--mode umd`, the file for `<script src>`, with everything bundled.
export default defineConfig(({ mode }) => {
  const umd = mode === "umd";

  return {
    build: {
      lib: {
        entry: "src/index.ts",
        name: "ColorWheel",
        formats: [umd ? "umd" : "es"],
        fileName: () => (umd ? "color-wheel.umd.js" : "color-wheel.js"),
      },
      // The second pass does not delete what the first one left.
      emptyOutDir: !umd,
      rolldownOptions: {
        external: umd ? [] : ["culori/fn", "spectral.js"],
      },
    },
    test: {
      projects: [
        {
          test: {
            name: "node",
            include: ["src/**/*.test.ts"],
            exclude: ["src/**/*.browser.test.ts"],
            environment: "node",
          },
        },
        {
          test: {
            name: "browser",
            include: ["src/**/*.browser.test.ts"],
            browser: {
              enabled: true,
              provider: playwright(),
              headless: true,
              instances: [{ browser: "chromium" }],
            },
          },
        },
      ],
    },
  };
});
