import type { Messages } from "../../i18n/messages.ts";
import type { InstallMode } from "./install.ts";

interface InstallBannerProps {
  readonly mode: InstallMode;
  readonly messages: Messages;
  readonly onInstall: () => void;
  readonly onClose: () => void;
}

/**
 * The install banner (docs/07 §8): the first element of the page, in the
 * flow and not modal. It goes away when the app is installed or the user
 * closes it, for good.
 */
export function InstallBanner({
  mode,
  messages: m,
  onInstall,
  onClose,
}: InstallBannerProps) {
  if (mode === "none") return null;
  return (
    <aside className="install-banner" aria-label={m.pwa.installApp}>
      <p>
        <strong>{m.pwa.installTitle}</strong>{" "}
        {mode === "ios" ? m.pwa.iosSteps : m.pwa.installBody}
      </p>
      <div className="install-actions">
        {mode === "prompt" && (
          <button type="button" className="button" onClick={onInstall}>
            {m.pwa.install}
          </button>
        )}
        <button
          type="button"
          className="icon-button"
          aria-label={m.pwa.close}
          onClick={onClose}
        >
          ×
        </button>
      </div>
    </aside>
  );
}
