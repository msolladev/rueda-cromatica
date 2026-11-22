import { fromWheelColor } from "@chromatic-wheel/color-wheel";
import { useState, type CSSProperties } from "react";
import type { InstallMode } from "../features/pwa/install.ts";
import { format } from "../i18n/i18n.ts";
import type { Messages } from "../i18n/messages.ts";
import { ExternalLink } from "./ExternalLink.tsx";

const REPOSITORY_URL = "https://github.com/msolladev/rueda-cromatica";
const DONATION_URL = "https://paypal.me/miguelangelss4";
/**
 * The API reference of `color-wheel` and `domain` (ADR-0023): another site,
 * in English, that the server of each environment serves beside the web.
 */
const REFERENCE_PATH = "/reference/";

/**
 * The twelve pure hues of the RYB wheel, from red, as the stops of the strip
 * on top of the footer: the colors of the wheel itself, as in the icon.
 */
const HUE_STRIP = `linear-gradient(to right, ${Array.from(
  { length: 12 },
  (_, index) =>
    fromWheelColor({ hue: index * 30, pure: 1, white: 0, black: 0 }, "ryb"),
).join(", ")})`;

/** The commit the web is built from, written by vite.config.ts. */
const COMMIT = import.meta.env.VITE_COMMIT;
const COMMIT_DATE = import.meta.env.VITE_COMMIT_DATE;

interface FooterProps {
  readonly locale: string;
  readonly homePath: string;
  readonly creditsPath: string;
  readonly installMode: InstallMode;
  readonly messages: Messages;
  readonly onInstall: () => void;
}

/**
 * The footer (docs/07 §16): the name of the web with what it does, the
 * links of the project and of the app, the notice that it is not official
 * and the version: the commit it is built from.
 */
export function Footer({
  locale,
  homePath,
  creditsPath,
  installMode,
  messages: m,
  onInstall,
}: FooterProps) {
  const [steps, setSteps] = useState(false);
  return (
    <footer
      className="footer"
      style={{ "--hue-strip": HUE_STRIP } as CSSProperties}
    >
      <div className="footer-inner">
        <div className="footer-about">
          <a className="brand" href={homePath}>
            <img
              className="brand-icon"
              src="/icons/icon.svg"
              alt=""
              width="28"
              height="28"
            />
            {m.meta.siteName}
          </a>
          <p>{m.footer.tagline}</p>
        </div>
        <section className="footer-group" aria-labelledby="footer-project">
          <h2 id="footer-project">{m.footer.projectHeading}</h2>
          <ul>
            <li>
              <a href={creditsPath}>
                <span className="link-text">{m.footer.credits}</span>
              </a>
            </li>
            <li>
              <ExternalLink
                href={REPOSITORY_URL}
                text={m.footer.sourceCode}
                messages={m}
              />
            </li>
            <li>
              <ExternalLink
                href={DONATION_URL}
                text={m.footer.donate}
                messages={m}
              />
            </li>
          </ul>
        </section>
        <section className="footer-group" aria-labelledby="footer-app">
          <h2 id="footer-app">{m.footer.appHeading}</h2>
          <ul>
            {installMode !== "none" && (
              <li>
                <button
                  type="button"
                  className="link-button"
                  aria-expanded={installMode === "ios" ? steps : undefined}
                  onClick={() => {
                    if (installMode === "prompt") onInstall();
                    else setSteps(!steps);
                  }}
                >
                  <span className="link-text">{m.pwa.installApp}</span>
                </button>
                {installMode === "ios" && steps && (
                  <p className="footer-note">{m.pwa.iosSteps}</p>
                )}
              </li>
            )}
            <li>
              <ExternalLink
                href={REFERENCE_PATH}
                text={m.footer.apiReference}
                messages={m}
              />
            </li>
          </ul>
        </section>
        <div className="footer-bottom">
          <p>{m.footer.disclaimer}</p>
          {COMMIT !== "" && (
            <p>
              <time dateTime={COMMIT_DATE}>
                {format(m.footer.version, {
                  date: new Intl.DateTimeFormat(locale, {
                    dateStyle: "long",
                    timeZone: "UTC",
                  }).format(new Date(`${COMMIT_DATE}T00:00:00Z`)),
                })}
              </time>
              {" · "}
              <ExternalLink
                href={`${REPOSITORY_URL}/commit/${COMMIT}`}
                text={format(m.footer.commit, { commit: COMMIT.slice(0, 7) })}
                messages={m}
              />
            </p>
          )}
        </div>
      </div>
    </footer>
  );
}
