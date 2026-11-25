/**
 * Transcribes the two SimoGecko/CitadelColours tables into `data/sources/`
 * (`simogecko-citadel-colours.json`, the official one, and
 * `simogecko-citadel-colours-sampled.json`) and proposes the new Citadel
 * paints of the official one (docs/04 §7); the sampled one proposes none. Run on demand, never in the CI:
 *
 *   pnpm --filter @chromatic-wheel/catalog-builder import-simogecko
 *
 * Each table is fetched at the commit pinned in its source's `url`, so a new
 * revision is taken by changing that URL in the source file.
 */
import { runImports } from "./run-import.ts";

await runImports([
  "simogecko-citadel-colours",
  "simogecko-citadel-colours-sampled",
]);
