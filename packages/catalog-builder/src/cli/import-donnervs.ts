/**
 * Transcribes the DonnervS/miniature-paints files of the brands in the
 * catalogue into `data/sources/donnervs-miniature-paints.json` and proposes
 * their new paints (docs/04 §7). Run on demand, never in the CI:
 *
 *   pnpm --filter @chromatic-wheel/catalog-builder import-donnervs
 *
 * The files are fetched at the commit pinned in the source's `url`.
 */
import { runImports } from "./run-import.ts";

await runImports(["donnervs-miniature-paints"]);
