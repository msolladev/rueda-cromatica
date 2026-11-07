/** Derived rules over catalog entities (docs/01 §5). */
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
 * Whether the hex is only an approximation of the real paint (ADR-0014).
 * A paint without colour is not approximate: it has no colour to compare.
 */
export function isColorApproximate(paint: Paint): boolean {
  if (paint.color === null) return false;
  return (
    paint.metallic ||
    APPROXIMATE_TYPES.has(paint.type) ||
    paint.color.origin === "community"
  );
}

/**
 * Follows the replacement chain of `id` up to an active paint or to the end of
 * the chain, and returns that paint. Returns `null` if the paint has no
 * replacement (active, or discontinued without one).
 *
 * Throws for an ID that is not in the catalog: callers resolve IDs with
 * `catalog.paint()` first. Always terminates, because `parseCatalog` rejects
 * cycles; the guard only turns a broken invariant into an error.
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
