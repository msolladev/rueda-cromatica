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

/** Applies the theme to the document, as the inline script does on load. */
export function applyTheme(theme: Theme): void {
  if (theme === "system") delete document.documentElement.dataset["theme"];
  else document.documentElement.dataset["theme"] = theme;
}
