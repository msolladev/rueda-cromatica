/**
 * Transcribes the old documents of Games Workshop that prove each
 * discontinued Citadel line (ADR-0035) into `data/sources/` and proposes
 * their new paints (docs/04 §7): the paints and inks checklist of 2004 and the
 * Foundation and Washes pages of 2008. Run on demand, never in the CI:
 *
 *   pnpm --filter @chromatic-wheel/catalog-builder import-games-workshop
 *
 * Their originals are gone: each file is read from the capture of the
 * Wayback Machine listed in `src/importers/source-files.ts`. The conversion chart
 * of 2012 is an image, transcribed by hand, and is not here.
 */
import { runImports } from "./run-import.ts";

await runImports([
  "games-workshop-paints-inks-checklist-2004",
  "games-workshop-foundation-paints-2008",
  "games-workshop-citadel-washes-2008",
]);
