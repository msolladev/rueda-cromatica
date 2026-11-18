import { useState } from "react";
import type { InstallMode } from "../features/pwa/install.ts";
import type { Messages } from "../i18n/messages.ts";

interface FooterProps {
  readonly creditsPath: string;
  readonly installMode: InstallMode;
  readonly messages: Messages;
  readonly onInstall: () => void;
}

/** The footer: «Credits and sources» and the discreet install button. */
export function Footer({
  creditsPath,
  installMode,
  messages: m,
  onInstall,
}: FooterProps) {
  const [steps, setSteps] = useState(false);
  return (
    <footer className="footer">
      <div className="footer-inner">
        <a href={creditsPath}>{m.footer.credits}</a>
        {installMode !== "none" && (
          <button
            type="button"
            className="link-button"
            aria-expanded={installMode === "ios" ? steps : undefined}
            onClick={() => {
              if (installMode === "prompt") onInstall();
              else setSteps(!steps);
            }}
          >
            {m.pwa.installApp}
          </button>
        )}
      </div>
      {installMode === "ios" && steps && (
        <p className="footer-note">{m.pwa.iosSteps}</p>
      )}
    </footer>
  );
}
