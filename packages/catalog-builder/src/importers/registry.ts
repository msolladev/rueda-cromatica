/**
 * The importer of each source that is imported again (docs/04 §7): how its
 * files arrive, how they are transcribed and the rules that propose paints or
 * keys. Pure: the files arrive already fetched and read, as text or as the
 * text of a PDF; fetching them and reading a PDF are left to whoever runs the
 * import (today, `cli/run-import.ts`).
 */
import { err, ok, type Result } from "@chromatic-wheel/domain";
import type { SourceRow } from "../model/curated.ts";
import {
  AK_3GEN_KEYS,
  transcribeAk3GenEquivalences,
} from "./ak-3gen-equivalences.ts";
import { ARCTURUS_RULES, transcribeArcturus } from "./arcturus.ts";
import type { Transcription } from "./chart.ts";
import type { KeyRules } from "./chart-keys.ts";
import { DONNERVS_RULES, transcribeDonnervS } from "./donnervs.ts";
import {
  FANATIC_CHART_KEYS,
  transcribeFanaticChart,
} from "./fanatic-conversion-chart.ts";
import {
  GAMES_WORKSHOP_RULES,
  transcribeChecklist2004,
  transcribeFoundationPage,
  transcribeWashesPage,
} from "./games-workshop.ts";
import type { PdfText } from "./pdf-text.ts";
import type { ProposalRules } from "./reconcile.ts";
import {
  SIMOGECKO_RULES,
  transcribeSimoGecko,
  transcribeSimoGeckoSampled,
} from "./simogecko.ts";
import { CC266_KEYS, transcribeCc266 } from "./vallejo-cc266.ts";

/** A file of a source published as text: its URL and its text. */
export interface TextFile {
  readonly name: string;
  readonly text: string;
}

export type Transcribed = Result<Transcription, readonly string[]>;

export type SourceImporter = {
  /** `null` for a source that never proposes paints (see `reconcile`). */
  readonly rules: ProposalRules | null;
  /** For a chart: how its rows find their curated paint (`proposeKeys`). */
  readonly keys: KeyRules | null;
} & (
  | {
      readonly format: "text";
      readonly transcribe: (files: readonly TextFile[]) => Transcribed;
    }
  | {
      readonly format: "pdf";
      readonly transcribe: (pdfs: readonly PdfText[]) => Transcribed;
    }
);

/** The transcription of a source that only has rows, not equivalences. */
const rowsOnly = (
  rows: Result<readonly SourceRow[], readonly string[]>,
): Transcribed =>
  rows.ok ? ok({ paints: rows.value, equivalences: [] }) : rows;

/** A source of a single file. */
const one =
  <T>(transcribe: (file: T) => Transcribed) =>
  (files: readonly T[]): Transcribed => {
    const [file, ...rest] = files;
    return file === undefined || rest.length > 0
      ? err([`Expected one file, got ${String(files.length)}`])
      : transcribe(file);
  };

const allText = (files: readonly TextFile[]): string =>
  files.map(({ text }) => text).join("\n");

/** The importer of each source, by its ID. */
const IMPORTERS: Readonly<Record<string, SourceImporter>> = {
  "simogecko-citadel-colours": {
    format: "text",
    transcribe: (files) => rowsOnly(transcribeSimoGecko(allText(files))),
    rules: SIMOGECKO_RULES,
    keys: null,
  },
  "simogecko-citadel-colours-sampled": {
    format: "text",
    transcribe: (files) => rowsOnly(transcribeSimoGeckoSampled(allText(files))),
    rules: null,
    keys: null,
  },
  "donnervs-miniature-paints": {
    format: "text",
    transcribe: (files) => {
      try {
        return rowsOnly(
          transcribeDonnervS(
            files.map(({ name, text }) => ({
              name,
              content: JSON.parse(text) as unknown,
            })),
          ),
        );
      } catch (error) {
        return err([`Invalid JSON: ${String(error)}`]);
      }
    },
    rules: DONNERVS_RULES,
    keys: null,
  },
  "arcturus5404-miniature-paints": {
    format: "text",
    transcribe: (files) =>
      rowsOnly(transcribeArcturus(files.map(({ text }) => text))),
    rules: ARCTURUS_RULES,
    keys: null,
  },
  "games-workshop-paints-inks-checklist-2004": {
    format: "pdf",
    transcribe: one((pdf) => rowsOnly(transcribeChecklist2004(pdf))),
    rules: GAMES_WORKSHOP_RULES,
    keys: null,
  },
  "games-workshop-foundation-paints-2008": {
    format: "text",
    transcribe: one(({ text }) => rowsOnly(transcribeFoundationPage(text))),
    rules: GAMES_WORKSHOP_RULES,
    keys: null,
  },
  "games-workshop-citadel-washes-2008": {
    format: "text",
    transcribe: one(({ text }) => rowsOnly(transcribeWashesPage(text))),
    rules: GAMES_WORKSHOP_RULES,
    keys: null,
  },
  "vallejo-cc266": {
    format: "pdf",
    transcribe: one(transcribeCc266),
    rules: null,
    keys: CC266_KEYS,
  },
  "the-army-painter-fanatic-conversion-chart": {
    format: "pdf",
    transcribe: one(transcribeFanaticChart),
    rules: null,
    keys: FANATIC_CHART_KEYS,
  },
  "ak-interactive-3gen-equivalence-table": {
    format: "pdf",
    transcribe: one(transcribeAk3GenEquivalences),
    rules: null,
    keys: AK_3GEN_KEYS,
  },
};

/** The importer of a source, or `null` if it is not imported again. */
export const importerOf = (sourceId: string): SourceImporter | null =>
  IMPORTERS[sourceId] ?? null;
