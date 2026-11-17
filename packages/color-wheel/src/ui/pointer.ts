// Mouse, pen and touch on the wheel, with Pointer Events (docs/05 §6.2).
//
// - Mouse and pen: the point goes where the pointer is.
// - Touch: the point does not jump under the finger. It moves as much as the
//   finger moves, wherever the finger is, so it stays visible. A tap without
//   movement does place the point where it lands, for big jumps.

import { normalizeHue } from "../color/rgb.ts";
import type { WheelColor } from "../color/wheel-color.ts";
import { WHEEL_SCALE } from "./draw.ts";
import {
  hueAt,
  proportionsAt,
  trianglePoint,
  zoneAt,
  type Point,
  type Zone,
} from "./geometry.ts";

/** How far a finger can move, in CSS pixels, and still be a tap. */
const TAP_SLOP = 6;

export interface PointerHandlers {
  readonly enabled: () => boolean;
  readonly position: () => WheelColor;
  /** A drag starts on `zone`. */
  readonly start: (zone: Zone) => void;
  /** The base moves during the drag. */
  readonly move: (position: WheelColor) => void;
  /** The drag ends, also when the browser cancels it. */
  readonly end: () => void;
}

interface Drag {
  readonly pointerId: number;
  readonly zone: Zone;
  readonly relative: boolean;
  readonly startClient: Point;
  readonly startUnit: Point;
  readonly startPosition: WheelColor;
  moved: boolean;
}

export function attachPointer(
  canvas: HTMLCanvasElement,
  handlers: PointerHandlers,
  signal: AbortSignal,
): void {
  let drag: Drag | undefined;

  const toUnit = (event: PointerEvent): Point => {
    const rect = canvas.getBoundingClientRect();
    const half = rect.width / 2;
    const radius = half * WHEEL_SCALE;
    return {
      x: (event.clientX - rect.left - half) / radius,
      y: (event.clientY - rect.top - half) / radius,
    };
  };

  const finish = (event: PointerEvent) => {
    if (drag?.pointerId !== event.pointerId) return;
    if (event.type === "pointerup" && drag.relative && !drag.moved) {
      handlers.move(placeAt(drag.zone, drag.startUnit, drag.startPosition));
    }
    drag = undefined;
    handlers.end();
  };

  canvas.addEventListener(
    "pointerdown",
    (event) => {
      if (drag !== undefined || !handlers.enabled()) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;
      const unit = toUnit(event);
      const position = handlers.position();
      const zone = zoneAt(unit, position.hue);
      if (zone === undefined) return;
      event.preventDefault();
      canvas.setPointerCapture(event.pointerId);
      drag = {
        pointerId: event.pointerId,
        zone,
        relative: event.pointerType === "touch",
        startClient: { x: event.clientX, y: event.clientY },
        startUnit: unit,
        startPosition: position,
        moved: false,
      };
      handlers.start(zone);
      if (!drag.relative) handlers.move(placeAt(zone, unit, position));
    },
    { signal },
  );

  canvas.addEventListener(
    "pointermove",
    (event) => {
      if (drag?.pointerId !== event.pointerId) return;
      const unit = toUnit(event);
      if (!drag.relative) {
        handlers.move(placeAt(drag.zone, unit, drag.startPosition));
        return;
      }
      if (!drag.moved) {
        const moved = Math.hypot(
          event.clientX - drag.startClient.x,
          event.clientY - drag.startClient.y,
        );
        if (moved < TAP_SLOP) return;
        drag.moved = true;
      }
      handlers.move(moveBy(drag, unit));
    },
    { signal },
  );

  canvas.addEventListener("pointerup", finish, { signal });
  canvas.addEventListener("pointercancel", finish, { signal });
  canvas.addEventListener("lostpointercapture", finish, { signal });
}

/** The base placed at `unit`: absolute positioning. */
function placeAt(zone: Zone, unit: Point, position: WheelColor): WheelColor {
  return zone === "ring"
    ? { ...position, hue: hueAt(unit) }
    : { hue: position.hue, ...proportionsAt(unit, position.hue) };
}

/** The base moved as much as the finger: relative positioning. */
function moveBy(drag: Drag, unit: Point): WheelColor {
  const start = drag.startPosition;
  if (drag.zone === "ring") {
    const turn = hueAt(unit) - hueAt(drag.startUnit);
    return { ...start, hue: normalizeHue(start.hue + turn) };
  }
  const origin = trianglePoint(start);
  const target = {
    x: origin.x + unit.x - drag.startUnit.x,
    y: origin.y + unit.y - drag.startUnit.y,
  };
  return { hue: start.hue, ...proportionsAt(target, start.hue) };
}
