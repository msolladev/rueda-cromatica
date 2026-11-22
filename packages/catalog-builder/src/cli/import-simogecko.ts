/**
 * Transcribes the SimoGecko/CitadelColours table into
 * `data/sources/simogecko-citadel-colours.json` and proposes the new Citadel
 * paints (docs/04 §7). Run on demand, never in the CI:
 *
 *   pnpm --filter @chromatic-wheel/catalog-builder import-simogecko
 *
 * The table is fetched at the commit pinned in the source's `url`, so a new
 * revision is taken by changing that URL in the source file.
 */
import { sourceIdSchema } from "@chromatic-wheel/domain";
import {
  SIMOGECKO_RULES,
  transcribeSimoGecko,
} from "../importers/simogecko.ts";
import { rawUrl, runImport } from "./run-import.ts";

process.exitCode = await runImport({
  sourceId: sourceIdSchema.parse("simogecko-citadel-colours"),
  fileUrls: (pinned) => [rawUrl(pinned)],
  transcribe: (files) =>
    transcribeSimoGecko(files.map((f) => f.text).join("\n")),
  rules: SIMOGECKO_RULES,
});
