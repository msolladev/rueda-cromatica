import { useLayoutEffect, type RefObject } from "react";

/**
 * Measures the selected item of `group` and writes `--indicator-x`,
 * `--indicator-y`, `--indicator-w` and `--indicator-h` on it, with
 * `data-indicator` to say it is measured.
 */
function placeIndicator(group: HTMLElement, selector: string): void {
  const selected = group.querySelector<HTMLElement>(selector);
  if (selected === null) return;
  const sizes = {
    x: selected.offsetLeft,
    y: selected.offsetTop,
    w: selected.offsetWidth,
    h: selected.offsetHeight,
  };
  for (const [name, value] of Object.entries(sizes)) {
    group.style.setProperty(`--indicator-${name}`, `${String(value)}px`);
  }
  group.dataset["indicator"] = "";
}

/**
 * Places a sliding indicator under the selected item of a group (docs/07
 * §1): the CSS moves a single indicator to the measured place with a
 * transition, which works in every browser.
 *
 * Until it has measured (in the prerendered HTML, or without JavaScript) the
 * group has no `data-indicator`, and the CSS marks the selected item by
 * itself.
 */
export function useSlidingIndicator(
  group: RefObject<HTMLElement | null>,
  selector: string,
  selectedKey: unknown,
): void {
  useLayoutEffect(() => {
    const element = group.current;
    if (element === null) return;
    placeIndicator(element, selector);
    const observer = new ResizeObserver(() => {
      placeIndicator(element, selector);
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [group, selector, selectedKey]);
}
