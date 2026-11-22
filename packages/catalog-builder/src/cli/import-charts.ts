/**
 * Transcribes the three conversion charts into `data/sources/` and adds their
 * keys to the curated paints (ADR-0033, docs/04 §7): Vallejo CC266, the
 * Warpaints Fanatic Conversion Chart of The Army Painter and the equivalence
 * table of AK Interactive. Run on demand, never in the CI:
 *
 *   pnpm --filter @chromatic-wheel/catalog-builder import-charts
 *
 * Each chart is fetched from the `url` of its source, so a new revision is
 * taken by changing that URL in the source file.
 */
import { err, sourceIdSchema, type Result } from "@chromatic-wheel/domain";
import { transcribeAk3GenEquivalences } from "../importers/ak-3gen-equivalences.ts";
import type { Transcription } from "../importers/chart.ts";
import type { KeyRules } from "../importers/chart-keys.ts";
import { transcribeFanaticChart } from "../importers/fanatic-conversion-chart.ts";
import type { PdfText } from "../importers/pdf-text.ts";
import { transcribeCc266 } from "../importers/vallejo-cc266.ts";
import { readPdfText } from "./pdf.ts";
import { runImport, type FetchedFile } from "./run-import.ts";

/** A three-digit code of the chart, as the manufacturer code of a range. */
const prefixed =
  (prefix: string) =>
  (literal: string): string | null =>
    /^\d{3}$/.test(literal) ? `${prefix}.${literal}` : null;

const same = (literal: string): string => literal;

const CITADEL = { brandId: "citadel", by: "name" } as const;

/** One PDF per chart, read and transcribed. */
const fromPdf =
  (transcribe: (pdf: PdfText) => Result<Transcription, readonly string[]>) =>
  async (
    files: readonly FetchedFile[],
  ): Promise<Result<Transcription, readonly string[]>> => {
    const [file, ...rest] = files;
    if (file === undefined || rest.length > 0) {
      return err([`Expected one PDF, got ${String(files.length)} files`]);
    }
    return transcribe(await readPdfText(file.bytes));
  };

const CHARTS: readonly {
  readonly sourceId: string;
  readonly transcribe: (
    pdf: PdfText,
  ) => Result<Transcription, readonly string[]>;
  readonly keys: KeyRules;
}[] = [
  {
    sourceId: "vallejo-cc266",
    transcribe: transcribeCc266,
    keys: {
      "Game Color": { brandId: "vallejo", by: "code", code: same },
      "Game Color Wash": { brandId: "vallejo", by: "code", code: same },
      "Xpress Color": { brandId: "vallejo", by: "code", code: same },
      Citadel: CITADEL,
    },
  },
  {
    sourceId: "the-army-painter-fanatic-conversion-chart",
    transcribe: transcribeFanaticChart,
    keys: {
      "Warpaints Fanatic": {
        brandId: "the-army-painter",
        rangeIds: ["the-army-painter/warpaints-fanatic"],
        by: "name",
      },
      "Citadel by Games Workshop": CITADEL,
    },
  },
  {
    sourceId: "ak-interactive-3gen-equivalence-table",
    transcribe: transcribeAk3GenEquivalences,
    keys: {
      "AK 3G": {
        brandId: "ak-interactive",
        rangeIds: ["ak-interactive/3gen-acrylics"],
        by: "code",
        code: same,
      },
      "Vallejo MC": {
        brandId: "vallejo",
        rangeIds: ["vallejo/model-color"],
        by: "code",
        code: prefixed("70"),
      },
      "Vallejo GC": {
        brandId: "vallejo",
        rangeIds: ["vallejo/game-color"],
        by: "code",
        code: prefixed("72"),
      },
      "New Citadel": CITADEL,
    },
  },
];

for (const chart of CHARTS) {
  const code = await runImport({
    sourceId: sourceIdSchema.parse(chart.sourceId),
    transcribe: fromPdf(chart.transcribe),
    rules: null,
    keys: chart.keys,
  });
  if (code !== 0) {
    process.exitCode = code;
    break;
  }
}
