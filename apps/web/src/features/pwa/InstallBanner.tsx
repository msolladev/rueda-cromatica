import { useRef, useState } from "react";
import { CloseIcon } from "../../app/icons.tsx";
import type { Messages } from "../../i18n/messages.ts";
import { prefersReducedMotion } from "../../app/motion.ts";

interface InstallBannerProps {
  readonly messages: Messages;
  /** `false` if the browser has not offered installing yet. */
  readonly onInstall: () => Promise<boolean>;
  readonly onClose: () => void;
}

/**
 * The install banner (docs/07 §8): the first element of the page, in the
 * flow and not modal. It is always in the HTML, and the inline script shows
 * it before the first paint where the app can be installed, so it arrives
 * with the page and never moves it. It says what is installed, with the icon
 * it will have; in Safari on iOS, how to do it. It folds up when closed, and
 * goes away for good when closed or installed.
 */
export function InstallBanner({
  messages: m,
  onInstall,
  onClose,
}: InstallBannerProps) {
  const banner = useRef<HTMLElement>(null);
  const [hint, setHint] = useState(false);
  const close = () => {
    const element = banner.current;
    if (element === null || prefersReducedMotion()) {
      onClose();
      return;
    }
    // Folds up first, and then it is hidden.
    element
      .animate(
        [
          { height: `${String(element.offsetHeight)}px`, opacity: 1 },
          {
            height: "0px",
            opacity: 0,
            paddingBlock: "0px",
            borderWidth: "0px",
          },
        ],
        { duration: 260, easing: "cubic-bezier(0.4, 0, 0.2, 1)" },
      )
      .finished.then(onClose, onClose);
  };
  return (
    <aside
      className="page-banner install-banner"
      aria-label={m.pwa.installApp}
      ref={banner}
    >
      <img
        className="install-icon"
        src="/icons/icon.svg"
        alt=""
        width="44"
        height="44"
      />
      <div className="install-text">
        <p className="install-title">{m.pwa.installTitle}</p>
        <p className="install-prompt-only" aria-live="polite">
          {hint ? m.pwa.installHint : m.pwa.installBody}
        </p>
        <p className="install-ios-only">{m.pwa.iosSteps}</p>
      </div>
      <button
        type="button"
        className="button install-action install-prompt-only"
        onClick={() => {
          void onInstall().then((prompted) => {
            setHint(!prompted);
          });
        }}
      >
        {m.pwa.install}
      </button>
      <button
        type="button"
        className="icon-button install-close"
        aria-label={m.pwa.close}
        onClick={close}
      >
        <CloseIcon />
      </button>
    </aside>
  );
}
