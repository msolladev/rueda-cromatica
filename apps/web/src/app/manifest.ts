/**
 * The web app manifest (docs/07 §8), one per language: a manifest cannot be
 * translated inside one file, so each language's pages link their own, with
 * the name of the web in that language. All of them share the same `id`, so
 * the browser takes them for one app, whatever the language it is installed
 * from.
 */
import { LOCALES, localeSlug, messagesOf, type Locale } from "../i18n/i18n.ts";

/** The address of a language's manifest: `/es/manifest.webmanifest`. */
export function manifestPathOf(locale: Locale): string {
  return `/${localeSlug(locale)}/manifest.webmanifest`;
}

/** The manifest of a language, as its JSON. */
export function manifestOf(locale: Locale): string {
  const { meta } = messagesOf(locale);
  return `${JSON.stringify(
    {
      // The same app in every language.
      id: "/",
      name: meta.siteName,
      short_name: meta.siteName,
      description: meta.homeDescription,
      lang: locale,
      dir: "ltr",
      // It opens in the language it was installed from; the language
      // selector moves within the app.
      start_url: `/${localeSlug(locale)}/`,
      scope: "/",
      display: "standalone",
      // The splash screen of the installed app: one color, with no dark
      // version, so that of the dark theme, which does not flash in the dark
      // (docs/07 §8). The page sets the theme's own once it loads.
      background_color: "#121417",
      theme_color: "#121417",
      icons: [
        { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
        {
          src: "/icons/icon-maskable-512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "maskable",
        },
      ],
    },
    null,
    2,
  )}\n`;
}

/** Every manifest, with its address. */
export function allManifests(): readonly {
  readonly path: string;
  readonly json: string;
}[] {
  return LOCALES.map((locale) => ({
    path: manifestPathOf(locale),
    json: manifestOf(locale),
  }));
}
