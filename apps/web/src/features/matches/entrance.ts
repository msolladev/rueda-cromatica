import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";

/**
 * Which rows move in or out with an animation (docs/07 §1): every row of the
 * panel when the user picks another tab, the rows that «See more» added, or
 * those that «See less» takes away. Rows that change while the wheel is
 * dragged never animate.
 */
export type Entrance =
  | { readonly kind: "panel" }
  | { readonly kind: "more"; readonly key: string; readonly from: number }
  | { readonly kind: "less"; readonly key: string; readonly from: number };

/** Long enough for the last staggered row to finish. */
const ENTRANCE_MS = 700;

/** How long the rows take to leave before they are removed. */
export const LEAVE_MS = 260;

/** The current entrance, if any, and how to start one. */
export function useEntrance(): {
  readonly entrance: Entrance | null;
  readonly start: (entrance: Entrance) => void;
  /** Makes rows leave, then calls `then`, which removes them. */
  readonly leave: (key: string, from: number, then: () => void) => void;
} {
  const [entrance, setEntrance] = useState<Entrance | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(
    () => () => {
      clearTimeout(timer.current);
    },
    [],
  );
  const start = useCallback((next: Entrance) => {
    clearTimeout(timer.current);
    setEntrance(next);
    timer.current = setTimeout(() => {
      setEntrance(null);
    }, ENTRANCE_MS);
  }, []);
  const leave = useCallback((key: string, from: number, then: () => void) => {
    clearTimeout(timer.current);
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setEntrance(null);
      then();
      return;
    }
    setEntrance({ kind: "less", key, from });
    timer.current = setTimeout(() => {
      setEntrance(null);
      then();
    }, LEAVE_MS);
  }, []);
  return { entrance, start, leave };
}

/**
 * The position of a row in its entrance (0 for the first to enter), or
 * `undefined` if it does not enter.
 */
export function entranceIndex(
  entrance: Entrance | null,
  key: string,
  index: number,
): number | undefined {
  if (entrance === null || entrance.kind === "less") return undefined;
  if (entrance.kind === "panel") return index;
  return entrance.key === key && index >= entrance.from
    ? index - entrance.from
    : undefined;
}

/** Whether a row is leaving with «See less». */
export function isLeaving(
  entrance: Entrance | null,
  key: string,
  index: number,
): boolean {
  return (
    entrance?.kind === "less" && entrance.key === key && index >= entrance.from
  );
}

/**
 * The list of a brand grows and shrinks smoothly (docs/07 §1): with «See
 * more», from where its new rows start to its new height, while they fade
 * in; with «See less», down to where the leaving rows start, while they fade
 * out, and then they are removed. Measured on the rows themselves, so that
 * it is right whatever the width. Without motion when the system asks to
 * reduce it.
 */
export function useListHeight(
  list: RefObject<HTMLElement | null>,
  entrance: Entrance | null,
  key: string,
  count: number,
): void {
  useLayoutEffect(() => {
    const element = list.current;
    if (element === null) return;
    for (const animation of element.getAnimations()) animation.cancel();
    if (
      entrance === null ||
      entrance.kind === "panel" ||
      entrance.key !== key ||
      matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    const first = element.children[entrance.from];
    if (!(first instanceof HTMLElement)) return;
    const height = element.getBoundingClientRect().height;
    const start =
      first.getBoundingClientRect().top - element.getBoundingClientRect().top;
    const [from, to, duration] =
      entrance.kind === "more"
        ? [start, height, 320]
        : [height, start, LEAVE_MS];
    element.animate(
      [
        { height: `${String(from)}px`, overflowY: "clip" },
        { height: `${String(to)}px`, overflowY: "clip" },
      ],
      {
        duration,
        easing: "cubic-bezier(0.4, 0, 0.2, 1)",
        // «See less» keeps the list short until the rows are removed.
        fill: entrance.kind === "less" ? "forwards" : "none",
      },
    );
  }, [list, entrance, key, count]);
}
