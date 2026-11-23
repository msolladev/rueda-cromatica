/**
 * Transcribes the Arcturus5404/miniature-paints tables of The Army Painter
 * and of Citadel into `data/sources/arcturus5404-miniature-paints.json` and
 * proposes its new paints (docs/04 §7). Run on demand, never in the CI:
 *
 *   pnpm --filter @chromatic-wheel/catalog-builder import-arcturus
 *
 * The files are fetched at the commit pinned in the source's `url`.
 */
import { sourceIdSchema } from "@chromatic-wheel/domain";
import { ARCTURUS_RULES, transcribeArcturus } from "../importers/arcturus.ts";
import { fileText, rowsOnly, runImport } from "./run-import.ts";

process.exitCode = await runImport({
  sourceId: sourceIdSchema.parse("arcturus5404-miniature-paints"),
  transcribe: (files) => rowsOnly(transcribeArcturus(files.map(fileText))),
  rules: ARCTURUS_RULES,
});
