import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

// Dos pasadas de `vite build` (docs/05 §8.2):
// - por defecto, el módulo ESM para npm, sin culori ni spectral.js;
// - con `--mode umd`, el fichero para `<script src>`, con todo dentro.
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
      // La segunda pasada no borra lo que dejó la primera.
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
