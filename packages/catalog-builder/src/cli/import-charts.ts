/**
 * Transcribes the three conversion charts into `data/sources/` and adds their
 * keys to the curated paints (ADR-0033, docs/04 §7): Vallejo CC266, the
 * Warpaints Fanatic Conversion Chart of The Army Painter and the equivalence
 * table of AK Interactive. Run on demand, never in the CI:
 *
 *   pnpm --filter @chromatic-wheel/catalog-builder import-charts
 *
 * Each chart is fetched from the `url` of its source, so a new revision is
 * taken by changing that URL in the source file.
 */
import { runImports } from "./run-import.ts";

await runImports([
  "vallejo-cc266",
  "the-army-painter-fanatic-conversion-chart",
  "ak-interactive-3gen-equivalence-table",
]);
