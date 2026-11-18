import { RESTORING } from "./before-paint.ts";

/**
 * Shows what the inline script hid while the saved preferences were applied
 * (docs/07 §6).
 */
export function endRestoring(): void {
  document.documentElement.removeAttribute(`data-${RESTORING}`);
}
