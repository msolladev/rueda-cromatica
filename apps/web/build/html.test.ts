import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { contentSecurityPolicy, fillTemplate } from "./html.ts";
import { THEME_SCRIPT } from "./theme-script.ts";

const TEMPLATE = `<!doctype html>
<html lang="en">
<head><!--app-csp--><!--app-head--><!--app-theme--></head>
<body><div id="root"><!--app-html--></div><!--app-data--></body>
</html>`;

const page = {
  lang: "ja",
  head: "<title>t</title>",
  html: "<main>m</main>",
  data: { text: "</script><script>alert(1)</script>" },
};

describe("fillTemplate", () => {
  it("fills every placeholder of the template", () => {
    const html = fillTemplate(TEMPLATE, page, { csp: true });
    expect(html).toContain('<html lang="ja">');
    expect(html).toContain("<title>t</title>");
    expect(html).toContain('<div id="root"><main>m</main></div>');
    expect(html).toContain(`<script>${THEME_SCRIPT}</script>`);
    expect(html).toContain('http-equiv="Content-Security-Policy"');
    expect(html).not.toContain("<!--app-");
  });

  it("leaves the CSP out in development", () => {
    expect(fillTemplate(TEMPLATE, page, { csp: false })).not.toContain(
      "Content-Security-Policy",
    );
  });

  it("cannot close the data script from inside the data", () => {
    const html = fillTemplate(TEMPLATE, page, { csp: false });
    expect(html).not.toContain("</script><script>alert(1)");
    expect(html).toContain("\\u003c/script>");
  });

  it("fails if a placeholder is left", () => {
    expect(() =>
      fillTemplate(`${TEMPLATE}<!--app-extra-->`, page, { csp: false }),
    ).toThrow();
  });
});

describe("contentSecurityPolicy", () => {
  it("allows the theme script by the hash of its exact text, and nothing else inline", () => {
    const hash = createHash("sha256").update(THEME_SCRIPT).digest("base64");
    const csp = contentSecurityPolicy();
    expect(csp).toContain(`script-src 'self' 'sha256-${hash}'`);
    expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/);
  });
});
