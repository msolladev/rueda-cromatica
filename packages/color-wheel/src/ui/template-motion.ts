// The template's motion (docs/05 §6.2): when the harmony or the light
// changes and the base does not move, each mark travels to its new hue
// instead of jumping. Pure functions; the component runs the frames.

/** How long the template takes to reach its new place, in milliseconds. */
export const TEMPLATE_DURATION = 450;

/** Fast at first and gentle at the end. */
export function easeOut(t: number): number {
  return 1 - (1 - t) ** 3;
}

/**
 * The hues of the marks at `t` (0 to 1) between two templates, the base
 * first. Each mark travels along the shortest arc. When the counts differ,
 * the extra marks come out of the base or go back into it, so the result has
 * as many marks as the longer template.
 */
export function interpolateTemplate(
  from: readonly number[],
  to: readonly number[],
  t: number,
): number[] {
  const count = Math.max(from.length, to.length);
  const fromBase = from[0] ?? 0;
  const toBase = to[0] ?? fromBase;
  return Array.from({ length: count }, (_, index) => {
    const start = from[index] ?? fromBase;
    const end = to[index] ?? toBase;
    const delta = ((((end - start) % 360) + 540) % 360) - 180;
    return (((start + delta * t) % 360) + 360) % 360;
  });
}

/** Whether two templates draw the same marks, to the hundredth of a degree. */
export function sameTemplate(
  a: readonly number[],
  b: readonly number[],
): boolean {
  return (
    a.length === b.length &&
    a.every((hue, index) => Math.abs(hue - (b[index] ?? NaN)) < 0.01)
  );
}
