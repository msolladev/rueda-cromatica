/**
 * The service worker (docs/07 §8): precaches every page, the code and
 * `catalog.json`, so the app works offline after the first visit. A new
 * version waits until the page asks it to take over (the «Update» button),
 * or until the app is opened again.
 */
import { cleanupOutdatedCaches, precacheAndRoute } from "workbox-precaching";

declare const self: ServiceWorkerGlobalScope & {
  readonly __WB_MANIFEST: (string | { url: string; revision: string | null })[];
};

// `/es/` is served from the precached `/es/index.html`.
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

self.addEventListener("message", (event) => {
  if ((event.data as { type?: unknown } | null)?.type === "SKIP_WAITING") {
    void self.skipWaiting();
  }
});
