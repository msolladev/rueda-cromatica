// Where the name of each mark goes (docs/05 §6.2): just inside the ring, on
// the line of its mark. Names whose boxes would touch are stacked together
// at their mean hue, so that close marks (the base, its shadow and its light,
// or every color of a monochromatic harmony) never overlap. Pure functions;
// the component measures the names and moves their elements.

import { normalizeHue } from "../color/rgb.ts";
import { pointAt, type Point } from "./geometry.ts";

/** A name to place: the hue of its mark and the size of its box, in pixels. */
export interface MarkLabel {
  readonly hue: number;
  readonly width: number;
  readonly height: number;
}

/** Space between two stacked names and around each group, in pixels. */
const GAP = 2;

interface Group {
  readonly members: readonly number[];
  readonly hue: number;
  readonly width: number;
  readonly height: number;
  readonly center: Point;
}

/** The mean of some hues, along the circle. */
function meanHue(hues: readonly number[]): number {
  let x = 0;
  let y = 0;
  for (const hue of hues) {
    const angle = (hue * Math.PI) / 180;
    x += Math.sin(angle);
    y += Math.cos(angle);
  }
  const mean = (Math.atan2(x, y) * 180) / Math.PI;
  return normalizeHue(mean);
}

function group(
  members: readonly number[],
  labels: readonly MarkLabel[],
  limit: number,
): Group {
  const boxes = members.map((index) => labels[index]);
  const width = Math.max(...boxes.map((box) => box?.width ?? 0));
  const height =
    boxes.reduce((sum, box) => sum + (box?.height ?? 0), 0) +
    GAP * (boxes.length - 1);
  const hue = meanHue(boxes.map((box) => box?.hue ?? 0));
  const direction = pointAt(hue, 1);
  // The box's farthest corner along its direction touches the limit.
  const extent =
    (Math.abs(direction.x) * width + Math.abs(direction.y) * height) / 2;
  const distance = Math.max(0, limit - extent);
  return {
    members,
    hue,
    width,
    height,
    center: { x: direction.x * distance, y: direction.y * distance },
  };
}

function overlap(a: Group, b: Group): boolean {
  return (
    Math.abs(a.center.x - b.center.x) < (a.width + b.width) / 2 + GAP &&
    Math.abs(a.center.y - b.center.y) < (a.height + b.height) / 2 + GAP
  );
}

/**
 * The center of each name, relative to the center of the wheel, in the same
 * order as `labels`. `limit` is the radius that no box crosses: the inner
 * edge of the ring.
 */
export function placeMarkLabels(
  labels: readonly MarkLabel[],
  limit: number,
): Point[] {
  let groups = labels.map((_, index) => group([index], labels, limit));
  // Joins two groups that touch until none do; at most one join per name.
  for (;;) {
    let joined = false;
    outer: for (let i = 0; i < groups.length; i += 1) {
      for (let j = i + 1; j < groups.length; j += 1) {
        const a = groups[i];
        const b = groups[j];
        if (a === undefined || b === undefined || !overlap(a, b)) continue;
        const members = [...a.members, ...b.members].sort((x, y) => x - y);
        groups = groups.filter((_, k) => k !== i && k !== j);
        groups.push(group(members, labels, limit));
        joined = true;
        break outer;
      }
    }
    if (!joined) break;
  }
  const centers: Point[] = labels.map(() => ({ x: 0, y: 0 }));
  for (const { members, center, height } of groups) {
    // Stacked from the top, in the order of the colors.
    let top = center.y - height / 2;
    for (const index of members) {
      const box = labels[index];
      if (box === undefined) continue;
      centers[index] = { x: center.x, y: top + box.height / 2 };
      top += box.height + GAP;
    }
  }
  return centers;
}
