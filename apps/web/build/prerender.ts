/**
 * The prerendering (docs/07 §10) as a Vite plugin:
 *
 * - In the build, after the browser bundle is written and before the service
 *   worker is generated, it builds `src/entry-server.tsx` for Node, renders
 *   every page to `dist/<path>/index.html`, «Page not found» to
 *   `dist/404.html` and `dist/<locale>/404.html`, and writes `sitemap.xml`
 *   and `robots.txt`. The service worker then precaches every page.
 * - In development, it renders each page on request with the same code, so
 *   the browser always takes over a prerendered page; an unknown address
 *   gets «Page not found» with the status 404, and the sitemap and
 *   robots.txt are served as in the build.
 * - In `vite preview`, an unknown address gets the built «Page not found»
 *   with the status 404, as the static server will.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  build,
  type Plugin,
  type ResolvedConfig,
  type ViteDevServer,
} from "vite";
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
const CLIENT_ENTRY = "/src/entry-client.tsx";

/**
 * The stylesheets that the browser code imports, as `<link>` tags. In
 * development Vite adds them from JavaScript, after the page is shown, so the
 * prerendered HTML would show for a moment without styles; in the build they
 * are already `<link>` tags in the `<head>`.
 */
async function devStylesheets(server: ViteDevServer): Promise<string> {
  const client = server.environments.client;
  const seen = new Set<string>();
  const sheets: string[] = [];
  const visit = async (url: string): Promise<void> => {
    if (seen.has(url)) return;
    seen.add(url);
    await client.transformRequest(url);
    const module = await client.moduleGraph.getModuleByUrl(url);
    if (module === undefined) return;
    if (/\.css($|\?)/.test(module.url)) sheets.push(module.url);
    for (const imported of module.importedModules) await visit(imported.url);
  };
  await visit(CLIENT_ENTRY);
  return sheets
    .map(
      (url) =>
        `<link rel="stylesheet" href="${url}${url.includes("?") ? "&" : "?"}direct" />`,
    )
    .join("\n    ");
}

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

function robots(origin: string): string {
  return `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`;
}

/**
 * Whether an address asks for a page: it ends in `/` or its last segment has
 * no extension. Vite's own addresses (`/@vite/client`, `/@fs/…`,
 * `/node_modules/…`) and the files are not pages.
 */
function isPageAddress(pathname: string): boolean {
  if (/^\/(@|__|node_modules\/)/.test(pathname)) return false;
  const last = pathname.split("/").pop() ?? "";
  return pathname.endsWith("/") || !last.includes(".");
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
          const { pathname } = url;
          const isListing =
            pathname === "/sitemap.xml" || pathname === "/robots.txt";
          // Vite's own addresses and the files go on as always.
          if (!isListing && !isPageAddress(pathname)) {
            next();
            return;
          }
          const entry = (await server.ssrLoadModule(
            `/${SERVER_ENTRY}`,
          )) as ServerEntry;
          // The same sitemap and robots.txt as the build.
          if (isListing) {
            response.setHeader(
              "Content-Type",
              pathname === "/sitemap.xml"
                ? "application/xml; charset=utf-8"
                : "text/plain; charset=utf-8",
            );
            response.end(
              pathname === "/sitemap.xml"
                ? sitemap(entry, options.origin)
                : robots(options.origin),
            );
            return;
          }
          const known = entry
            .allPages()
            .find((p) => entry.pathOf(p) === pathname);
          // Any other address: «Page not found», with its status.
          const page = known ?? entry.notFoundAt(pathname);
          if (known === undefined) response.statusCode = 404;
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
          const template = (
            await server.transformIndexHtml(
              url.pathname,
              readFileSync(join(config.root, "index.html"), "utf8"),
            )
          ).replace("</head>", `${await devStylesheets(server)}\n  </head>`);
          response.setHeader("Content-Type", "text/html; charset=utf-8");
          response.end(fillTemplate(template, render(page), { csp: false }));
        })().catch(next);
      });
    },

    // `vite preview` answers like the static server will (docs/07 §12): an
    // unknown address gets «Page not found» in its language, with the status
    // 404.
    configurePreviewServer(server) {
      return () => {
        server.middlewares.use((request, response, next) => {
          const url = new URL(request.url ?? "/", "http://localhost");
          if (!isPageAddress(url.pathname)) {
            next();
            return;
          }
          const first = url.pathname.split("/").find((part) => part !== "");
          const outDir = resolve(config.root, config.build.outDir);
          const localized = join(outDir, first ?? "", "404.html");
          const file =
            first !== undefined && existsSync(localized)
              ? localized
              : join(outDir, "404.html");
          response.statusCode = 404;
          response.setHeader("Content-Type", "text/html; charset=utf-8");
          response.end(readFileSync(file));
        });
      };
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
        for (const { file, page } of entry.notFoundFiles()) {
          writeFileSync(
            join(outDir, file),
            fillTemplate(template, render(page), { csp: true }),
          );
        }
        writeFileSync(
          join(outDir, "sitemap.xml"),
          sitemap(entry, options.origin),
        );
        writeFileSync(join(outDir, "robots.txt"), robots(options.origin));
        rmSync(serverDir, { recursive: true, force: true });
      },
    },
  };
}

export { licenseCollector };
