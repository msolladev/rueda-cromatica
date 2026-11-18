/**
 * Moving between pages with a fade (docs/07 §12), in every browser and
 * without a client router: the content fades out, the browser goes to the
 * new prerendered page, and that page fades in from its first paint (the
 * inline script marks it). The navigation bar does not move.
 */
import { ARRIVING_KEY } from "./before-paint.ts";
import { pageOf } from "./pages.ts";

/** How long the content takes to fade out before leaving. */
const LEAVE_MS = 160;

const reduceMotion = () =>
  matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Goes to `href`, an address of the app, with the fade. */
export function goTo(href: string): void {
  if (reduceMotion()) {
    location.assign(href);
    return;
  }
  try {
    sessionStorage.setItem(ARRIVING_KEY, "1");
  } catch {
    // Without storage the new page simply does not fade in.
  }
  document.documentElement.dataset["leaving"] = "";
  setTimeout(() => {
    location.assign(href);
  }, LEAVE_MS);
}

/**
 * Takes over the clicks on links to pages of the app, so that they leave
 * with the fade. Links with a modifier key, to another origin, with a target
 * or to something that is not a page work as always. Returns the cleanup.
 */
export function fadeLinks(): () => void {
  const onClick = (event: MouseEvent) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    const link = (event.target as Element | null)?.closest("a");
    if (
      link === null ||
      link === undefined ||
      link.target !== "" ||
      link.hasAttribute("download")
    ) {
      return;
    }
    const url = new URL(link.href, location.href);
    if (
      url.origin !== location.origin ||
      url.hash !== "" ||
      pageOf(url.pathname) === undefined
    ) {
      return;
    }
    event.preventDefault();
    goTo(url.pathname);
  };
  // Back from the browser's cache, the page must not stay faded out.
  const onShow = (event: PageTransitionEvent) => {
    if (event.persisted) {
      delete document.documentElement.dataset["leaving"];
    }
  };
  addEventListener("click", onClick);
  addEventListener("pageshow", onShow);
  return () => {
    removeEventListener("click", onClick);
    removeEventListener("pageshow", onShow);
  };
}
