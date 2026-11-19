import { resolveLocale } from "@chromatic-wheel/color-wheel";
import { useEffect, useReducer } from "react";
import { flushSync } from "react-dom";
import { Credits } from "../features/credits/Credits.tsx";
import { Home } from "../features/matches/Home.tsx";
import { InstallBanner } from "../features/pwa/InstallBanner.tsx";
import { useInstall, withdrawInstall } from "../features/pwa/install.ts";
import { useServiceWorkerUpdate } from "../features/pwa/update.ts";
import { revealTheme } from "../features/theme/reveal.ts";
import { applyTheme } from "../features/theme/theme.ts";
import { endRestoring } from "./restoring.ts";
import {
  LANGUAGE_NAMES,
  LOCALES,
  messagesOf,
  type Locale,
} from "../i18n/i18n.ts";
import { Footer } from "./Footer.tsx";
import { RefreshIcon } from "./icons.tsx";
import { Navbar } from "./Navbar.tsx";
import { NotFound } from "./NotFound.tsx";
import { SkipLinks } from "./SkipLinks.tsx";
import { fadeLinks, goTo } from "./page-transition.ts";
import type { PageData } from "./page-data.ts";
import { pathOf, withLocale, type Page } from "./pages.ts";
import { readPreferences, writePreferences } from "./persistence.ts";
import { INITIAL_STATE, reduce } from "./state.ts";

export interface AppProps {
  readonly page: Page;
  readonly data: PageData;
}

/** The root of every page (docs/07). */
export function App({ page, data }: AppProps) {
  if (page.kind === "languages") return <Languages />;
  return <LocalizedApp page={page} locale={page.locale} data={data} />;
}

function LocalizedApp({
  page,
  locale,
  data,
}: {
  readonly page: Page;
  readonly locale: Locale;
  readonly data: PageData;
}) {
  const m = messagesOf(locale);
  const [state, dispatch] = useReducer(reduce, INITIAL_STATE);
  const { mode: installMode, install } = useInstall();
  const swUpdate = useServiceWorkerUpdate();
  const { preferences, restored } = state;

  useEffect(fadeLinks, []);

  // The saved preferences are read after taking over, never in the first
  // render, which must match the prerendered HTML (docs/07 §10).
  useEffect(() => {
    dispatch({ type: "restore", preferences: readPreferences(localStorage) });
  }, []);

  useEffect(() => {
    if (restored) writePreferences(localStorage, preferences);
  }, [restored, preferences]);

  useEffect(() => {
    if (restored) applyTheme(preferences.theme);
  }, [restored, preferences.theme]);

  // The home page shows its wheel and results once they reflect the saved
  // preferences; the other pages have nothing to wait for.
  useEffect(() => {
    if (restored && data.kind !== "home") endRestoring();
  }, [restored, data.kind]);

  const onLocale = (next: Locale) => {
    // Saved before leaving: the effect would not run in time.
    writePreferences(localStorage, { ...preferences, locale: next });
    goTo(pathOf(withLocale(page, next)));
  };

  return (
    <>
      <SkipLinks
        kind={data.kind === "home" ? "home" : "content"}
        messages={m}
      />
      <Navbar
        locale={locale}
        homePath={pathOf({ kind: "home", locale })}
        theme={preferences.theme}
        messages={m}
        onLocale={onLocale}
        onTheme={(theme, origin) => {
          revealTheme(origin, () => {
            // Inside the transition, so that its new view has the new theme.
            applyTheme(theme);
            flushSync(() => {
              dispatch({ type: "set-theme", theme });
            });
          });
        }}
      />
      <main className="main" id="content" data-skip-target="" tabIndex={-1}>
        <InstallBanner
          messages={m}
          onInstall={install}
          onClose={() => {
            withdrawInstall();
            dispatch({ type: "dismiss-install" });
          }}
        />
        {swUpdate.available && (
          <div className="page-banner update-banner" role="status">
            <RefreshIcon />
            <p>{m.pwa.updateAvailable}</p>
            <button type="button" className="button" onClick={swUpdate.update}>
              {m.pwa.update}
            </button>
          </div>
        )}

        {data.kind === "home" && (
          <Home
            locale={locale}
            data={data.home}
            state={state}
            dispatch={dispatch}
            messages={m}
            restoreWheel={state.restoredWheel}
            onUpdate={swUpdate.update}
          />
        )}
        {data.kind === "credits" && (
          <Credits
            data={data.credits}
            messages={m}
            locale={locale}
            homePath={pathOf({ kind: "home", locale })}
          />
        )}
        {data.kind === "not-found" && (
          <NotFound homePath={pathOf({ kind: "home", locale })} messages={m} />
        )}
      </main>
      <Footer
        creditsPath={pathOf({ kind: "credits", locale })}
        installMode={installMode}
        messages={m}
        onInstall={() => void install()}
      />
    </>
  );
}

/**
 * `/`: goes to the saved language or the detected one; without JavaScript,
 * links to every language (docs/07 §12).
 */
function Languages() {
  useEffect(() => {
    const locale =
      readPreferences(localStorage)?.locale ??
      resolveLocale(navigator.languages);
    location.replace(pathOf({ kind: "home", locale }));
  }, []);
  return (
    <main className="main languages">
      <h1 lang="en">{messagesOf("en").meta.siteName}</h1>
      <ul>
        {LOCALES.map((locale) => {
          const m = messagesOf(locale);
          return (
            <li key={locale} lang={locale}>
              <a href={pathOf({ kind: "home", locale })}>
                <strong>{LANGUAGE_NAMES[locale]}</strong>
                <span>{m.meta.homeTitle}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
