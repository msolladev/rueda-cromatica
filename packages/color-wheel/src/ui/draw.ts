// Canvas drawing of the wheel (docs/05 §6.2): the hue ring, the triangle and
// the template. It draws in the unit coordinates of `geometry.ts`.

import { pureColor } from "../color/convert.ts";
import type { Model } from "../color/model.ts";
import { formatHexColor } from "../color/rgb.ts";
import type { WheelColor } from "../color/wheel-color.ts";
import {
  MARK_RADIUS,
  pointAt,
  RING_INNER,
  trianglePoint,
  triangleVertices,
  type Point,
  type Zone,
} from "./geometry.ts";

/** Outer radius of the ring relative to half the canvas: room for the focus. */
export const WHEEL_SCALE = 0.94;

export interface DrawInput {
  readonly model: Model;
  /**
   * The ring of the previous model, drawn over the new one with this
   * opacity while the model changes (docs/05 §6.2).
   */
  readonly previous?:
    { readonly model: Model; readonly opacity: number } | undefined;
  readonly position: WheelColor;
  /**
   * The hue of each mark of the template, the base first. While the
   * template moves it can have more marks than colors (docs/05 §6.2).
   */
  readonly template: readonly number[];
  /** The mark of the color highlighted by the page, if any. */
  readonly highlight?: number | undefined;
  /** The part with visible keyboard focus, if any. */
  readonly focus: Zone | undefined;
  readonly focusColor: string;
  /** Device pixels per CSS pixel. */
  readonly pixelRatio: number;
}

const HALO = "rgba(0, 0, 0, 0.7)";
const LINE = "#ffffff";

export function drawWheel(
  context: CanvasRenderingContext2D,
  input: DrawInput,
): void {
  const size = context.canvas.width;
  const half = size / 2;
  const radius = half * WHEEL_SCALE;
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, size, size);
  if (radius <= 0) return;
  context.setTransform(radius, 0, 0, radius, half, half);
  // One CSS pixel in unit coordinates.
  const px = input.pixelRatio / radius;

  drawRing(context, input.model);
  if (input.previous !== undefined && input.previous.opacity > 0) {
    context.globalAlpha = input.previous.opacity;
    drawRing(context, input.previous.model);
    context.globalAlpha = 1;
  }
  drawTriangle(context, input.model, input.position.hue);
  drawTemplate(context, input.template, px, input.highlight);
  drawBase(context, input.position, px);
  if (input.focus === "ring") {
    circle(context, { x: 0, y: 0 }, 1 + 3 * px);
    context.lineWidth = 2 * px;
    context.strokeStyle = input.focusColor;
    context.stroke();
  } else if (input.focus === "triangle") {
    trianglePath(context, triangleVertices(input.position.hue));
    context.lineWidth = 3 * px;
    context.strokeStyle = input.focusColor;
    context.stroke();
  }
  context.setTransform(1, 0, 0, 1, 0, 0);
}

/** The ring: a conic gradient through the six corners, exact in both models. */
function drawRing(context: CanvasRenderingContext2D, model: Model): void {
  const gradient = context.createConicGradient(-Math.PI / 2, 0, 0);
  for (let corner = 0; corner <= 6; corner += 1) {
    const hue = (corner * 60) % 360;
    gradient.addColorStop(corner / 6, formatHexColor(pureColor(hue, model)));
  }
  context.beginPath();
  context.arc(0, 0, 1, 0, 2 * Math.PI);
  context.arc(0, 0, RING_INNER, 0, 2 * Math.PI, true);
  context.fillStyle = gradient;
  context.fill("evenodd");
}

/**
 * The triangle: black, plus the pure color and white added as linear
 * gradients from each vertex to the opposite side. In an equilateral triangle
 * each gradient is that vertex's barycentric weight, so the result is the
 * linear sum of docs/05 §2.
 */
function drawTriangle(
  context: CanvasRenderingContext2D,
  model: Model,
  hue: number,
): void {
  const vertices = triangleVertices(hue);
  const [pure, white, black] = vertices;
  const pureHex = formatHexColor(pureColor(hue, model));
  context.save();
  trianglePath(context, vertices);
  context.clip();
  context.fillStyle = "#000000";
  context.fillRect(-1, -1, 2, 2);
  context.globalCompositeOperation = "lighter";
  context.fillStyle = vertexGradient(context, pure, white, black, pureHex);
  context.fillRect(-1, -1, 2, 2);
  context.fillStyle = vertexGradient(context, white, pure, black, "#ffffff");
  context.fillRect(-1, -1, 2, 2);
  context.restore();
}

function vertexGradient(
  context: CanvasRenderingContext2D,
  vertex: Point,
  a: Point,
  b: Point,
  hex: string,
): CanvasGradient {
  const gradient = context.createLinearGradient(
    vertex.x,
    vertex.y,
    (a.x + b.x) / 2,
    (a.y + b.y) / 2,
  );
  gradient.addColorStop(0, hex);
  gradient.addColorStop(1, `${hex}00`);
  return gradient;
}

/** Lines from the center to a mark on the ring for each color. */
function drawTemplate(
  context: CanvasRenderingContext2D,
  template: readonly number[],
  px: number,
  highlight: number | undefined,
): void {
  // The highlighted mark, an outer ring around it.
  const highlighted = highlight === undefined ? undefined : template[highlight];
  if (highlighted !== undefined) {
    circle(
      context,
      pointAt(highlighted, MARK_RADIUS),
      (highlight === 0 ? 14 : 11) * px,
    );
    haloStroke(context, px, 2.5);
  }
  // The base last, so that it stays on top.
  const ordered = template.map((hue, index) => ({ hue, isBase: index === 0 }));
  ordered.push(...ordered.splice(0, 1));
  for (const { hue, isBase } of ordered) {
    const mark = pointAt(hue, MARK_RADIUS);
    context.setLineDash(isBase ? [] : [6 * px, 5 * px]);
    context.beginPath();
    context.moveTo(0, 0);
    context.lineTo(mark.x, mark.y);
    haloStroke(context, px, 1.5);
    context.setLineDash([]);
    circle(context, mark, (isBase ? 9 : 6) * px);
    haloStroke(context, px, isBase ? 2.5 : 1.5);
  }
  circle(context, { x: 0, y: 0 }, 3 * px);
  context.fillStyle = LINE;
  context.fill();
}

/** The point of the triangle that marks the base. */
function drawBase(
  context: CanvasRenderingContext2D,
  position: WheelColor,
  px: number,
): void {
  circle(context, trianglePoint(position), 7 * px);
  haloStroke(context, px, 2.5);
}

/** A white line with a dark halo, visible on any color. */
function haloStroke(
  context: CanvasRenderingContext2D,
  px: number,
  width: number,
): void {
  context.lineWidth = (width + 2) * px;
  context.strokeStyle = HALO;
  context.stroke();
  context.lineWidth = width * px;
  context.strokeStyle = LINE;
  context.stroke();
}

function circle(
  context: CanvasRenderingContext2D,
  center: Point,
  radius: number,
): void {
  context.beginPath();
  context.arc(center.x, center.y, radius, 0, 2 * Math.PI);
}

function trianglePath(
  context: CanvasRenderingContext2D,
  [a, b, c]: readonly [Point, Point, Point],
): void {
  context.beginPath();
  context.moveTo(a.x, a.y);
  context.lineTo(b.x, b.y);
  context.lineTo(c.x, c.y);
  context.closePath();
}
