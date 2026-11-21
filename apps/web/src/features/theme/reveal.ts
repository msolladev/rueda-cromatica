import { prefersReducedMotion } from "../../app/motion.ts";

/**
 * Changes the theme with a circular reveal (docs/07 §11): the new theme grows
 * in a circle from the control that was pressed and, inside the circle, fades
 * in over the old one (View Transitions). Without support, or when the
 * system asks to reduce motion, `change` runs at once.
 */
export function revealTheme(
  origin: { readonly x: number; readonly y: number },
  change: () => void,
): void {
  if (
    typeof document.startViewTransition !== "function" ||
    prefersReducedMotion()
  ) {
    change();
    return;
  }
  const root = document.documentElement;
  const radius = Math.hypot(
    Math.max(origin.x, innerWidth - origin.x),
    Math.max(origin.y, innerHeight - origin.y),
  );
  root.classList.add("theme-transition");
  const transition = document.startViewTransition(change);
  void transition.ready.then(() => {
    root.animate(
      {
        clipPath: [
          `circle(0px at ${String(origin.x)}px ${String(origin.y)}px)`,
          `circle(${String(radius)}px at ${String(origin.x)}px ${String(origin.y)}px)`,
        ],
        opacity: [0, 1],
      },
      {
        duration: 650,
        easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
        pseudoElement: "::view-transition-new(root)",
      },
    );
  });
  void transition.finished.finally(() => {
    root.classList.remove("theme-transition");
  });
}
