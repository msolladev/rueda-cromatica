/**
 * Installing the app (docs/07 §8): the browser's prompt where there is one
 * (`beforeinstallprompt`, Chromium), instructions in Safari on iOS, and
 * nothing once installed.
 */
import { useEffect, useState } from "react";

/** The event of Chromium that lets a page show the install prompt. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ readonly outcome: "accepted" | "dismissed" }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => {
  for (const listener of listeners) listener();
};

/**
 * Starts listening before React exists: the event can fire as soon as the
 * page loads. The client entry calls it first.
 */
export function captureInstallPrompt(): void {
  addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferred = event as BeforeInstallPromptEvent;
    notify();
  });
  addEventListener("appinstalled", () => {
    deferred = null;
    notify();
  });
}

/** Safari on iOS: the only browser with `navigator.standalone`. */
const isIosSafari = () => "standalone" in navigator;

const isInstalled = () =>
  matchMedia("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

export type InstallMode =
  /** Installed, or the browser cannot install it. */
  | "none"
  /** The browser's own prompt, with a button. */
  | "prompt"
  /** Safari on iOS: instructions, there is no prompt. */
  | "ios";

/** How the app can be installed now; `"none"` until hydrated. */
export function useInstall(): {
  readonly mode: InstallMode;
  readonly install: () => Promise<void>;
} {
  const [mode, setMode] = useState<InstallMode>("none");
  useEffect(() => {
    const update = () => {
      setMode(
        isInstalled()
          ? "none"
          : deferred !== null
            ? "prompt"
            : isIosSafari()
              ? "ios"
              : "none",
      );
    };
    update();
    listeners.add(update);
    return () => {
      listeners.delete(update);
    };
  }, []);
  const install = async () => {
    const event = deferred;
    if (event === null) return;
    await event.prompt();
    await event.userChoice;
    deferred = null;
    notify();
  };
  return { mode, install };
}
