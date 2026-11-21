/**
 * The service worker (docs/07 §8): precaches every page, the code and
 * `catalog.json`, so the app works offline after the first visit. A new
 * version waits until the page asks it to take over (the «Update» button),
 * or until the app is opened again.
 */
import { clientsClaim } from "workbox-core";
import { cleanupOutdatedCaches, precacheAndRoute } from "workbox-precaching";

declare const self: ServiceWorkerGlobalScope & {
  readonly __WB_MANIFEST: (string | { url: string; revision: string | null })[];
};

// Each page is precached by its address (`/es/`, see vite.config.ts), and
// `/es` is served from it too, without redirecting (docs/07 §12).
precacheAndRoute(self.__WB_MANIFEST, {
  urlManipulation: ({ url }) =>
    url.pathname.endsWith("/") ? [] : [new URL(`${url.pathname}/`, url)],
});
cleanupOutdatedCaches();
// The first version controls the open page at once, so it works offline
// without reloading. Later versions wait for SKIP_WAITING.
clientsClaim();

self.addEventListener("message", (event) => {
  if ((event.data as { type?: unknown } | null)?.type === "SKIP_WAITING") {
    void self.skipWaiting();
  }
});
