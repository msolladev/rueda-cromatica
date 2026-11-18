/** Derived rules over catalog entities (docs/01 §4). */
import type { Catalog } from "./catalog.ts";
import type { Paint, PaintId, PaintType } from "./schema.ts";

const APPROXIMATE_TYPES: ReadonlySet<PaintType> = new Set([
  "wash",
  "ink",
  "glaze",
  "contrast",
  "technical",
]);

/**
 * Why a paint's hex is only an approximation of the real paint (ADR-0014):
 *
 * - `"metallic"`: the paint is metallic;
 * - `"paint-type"`: its type is `wash`, `ink`, `glaze`, `contrast` or
 *   `technical`, which do not look like a flat colour;
 * - `"community-color"`: its hex is from the community, not measured or from
 *   the manufacturer.
 */
export type ApproximationReason = "metallic" | "paint-type" | "community-color";

/**
 * The reasons why the paint's hex is approximate, in the order of
 * {@link ApproximationReason}. Empty if it is not approximate, and always
 * empty for a paint without colour: it has no colour to compare.
 *
 * @example
 * ```ts
 * colorApproximationReasons(paint); // ["metallic", "community-color"]
 * ```
 */
export function colorApproximationReasons(
  paint: Paint,
): readonly ApproximationReason[] {
  if (paint.color === null) return [];
  const reasons: ApproximationReason[] = [];
  if (paint.metallic) reasons.push("metallic");
  if (APPROXIMATE_TYPES.has(paint.type)) reasons.push("paint-type");
  if (paint.color.origin === "community") reasons.push("community-color");
  return Object.freeze(reasons);
}

/**
 * Whether the hex is only an approximation of the real paint: whether
 * {@link colorApproximationReasons} gives any reason. A paint without colour
 * is not approximate.
 */
export function isColorApproximate(paint: Paint): boolean {
  return colorApproximationReasons(paint).length > 0;
}

/**
 * Follows the replacement chain of `id` up to an active paint or to the end of
 * the chain, and returns that paint. Returns `null` if the paint has no
 * replacement (active, or discontinued without one).
 *
 * Always terminates, because {@link parseCatalog} rejects cycles.
 *
 * @throws Error if `id` is not in the catalog, which is a programming error:
 *   callers resolve IDs with {@link Catalog.paint} first.
 */
export function resolveReplacement(
  catalog: Catalog,
  id: PaintId,
): Paint | null {
  let current = requirePaint(catalog, id);
  const visited = new Set<PaintId>([current.id]);
  while (
    current.status.kind === "discontinued" &&
    current.status.replacement !== null
  ) {
    const nextId = current.status.replacement.paintId;
    if (visited.has(nextId)) {
      throw new Error(
        `Catalog invariant broken: replacement cycle at ${nextId}`,
      );
    }
    visited.add(nextId);
    current = requirePaint(catalog, nextId);
  }
  return current.id === id ? null : current;
}

function requirePaint(catalog: Catalog, id: PaintId): Paint {
  const paint = catalog.paint(id);
  if (paint === undefined) {
    throw new Error(`Unknown paint: ${id}`);
  }
  return paint;
}
