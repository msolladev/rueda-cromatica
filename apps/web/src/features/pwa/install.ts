/**
 * Installing the app (docs/07 §8): the browser's prompt where there is one
 * (`beforeinstallprompt`, Chromium), instructions in Safari on iOS, and
 * nothing once installed. Whether to offer it is decided before the first
 * paint by the inline script (`data-install`), so that the banner arrives
 * with the page.
 */
import { useEffect, useState } from "react";
import { INSTALL } from "../../app/before-paint.ts";

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
    withdrawInstall();
    notify();
  });
}

export type InstallMode =
  /** Installed, closed, or the browser cannot install it. */
  | "none"
  /** A browser that installs web apps, with a button. */
  | "prompt"
  /** Safari on iOS: instructions, there is no prompt. */
  | "ios";

/** Safari on iOS: the only browser with `navigator.standalone`. */
const isIosSafari = () => "standalone" in navigator;

const isInstalled = () =>
  matchMedia("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

/** Hides the banner for good in this page: installed or closed. */
export function withdrawInstall(): void {
  document.documentElement.removeAttribute(`data-${INSTALL}`);
}

/**
 * How the app can be installed now, for the footer (docs/07 §8); `"none"`
 * until hydrated. The banner does not use it: the inline script shows it
 * before the first paint (`data-install`). `install` opens the
 * browser's prompt and returns `true`, or returns `false` if the browser has
 * not offered it yet (Chromium waits until the person has used the page a
 * little), so that the banner can say how to install it from its menu.
 */
export function useInstall(): {
  readonly mode: InstallMode;
  readonly install: () => Promise<boolean>;
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
    if (event === null) return false;
    await event.prompt();
    const { outcome } = await event.userChoice;
    deferred = null;
    if (outcome === "accepted") withdrawInstall();
    notify();
    return true;
  };
  return { mode, install };
}
