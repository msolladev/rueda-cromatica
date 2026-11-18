/**
 * The prerendering (docs/07 §10) as a Vite plugin:
 *
 * - In the build, after the browser bundle is written and before the service
 *   worker is generated, it builds `src/entry-server.tsx` for Node, renders
 *   every page to `dist/<path>/index.html`, and writes `sitemap.xml` and
 *   `robots.txt`. The service worker then precaches every page.
 * - In development, it renders each page on request with the same code, so
 *   the browser always takes over a prerendered page.
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build, type Plugin, type ResolvedConfig } from "vite";
import { fillTemplate } from "./html.ts";
import { licenseCollector, type LicenseCollector } from "./licenses.ts";

type ServerEntry = typeof import("../src/entry-server.tsx");

export interface PrerenderOptions {
  /** The site's origin, without a final `/`, for absolute URLs. */
  readonly origin: string;
  /** Collects the licenses of the browser bundle. */
  readonly licenses: LicenseCollector;
}

const SERVER_ENTRY = "src/entry-server.tsx";

function sitemap(entry: ServerEntry, origin: string): string {
  const urls = entry.allPages().map((page) => {
    const alternates =
      page.kind === "languages"
        ? []
        : entry
            .allPages()
            .filter((other) => other.kind === page.kind)
            .map(
              (other) =>
                `    <xhtml:link rel="alternate" hreflang="${other.kind === "languages" ? "x-default" : other.locale}" href="${origin}${entry.pathOf(other)}"/>`,
            );
    return [
      `  <url>`,
      `    <loc>${origin}${entry.pathOf(page)}</loc>`,
      ...alternates,
      `  </url>`,
    ].join("\n");
  });
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">`,
    ...urls,
    `</urlset>`,
    "",
  ].join("\n");
}

/** The licenses of the service worker's code, built only to read its modules. */
async function serviceWorkerLicenses(
  root: string,
  collector: LicenseCollector,
) {
  await build({
    configFile: false,
    root,
    logLevel: "silent",
    plugins: [collector.plugin()],
    build: {
      write: false,
      emptyOutDir: false,
      rolldownOptions: { input: join(root, "src/sw.ts") },
    },
  });
}

export function prerender(options: PrerenderOptions): Plugin {
  let config: ResolvedConfig;
  return {
    name: "chromatic-wheel:prerender",
    configResolved(resolved) {
      config = resolved;
    },

    configureServer(server) {
      // Before Vite's own HTML middleware, which would serve index.html as is.
      server.middlewares.use((request, response, next) => {
        void (async () => {
          const url = new URL(request.url ?? "/", "http://localhost");
          // Pages end in `/`; anything else is an asset.
          if (!url.pathname.endsWith("/")) {
            next();
            return;
          }
          const entry = (await server.ssrLoadModule(
            `/${SERVER_ENTRY}`,
          )) as ServerEntry;
          const page = entry
            .allPages()
            .find((p) => entry.pathOf(p) === url.pathname);
          if (page === undefined) {
            next();
            return;
          }
          const catalog: unknown = JSON.parse(
            readFileSync(join(config.publicDir, "catalog.json"), "utf8"),
          );
          // In development the licenses are not collected: only the build
          // knows what is shipped.
          const render = entry.createRenderer({
            catalog,
            licenses: [],
            origin: options.origin,
          });
          const template = await server.transformIndexHtml(
            url.pathname,
            readFileSync(join(config.root, "index.html"), "utf8"),
          );
          response.setHeader("Content-Type", "text/html; charset=utf-8");
          response.end(fillTemplate(template, render(page), { csp: false }));
        })().catch(next);
      });
    },

    closeBundle: {
      order: "pre",
      sequential: true,
      async handler() {
        if (config.command !== "build" || config.build.ssr) return;
        const root = config.root;
        const outDir = resolve(root, config.build.outDir);
        const serverDir = resolve(root, "node_modules/.prerender");

        await build({
          configFile: config.configFile ?? false,
          mode: config.mode,
          logLevel: "warn",
          // Everything in one file: Node runs it from node_modules/.prerender,
          // where the dependencies of the workspace packages do not resolve.
          ssr: { noExternal: true },
          build: {
            ssr: SERVER_ENTRY,
            outDir: serverDir,
            emptyOutDir: true,
            copyPublicDir: false,
          },
        });
        await serviceWorkerLicenses(root, options.licenses);

        const entry = (await import(
          pathToFileURL(join(serverDir, "entry-server.js")).href
        )) as ServerEntry;
        const catalog: unknown = JSON.parse(
          readFileSync(join(outDir, "catalog.json"), "utf8"),
        );
        const render = entry.createRenderer({
          catalog,
          licenses: options.licenses.entries(),
          origin: options.origin,
        });
        const template = readFileSync(join(outDir, "index.html"), "utf8");

        for (const page of entry.allPages()) {
          const dir = join(outDir, entry.pathOf(page));
          mkdirSync(dir, { recursive: true });
          writeFileSync(
            join(dir, "index.html"),
            fillTemplate(template, render(page), { csp: true }),
          );
        }
        writeFileSync(
          join(outDir, "sitemap.xml"),
          sitemap(entry, options.origin),
        );
        writeFileSync(
          join(outDir, "robots.txt"),
          `User-agent: *\nAllow: /\n\nSitemap: ${options.origin}/sitemap.xml\n`,
        );
        rmSync(serverDir, { recursive: true, force: true });
      },
    },
  };
}

export { licenseCollector };
