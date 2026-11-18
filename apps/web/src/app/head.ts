/**
 * The `<head>` of each page (docs/07 §10): title, description, language
 * alternates, canonical URL, sharing metadata and structured data. It is
 * written by the prerendering, so it is there without JavaScript.
 */
import { LOCALES, messagesOf, type Locale } from "../i18n/i18n.ts";
import { pathOf, type Page } from "./pages.ts";

const escapeHtml = (text: string): string =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

/** The language of a page's HTML: its locale, or English for `/`. */
export function langOf(page: Page): Locale {
  return page.kind === "languages" ? "en" : page.locale;
}

function titleOf(page: Page): {
  readonly title: string;
  readonly description: string;
} {
  const m = messagesOf(langOf(page));
  switch (page.kind) {
    case "languages":
    case "home":
      return { title: m.meta.homeTitle, description: m.meta.homeDescription };
    case "credits":
      return {
        title: `${m.meta.creditsTitle} · ${m.meta.siteName}`,
        description: m.meta.creditsDescription,
      };
  }
}

/**
 * The tags of the page's `<head>`, as HTML. `origin` is the site's origin,
 * without a final `/` (`https://example.org`): canonical URLs, alternates
 * and sharing metadata must be absolute.
 */
export function headOf(page: Page, origin: string): string {
  const { title, description } = titleOf(page);
  const url = (target: Page) => `${origin}${pathOf(target)}`;
  const lang = langOf(page);
  const siteName = messagesOf(lang).meta.siteName;
  const alternates =
    page.kind === "languages"
      ? LOCALES.map((locale) => ({ kind: "home" as const, locale }))
      : LOCALES.map((locale) => ({ ...page, locale }));
  const image = `${origin}/icons/icon-512.png`;

  const tags = [
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}" />`,
    `<link rel="canonical" href="${url(page)}" />`,
    ...alternates.map(
      (alternate) =>
        `<link rel="alternate" hreflang="${alternate.locale}" href="${url(alternate)}" />`,
    ),
    `<link rel="alternate" hreflang="x-default" href="${url({ kind: "languages" })}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${escapeHtml(siteName)}" />`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    `<meta property="og:url" content="${url(page)}" />`,
    `<meta property="og:image" content="${image}" />`,
    `<meta name="twitter:card" content="summary" />`,
  ];
  if (page.kind !== "credits") {
    const data = {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: siteName,
      url: url(page),
      description,
      inLanguage: lang,
      applicationCategory: "DesignApplication",
      operatingSystem: "Any",
      isAccessibleForFree: true,
    };
    tags.push(
      `<script type="application/ld+json">${JSON.stringify(data).replaceAll("<", "\\u003c")}</script>`,
    );
  }
  return tags.join("\n    ");
}
