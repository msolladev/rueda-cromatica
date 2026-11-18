/** Fills the HTML template of Vite with a prerendered page (docs/07 §10). */
import { inlineScriptSource, INLINE_SCRIPT } from "./inline-script.ts";

export interface PageParts {
  readonly lang: string;
  readonly head: string;
  readonly html: string;
  readonly data: unknown;
}

/**
 * The Content Security Policy of the pages. Only the script of build/inline-script.ts runs
 * inline; inline styles are allowed because the swatches of the prerendered
 * HTML carry their color in a `style` attribute.
 */
export function contentSecurityPolicy(): string {
  return [
    "default-src 'self'",
    `script-src 'self' ${inlineScriptSource()}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "connect-src 'self'",
    "manifest-src 'self'",
    "worker-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
  ].join("; ");
}

/** A JSON value safe inside `<script type="application/json">`. */
const scriptJson = (value: unknown): string =>
  JSON.stringify(value).replaceAll("<", "\\u003c");

export function fillTemplate(
  template: string,
  page: PageParts,
  options: { readonly csp: boolean },
): string {
  const replaced = template
    .replace(/<html lang="[^"]*">/, `<html lang="${page.lang}">`)
    .replace(
      "<!--app-csp-->",
      options.csp
        ? `<meta http-equiv="Content-Security-Policy" content="${contentSecurityPolicy()}" />`
        : "",
    )
    .replace("<!--app-head-->", page.head)
    .replace("<!--app-inline-script-->", `<script>${INLINE_SCRIPT}</script>`)
    .replace("<!--app-html-->", page.html)
    .replace(
      "<!--app-data-->",
      `<script type="application/json" id="page-data">${scriptJson(page.data)}</script>`,
    );
  if (replaced.includes("<!--app-")) {
    throw new Error("The HTML template still has a placeholder.");
  }
  return replaced;
}
