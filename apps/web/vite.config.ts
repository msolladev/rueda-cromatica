import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import {
  defaultClientConditions,
  defaultServerConditions,
  type Plugin,
} from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { execFileSync } from "node:child_process";
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
 * The commit the web is built from, and its date, for the version in the
 * footer (docs/07 §16). Empty if there is no git, as in a copy of the code
 * without its history.
 */
function commitOf(): { readonly hash: string; readonly date: string } {
  try {
    const [hash = "", date = ""] = execFileSync(
      "git",
      ["log", "-1", "--format=%H%n%cs"],
      { encoding: "utf8" },
    )
      .trim()
      .split("\n");
    return { hash, date };
  } catch {
    return { hash: "", date: "" };
  }
}

const COMMIT = commitOf();

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
    // Each page is its own HTML (docs/07 §12): no single-page fallback, so
    // that an unknown address is a 404 and not the root page.
    appType: "mpa",
    define: {
      "import.meta.env.VITE_COMMIT": JSON.stringify(COMMIT.hash),
      "import.meta.env.VITE_COMMIT_DATE": JSON.stringify(COMMIT.date),
    },
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
                // «Page not found» has no address of its own, and the service
                // worker never serves it.
                globIgnores: ["**/404.html"],
                // Each page is precached by its address (`es/`), not by its
                // file (`es/index.html`), which is not an address (docs/07
                // §12).
                manifestTransforms: [
                  (entries) => ({
                    manifest: entries.map((entry) => ({
                      ...entry,
                      url:
                        entry.url.replace(/(^|\/)index\.html$/, "$1") || "./",
                    })),
                  }),
                ],
              },
              // One manifest per language, written by the prerendering
              // (src/app/manifest.ts, docs/07 §8).
              manifest: false,
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
