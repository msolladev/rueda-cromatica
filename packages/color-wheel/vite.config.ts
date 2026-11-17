import { readFileSync } from "node:fs";

import { playwright } from "@vitest/browser-playwright";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

/** Copies `style.css` to the ESM build, as is (docs/05 §6.9). */
function styleAsset(): Plugin {
  return {
    name: "color-wheel-style",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "style.css",
        source: readFileSync("src/ui/style.css", "utf8"),
      });
    },
  };
}

// Two passes of `vite build` (docs/05 §8.2):
// - by default, the ESM module for npm, without culori or spectral.js, and
//   `style.css`;
// - with `--mode umd`, the file for `<script src>`, with everything bundled.
// `vite --mode playground` serves the playground (docs/05 §8.4).
export default defineConfig(({ mode }) => {
  const umd = mode === "umd";

  return {
    ...(mode === "playground" ? { root: "playground" } : {}),
    plugins: umd ? [] : [styleAsset()],
    build: {
      lib: {
        entry: umd ? "src/index.umd.ts" : "src/index.ts",
        name: "ColorWheel",
        formats: [umd ? "umd" : "es"],
        fileName: () => (umd ? "color-wheel.umd.js" : "color-wheel.js"),
      },
      // The second pass does not delete what the first one left.
      emptyOutDir: !umd,
      rolldownOptions: {
        external: umd ? [] : ["culori/fn", "spectral.js"],
        // Keeps the license notices (`@license`), such as that of the copied
        // Lucide icon.
        output: { comments: { legal: true } },
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
              // A touch screen, for the touch tests.
              provider: playwright({ contextOptions: { hasTouch: true } }),
              headless: true,
              instances: [{ browser: "chromium" }],
            },
          },
        },
      ],
    },
  };
});
