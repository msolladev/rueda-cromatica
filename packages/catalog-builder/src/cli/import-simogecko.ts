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
import { sourceIdSchema } from "@chromatic-wheel/domain";
import {
  SIMOGECKO_RULES,
  transcribeSimoGecko,
  transcribeSimoGeckoSampled,
} from "../importers/simogecko.ts";
import { rawUrl, runImport } from "./run-import.ts";

const join = (files: readonly { readonly text: string }[]): string =>
  files.map((f) => f.text).join("\n");

process.exitCode =
  (await runImport({
    sourceId: sourceIdSchema.parse("simogecko-citadel-colours"),
    fileUrls: (pinned) => [rawUrl(pinned)],
    transcribe: (files) => transcribeSimoGecko(join(files)),
    rules: SIMOGECKO_RULES,
  })) ||
  (await runImport({
    sourceId: sourceIdSchema.parse("simogecko-citadel-colours-sampled"),
    fileUrls: (pinned) => [rawUrl(pinned)],
    transcribe: (files) => transcribeSimoGeckoSampled(join(files)),
    rules: null,
  }));
