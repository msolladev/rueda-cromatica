/**
 * Whether the system asks to reduce motion. The one check for the motion that
 * JavaScript drives; the CSS has its own rule at the end of app.css.
 */
export const prefersReducedMotion = (): boolean =>
  matchMedia("(prefers-reduced-motion: reduce)").matches;
