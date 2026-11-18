import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import {
  defaultClientConditions,
  defaultServerConditions,
  type Plugin,
} from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "vitest/config";
import { licenseCollector } from "./build/licenses.ts";
import { prerender } from "./build/prerender.ts";

/**
 * The site's origin, for canonical URLs, language alternates, sharing
 * metadata and the sitemap (docs/07 §10). Each environment sets it when it
 * builds; without it, that of `vite preview`.
 */
const SITE_ORIGIN = (
  process.env["SITE_ORIGIN"] ?? "http://localhost:4173"
).replace(/\/$/, "");

/**
 * In the prerendering there is no service worker: the module that registers
 * it is only imported inside an effect, which never runs on the server.
 */
const noServiceWorker: Plugin = {
  name: "chromatic-wheel:no-service-worker",
  resolveId: (id) =>
    id === "virtual:pwa-register" ? "\0pwa-register-stub" : undefined,
  load: (id) =>
    id === "\0pwa-register-stub"
      ? "export const registerSW = () => () => Promise.resolve();"
      : undefined,
};

// The source of the workspace packages in development and tests, their
// dist/ in the build (docs/05 §8.2).
const SOURCE = "@chromatic-wheel/source";

export default defineConfig(({ command, isSsrBuild }) => {
  const fromSource = command === "serve";
  const licenses = licenseCollector();
  // Neither the prerendering nor the service worker take part in the tests.
  const app = isSsrBuild !== true && process.env["VITEST"] === undefined;

  return {
    resolve: {
      conditions: fromSource
        ? [SOURCE, ...defaultClientConditions]
        : [...defaultClientConditions],
    },
    ssr: {
      resolve: {
        conditions: fromSource
          ? [SOURCE, ...defaultServerConditions]
          : [...defaultServerConditions],
      },
    },
    plugins: [
      react(),
      ...(!app
        ? [noServiceWorker]
        : [
            licenses.plugin(),
            prerender({ origin: SITE_ORIGIN, licenses }),
            VitePWA({
              strategies: "injectManifest",
              srcDir: "src",
              filename: "sw.ts",
              // docs/07 §8: the page asks before updating.
              registerType: "prompt",
              injectRegister: false,
              // The prerendering writes the pages before the service worker
              // is generated, so that it precaches them.
              integration: { closeBundleOrder: "post" },
              injectManifest: {
                globPatterns: ["**/*.{js,css,html,json,svg,png,webmanifest}"],
              },
              manifest: {
                name: "Rueda cromática",
                short_name: "Rueda",
                description:
                  "Color wheel for painting miniatures, with the closest paints of each brand.",
                start_url: "/",
                scope: "/",
                display: "standalone",
                background_color: "#f6f7f9",
                theme_color: "#f6f7f9",
                icons: [
                  {
                    src: "/icons/icon-192.png",
                    sizes: "192x192",
                    type: "image/png",
                  },
                  {
                    src: "/icons/icon-512.png",
                    sizes: "512x512",
                    type: "image/png",
                  },
                  {
                    src: "/icons/icon-maskable-512.png",
                    sizes: "512x512",
                    type: "image/png",
                    purpose: "maskable",
                  },
                ],
              },
            }),
          ]),
    ],
    test: {
      projects: [
        {
          extends: true,
          test: {
            name: "node",
            include: ["src/**/*.test.ts", "build/**/*.test.ts"],
            environment: "node",
          },
        },
        {
          extends: true,
          test: {
            name: "browser",
            include: ["src/**/*.browser.test.tsx"],
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
