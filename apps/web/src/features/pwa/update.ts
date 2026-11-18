/**
 * A new version of the web or of the catalog (docs/07 §8): both arrive as a
 * new service worker. The page says so and the user decides when to update;
 * otherwise it applies the next time the app opens.
 */
import { useCallback, useEffect, useState } from "react";

export function useServiceWorkerUpdate(): {
  readonly available: boolean;
  /** Activates the new version and reloads; without one, just reloads. */
  readonly update: () => void;
} {
  const [available, setAvailable] = useState(false);
  const [apply, setApply] = useState<(() => Promise<void>) | null>(null);

  useEffect(() => {
    let current = true;
    // Only in the browser: the module registers the service worker.
    void import("virtual:pwa-register").then(({ registerSW }) => {
      if (!current) return;
      const updateSW = registerSW({
        onNeedRefresh() {
          setAvailable(true);
        },
      });
      setApply(() => async () => {
        // vite-plugin-pwa only reloads after updates it found itself in the
        // first 200 ms; the browser usually finds them later, on navigation.
        // The page reloads when the new version takes control, whoever
        // found it.
        navigator.serviceWorker.addEventListener(
          "controllerchange",
          () => {
            location.reload();
          },
          { once: true },
        );
        await updateSW(true);
      });
    });
    return () => {
      current = false;
    };
  }, []);

  const update = useCallback(() => {
    if (available && apply !== null) void apply();
    else location.reload();
  }, [available, apply]);

  return { available, update };
}
