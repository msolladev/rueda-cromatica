/**
 * Search index over the catalog (docs/06 §5): each candidate paint with its
 * brand and its colour already converted to CIELAB, so a search only computes
 * the ΔE. Built once per catalog.
 */
import { modeLab65, modeRgb, useMode, type Lab65 } from "culori/fn";
import type { Catalog } from "../catalog/catalog.ts";
import type { Brand, HexColor, Paint } from "../catalog/schema.ts";

// CIELAB with the D65 white point, the space CIEDE2000 works in. `modeRgb`
// registers the hex parser.
const toLab = useMode(modeLab65);
useMode(modeRgb);

export interface IndexedPaint {
  readonly paint: Paint;
  readonly brand: Brand;
  readonly lab: Lab65;
}

export interface BrandEntries {
  readonly brand: Brand;
  readonly paints: readonly IndexedPaint[];
}

/**
 * The search index of a catalog, built by {@link buildPaintIndex}. It is
 * opaque: only {@link findClosestPaints} reads it.
 */
export interface PaintIndex {
  /**
   * Every brand of the catalog, in catalog order, each with its paints by ID.
   *
   * @internal
   */
  readonly brands: readonly BrandEntries[];
}

/**
 * Builds the search index of a catalog: every paint with a colour, its colour
 * already converted to CIELAB, discontinued ones included, because the search
 * filters them. Paints without colour never reach a search.
 *
 * Build it once per catalog, when it is loaded, and reuse it in every search.
 */
export function buildPaintIndex(catalog: Catalog): PaintIndex {
  const brands = catalog.brands().map((brand): BrandEntries =>
    Object.freeze({
      brand,
      paints: Object.freeze(
        catalog
          .paints({ brandIds: [brand.id], includeDiscontinued: true })
          .flatMap((paint) => {
            if (paint.color === null) return [];
            return [
              Object.freeze({ paint, brand, lab: labOf(paint.color.hex) }),
            ];
          }),
      ),
    }),
  );
  return Object.freeze({ brands: Object.freeze(brands) });
}

/** Only for hex strings already validated as `#rrggbb`. */
export function labOf(hex: HexColor | string): Lab65 {
  const lab = toLab(hex);
  if (lab === undefined) throw new Error(`Unreadable hex ${hex}`);
  return lab;
}
