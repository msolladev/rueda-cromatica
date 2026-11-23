/**
 * Transcribes the old documents of Games Workshop that prove each
 * discontinued Citadel line (ADR-0035) into `data/sources/` and proposes
 * their new paints (docs/04 §7): the paints and inks checklist of 2004 and the
 * Foundation and Washes pages of 2008. Run on demand, never in the CI:
 *
 *   pnpm --filter @chromatic-wheel/catalog-builder import-games-workshop
 *
 * Their originals are gone: each file is read from the capture of the
 * Wayback Machine listed in `src/cli/source-files.ts`. The conversion chart
 * of 2012 is an image, transcribed by hand, and is not here.
 */
import {
  err,
  sourceIdSchema,
  type Result,
  type SourceId,
} from "@chromatic-wheel/domain";
import type { SourceRow } from "../curated/files.ts";
import {
  GAMES_WORKSHOP_RULES,
  transcribeChecklist2004,
  transcribeFoundationPage,
  transcribeWashesPage,
} from "../importers/games-workshop.ts";
import { readPdfText } from "./pdf.ts";
import {
  fileText,
  rowsOnly,
  runImport,
  type FetchedFile,
} from "./run-import.ts";

/** A source of one file, transcribed from its text. */
const oneText =
  (
    transcribe: (
      text: string,
    ) => Result<readonly SourceRow[], readonly string[]>,
  ) =>
  ([file, ...rest]: readonly FetchedFile[]) =>
    file === undefined || rest.length > 0
      ? err(["Expected the one file of the source"])
      : rowsOnly(transcribe(fileText(file)));

const DOCUMENTS: readonly {
  readonly sourceId: SourceId;
  readonly transcribe: Parameters<typeof runImport>[0]["transcribe"];
}[] = [
  {
    sourceId: sourceIdSchema.parse("games-workshop-paints-inks-checklist-2004"),
    transcribe: async ([file, ...rest]) =>
      file === undefined || rest.length > 0
        ? err(["Expected the one PDF of the source"])
        : rowsOnly(transcribeChecklist2004(await readPdfText(file.bytes))),
  },
  {
    sourceId: sourceIdSchema.parse("games-workshop-foundation-paints-2008"),
    transcribe: oneText(transcribeFoundationPage),
  },
  {
    sourceId: sourceIdSchema.parse("games-workshop-citadel-washes-2008"),
    transcribe: oneText(transcribeWashesPage),
  },
];

for (const document of DOCUMENTS) {
  const code = await runImport({
    sourceId: document.sourceId,
    transcribe: document.transcribe,
    rules: GAMES_WORKSHOP_RULES,
  });
  if (code !== 0) {
    process.exitCode = code;
    break;
  }
}
