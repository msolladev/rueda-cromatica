// Real input for the browser tests: mouse and touch events sent to Chromium
// through the DevTools protocol, so they go through the browser's own input
// pipeline, with real coordinates, as a person's would.

// Types of the Playwright provider: `cdp()` with the DevTools protocol.
import type {} from "@vitest/browser-playwright";
import { cdp } from "vitest/browser";

import { WHEEL_SCALE } from "../draw.ts";
import type { Point } from "../geometry.ts";

/** A client point of the page under test in the coordinates of the top page. */
function toTopPage({ x, y }: Point): Point {
  const frame = window.frameElement as HTMLElement | null;
  if (frame === null) return { x, y };
  const rect = frame.getBoundingClientRect();
  const scale = rect.width / frame.offsetWidth;
  return {
    x: rect.left + (frame.clientLeft + x) * scale,
    y: rect.top + (frame.clientTop + y) * scale,
  };
}

/** The client point of a unit point of the wheel (see `geometry.ts`). */
export function wheelPoint(canvas: HTMLCanvasElement, unit: Point): Point {
  const rect = canvas.getBoundingClientRect();
  const half = rect.width / 2;
  return {
    x: rect.left + half + unit.x * half * WHEEL_SCALE,
    y: rect.top + half + unit.y * half * WHEEL_SCALE,
  };
}

/** Presses the left button at the first point, moves through the rest and releases. */
export async function mouseDrag(points: readonly Point[]): Promise<void> {
  const page = points.map(toTopPage);
  const first = page[0];
  const last = page.at(-1);
  if (first === undefined || last === undefined) return;
  const send = (
    type: "mouseMoved" | "mousePressed" | "mouseReleased",
    { x, y }: Point,
    buttons: number,
  ) =>
    cdp().send("Input.dispatchMouseEvent", {
      type,
      x,
      y,
      button: "left",
      buttons,
      clickCount: 1,
    });
  await send("mouseMoved", first, 0);
  await send("mousePressed", first, 1);
  for (const point of page.slice(1)) await send("mouseMoved", point, 1);
  await send("mouseReleased", last, 0);
}

/** Touches the first point, slides through the rest and lifts the finger. */
export async function touchDrag(points: readonly Point[]): Promise<void> {
  const page = points.map(toTopPage);
  const first = page[0];
  if (first === undefined) return;
  await cdp().send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [first],
  });
  for (const point of page.slice(1)) {
    await cdp().send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [point],
    });
  }
  await cdp().send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
}
