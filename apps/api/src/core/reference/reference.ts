/**
 * The API reference (docs/09 §5): the OpenAPI specification and Scalar's page
 * for it, in the API's own version. Scalar comes from its package, with its
 * version fixed, and never from a CDN.
 *
 * The page runs third-party code, so it is only served on the hosts of
 * `REFERENCE_HOSTS`, the web's: never on `apps/admin`'s, where it would share
 * the origin of the administrator's session. Elsewhere, its paths answer 404
 * like any unknown path.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { OpenAPIObject } from "@nestjs/swagger";
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Request } from "express";

/** Scalar's self-contained bundle. */
const SCALAR_BUNDLE = fileURLToPath(
  new URL(
    "browser/standalone.js",
    import.meta.resolve("@scalar/api-reference"),
  ),
);

// Without inline scripts, so that the page's policy only allows its own.
const PAGE = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <title>Chromatic Wheel API</title>
  </head>
  <body>
    <div id="app"></div>
    <script src="reference/standalone.js"></script>
    <script src="reference/init.js"></script>
  </body>
</html>
`;

// Without Scalar's fonts, telemetry, agent or developer tools: the page
// only talks to this API.
const INIT = `Scalar.createApiReference("#app", ${JSON.stringify({
  url: "openapi.json",
  withDefaultFonts: false,
  telemetry: false,
  agent: { disabled: true },
  showDeveloperTools: "never",
})});
`;

/**
 * What the page may load: its own scripts, the styles Scalar writes inline,
 * and requests to this same origin.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join("; ");

interface File {
  readonly path: string;
  /** The `Content-Type`, as Express names it. */
  readonly type: string;
  readonly body: string | Buffer;
}

/**
 * Serves the reference of `document` under `base`, such as `/api/v1`, on the
 * given hosts.
 */
export function serveReference(
  app: NestExpressApplication,
  document: OpenAPIObject,
  base: string,
  hosts: readonly string[],
): void {
  const files: readonly File[] = [
    {
      path: `${base}/openapi.json`,
      type: "json",
      body: JSON.stringify(document),
    },
    { path: `${base}/reference`, type: "html", body: PAGE },
    {
      path: `${base}/reference/standalone.js`,
      type: "js",
      body: readFileSync(SCALAR_BUNDLE),
    },
    { path: `${base}/reference/init.js`, type: "js", body: INIT },
  ];
  const express = app.getHttpAdapter().getInstance();
  for (const file of files) {
    express.get(file.path, (request, response, next) => {
      if (!servesReference(request, hosts)) {
        // The rest of the API, which answers 404.
        next();
        return;
      }
      response
        .type(file.type)
        .set({
          "Content-Security-Policy": CONTENT_SECURITY_POLICY,
          "X-Robots-Tag": "noindex",
          "X-Content-Type-Options": "nosniff",
          "Referrer-Policy": "no-referrer",
          // Checked again on every visit, with its ETag: the bundle changes
          // with Scalar.
          "Cache-Control": "no-cache",
        })
        .send(file.body);
    });
  }
}

/** Whether the request's host serves the reference. */
function servesReference(request: Request, hosts: readonly string[]): boolean {
  return hosts.includes(request.hostname.toLowerCase());
}
