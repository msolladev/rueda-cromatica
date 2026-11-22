/**
 * Transcribes the Arcturus5404/miniature-paints table of The Army Painter
 * into `data/sources/arcturus5404-miniature-paints.json` and proposes its new
 * paints (docs/04 §7). Run on demand, never in the CI:
 *
 *   pnpm --filter @chromatic-wheel/catalog-builder import-arcturus
 *
 * The file is fetched at the commit pinned in the source's `url`.
 */
import { err, sourceIdSchema } from "@chromatic-wheel/domain";
import { ARCTURUS_RULES, transcribeArcturus } from "../importers/arcturus.ts";
import { fileText, rowsOnly, runImport } from "./run-import.ts";

process.exitCode = await runImport({
  sourceId: sourceIdSchema.parse("arcturus5404-miniature-paints"),
  transcribe: ([file, ...rest]) =>
    file === undefined || rest.length > 0
      ? err(["Expected the one file of the source"])
      : rowsOnly(transcribeArcturus(fileText(file))),
  rules: ARCTURUS_RULES,
});
