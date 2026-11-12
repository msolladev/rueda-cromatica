/**
 * Imports the Citadel paints from the SimoGecko/CitadelColours table into
 * `data/brands/citadel.json` (docs/04 §4). Run on demand, never in the CI:
 *
 *   pnpm --filter @rueda-cromatica/catalog-builder import-simogecko
 *
 * The table is fetched at the commit pinned in the source's `url`, so a new
 * revision is taken by changing that URL in `sources.json`.
 */
import { importSimoGecko } from "../importers/simogecko.ts";
import { rawUrl, runImport } from "./run-import.ts";

process.exitCode = await runImport({
  sourceId: "simogecko-citadel-colours",
  brandId: "citadel",
  fileUrl: (pinned) => rawUrl(pinned),
  read: importSimoGecko,
});
