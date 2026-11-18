import { useEffect, useId, useRef, useState } from "react";
import { THEMES, type Theme } from "../features/theme/theme.ts";
import { useSlidingIndicator } from "./sliding-indicator.ts";
import { LANGUAGE_NAMES, LOCALES, type Locale } from "../i18n/i18n.ts";
import type { Messages } from "../i18n/messages.ts";
import {
  CloseIcon,
  MenuIcon,
  MonitorIcon,
  MoonIcon,
  SunIcon,
} from "./icons.tsx";

const THEME_ICONS = { system: MonitorIcon, light: SunIcon, dark: MoonIcon };

interface NavbarProps {
  readonly locale: Locale;
  readonly homePath: string;
  readonly theme: Theme;
  readonly messages: Messages;
  readonly onLocale: (locale: Locale) => void;
  /** With the center of the pressed option, where the new theme grows from. */
  readonly onTheme: (
    theme: Theme,
    origin: { readonly x: number; readonly y: number },
  ) => void;
}

/**
 * The navigation bar (docs/07 §11): the name on the left; the language and
 * the theme on the right, gathered in a menu behind a button on narrow
 * screens. It stays at the top while scrolling.
 */
export function Navbar({
  locale,
  homePath,
  theme,
  messages: m,
  onLocale,
  onTheme,
}: NavbarProps) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const button = useRef<HTMLButtonElement>(null);
  const themeOptions = useRef<HTMLDivElement>(null);
  useSlidingIndicator(themeOptions, "label:has(input:checked)", theme);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    addEventListener("keydown", onKey);
    return () => {
      removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <header className="navbar">
      <nav className="navbar-inner" aria-label={m.nav.label}>
        <a className="brand" href={homePath}>
          {m.meta.siteName}
        </a>
        <button
          ref={button}
          type="button"
          className="icon-button burger"
          aria-expanded={open}
          aria-controls={menuId}
          aria-label={open ? m.nav.closeMenu : m.nav.openMenu}
          onClick={() => {
            setOpen(!open);
          }}
        >
          {open ? <CloseIcon /> : <MenuIcon />}
        </button>
        <div className="nav-menu" id={menuId} data-open={open ? "" : undefined}>
          <label className="nav-item">
            <span className="nav-label">{m.nav.language}</span>
            <span className="select-box">
              <select
                value={locale}
                onChange={(event) => {
                  onLocale(event.target.value as Locale);
                }}
              >
                {LOCALES.map((option) => (
                  <option key={option} value={option} lang={option}>
                    {LANGUAGE_NAMES[option]}
                  </option>
                ))}
              </select>
            </span>
          </label>
          <fieldset className="nav-item theme-switch">
            <legend className="nav-label">{m.nav.theme}</legend>
            <div className="theme-options" ref={themeOptions}>
              {THEMES.map((option) => {
                const ThemeIcon = THEME_ICONS[option];
                return (
                  <label key={option} title={m.nav.themes[option]}>
                    <input
                      type="radio"
                      name="theme"
                      value={option}
                      checked={theme === option}
                      onChange={(event) => {
                        const box = (
                          event.currentTarget.parentElement ??
                          event.currentTarget
                        ).getBoundingClientRect();
                        onTheme(option, {
                          x: box.left + box.width / 2,
                          y: box.top + box.height / 2,
                        });
                      }}
                    />
                    <ThemeIcon />
                    <span className="visually-hidden">
                      {m.nav.themes[option]}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        </div>
      </nav>
    </header>
  );
}
