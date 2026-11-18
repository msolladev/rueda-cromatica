import { useSyncExternalStore } from "react";

const subscribe = () => () => undefined;

/**
 * `false` in the prerendering and in the first render of the browser, which
 * must draw the same HTML; `true` from the next render on. What depends on
 * the browser (preferences, the live search) waits for it (docs/07 §10).
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
