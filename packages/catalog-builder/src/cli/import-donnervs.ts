/**
 * Transcribes the DonnervS/miniature-paints files of the brands in the
 * catalogue into `data/sources/donnervs-miniature-paints.json` and proposes
 * their new paints (docs/04 §7). Run on demand, never in the CI:
 *
 *   pnpm --filter @chromatic-wheel/catalog-builder import-donnervs
 *
 * The files are fetched at the commit pinned in the source's `url`.
 */
import { err, sourceIdSchema } from "@chromatic-wheel/domain";
import { DONNERVS_RULES, transcribeDonnervS } from "../importers/donnervs.ts";
import { fileText, rowsOnly, runImport } from "./run-import.ts";

process.exitCode = await runImport({
  sourceId: sourceIdSchema.parse("donnervs-miniature-paints"),
  transcribe: (files) => {
    try {
      return rowsOnly(
        transcribeDonnervS(
          files.map((file) => ({
            name: file.name,
            content: JSON.parse(fileText(file)) as unknown,
          })),
        ),
      );
    } catch (error) {
      return err([`Invalid JSON: ${String(error)}`]);
    }
  },
  rules: DONNERVS_RULES,
});
