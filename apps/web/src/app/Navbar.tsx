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
  // The option the person picked. Its icon makes its entrance once the page
  // has the new theme: inside the theme's transition, so that it is seen
  // (an animation started before it would be frozen in the old picture).
  // Never on loading the page or restoring the saved theme.
  const wanted = useRef<Theme | null>(null);
  useEffect(() => {
    if (wanted.current !== theme) return;
    wanted.current = null;
    const labels = themeOptions.current?.querySelectorAll("label") ?? [];
    for (const label of labels) {
      label.toggleAttribute(
        "data-picked",
        label.querySelector("input")?.value === theme,
      );
    }
  }, [theme]);
  const menuId = useId();
  const button = useRef<HTMLButtonElement>(null);
  const themeOptions = useRef<HTMLDivElement>(null);
  useSlidingIndicator(themeOptions, "label:has(input:checked)", theme);

  // docs/07 §11: open, the menu covers the page like a dialog. The page
  // behind it is inert, Escape closes it and returns the focus to the button,
  // and so does a press outside it.
  useEffect(() => {
    if (!open) return;
    const behind = [
      ...document.querySelectorAll<HTMLElement>(".main, .footer"),
    ];
    for (const element of behind) element.inert = true;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    addEventListener("keydown", onKey);
    return () => {
      for (const element of behind) element.inert = false;
      removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <header className="navbar">
      <nav className="navbar-inner" aria-label={m.nav.label}>
        <a className="brand" href={homePath}>
          {/* The same icon as the favicon; the name says what it is. */}
          <img
            className="brand-icon"
            src="/icons/icon.svg"
            alt=""
            width="28"
            height="28"
          />
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
        <div
          className="nav-backdrop"
          data-open={open ? "" : undefined}
          aria-hidden="true"
          onClick={() => {
            setOpen(false);
          }}
        />
        <div className="nav-menu" id={menuId} data-open={open ? "" : undefined}>
          {/* The labels are only seen in the menu of narrow screens; in the
              bar the controls speak for themselves (docs/07 §11). */}
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
            <div className="segmented-options theme-options" ref={themeOptions}>
              {THEMES.map((option) => {
                const ThemeIcon = THEME_ICONS[option];
                return (
                  <label
                    key={option}
                    className="segment"
                    data-tooltip={m.nav.themes[option]}
                  >
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
                        wanted.current = option;
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
