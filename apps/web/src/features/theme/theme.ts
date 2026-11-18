/**
 * The theme (docs/07 §11): the system's, light or dark. The page sets it on
 * `<html data-theme>`; the CSS turns it into `color-scheme` for the page and
 * `--cw-color-scheme` for the wheel.
 */
export const THEMES = ["system", "light", "dark"] as const;

export type Theme = (typeof THEMES)[number];

export function isTheme(value: unknown): value is Theme {
  return THEMES.includes(value as Theme);
}

/**
 * Applies the theme to the document, as the inline script does on load: on
 * `<html data-theme>` for the CSS, and on `<meta name="color-scheme">` for
 * what the browser paints before the CSS loads.
 */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === "system") delete root.dataset["theme"];
  else root.dataset["theme"] = theme;
  const meta = document.querySelector<HTMLMetaElement>(
    'meta[name="color-scheme"]',
  );
  if (meta !== null) meta.content = theme === "system" ? "light dark" : theme;
}
