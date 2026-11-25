/**
 * What the chart transcribers share (ADR-0033): a chart names each paint once
 * in `paints`, in the order it first appears, and lists its equivalences as
 * pairs of keys, in the chart's order and direction. Pure.
 */
import { err, ok, type Result } from "@chromatic-wheel/domain";
import type { EquivalenceRow, SourceRow } from "../model/curated.ts";

/** The literal transcription of a source. */
export interface Transcription {
  readonly paints: readonly SourceRow[];
  readonly equivalences: readonly EquivalenceRow[];
}

/** A paint named by a chart: no colour, only what the chart writes. */
export interface ChartPaint {
  readonly key: string;
  readonly group: string;
  readonly name: string;
  readonly code: string | null;
}

/** Collects the paints and equivalences of a chart, as it reads them. */
export interface ChartCollector {
  /** Adds a paint, unless it is already there, and returns its key. */
  readonly paint: (paint: ChartPaint) => string;
  /** Adds an equivalence `from → to`, in the chart's direction. */
  readonly equivalence: (from: string, to: string, note?: string) => void;
  readonly issue: (message: string) => void;
  /** The transcription, or every issue found. */
  readonly result: () => Result<Transcription, readonly string[]>;
}

/**
 * A paint named again keeps its first row; if the chart writes it differently
 * under the same key, that is an issue, never a silent pick.
 */
export function chartCollector(): ChartCollector {
  const paints = new Map<string, SourceRow>();
  const equivalences: EquivalenceRow[] = [];
  const issues: string[] = [];
  return {
    paint(paint) {
      const known = paints.get(paint.key);
      if (known === undefined) {
        paints.set(paint.key, {
          ...paint,
          hex: null,
          gradient: null,
          measuredHex: null,
          finish: null,
          colourless: false,
        });
      } else if (
        known.group !== paint.group ||
        known.name !== paint.name ||
        known.code !== paint.code
      ) {
        issues.push(`"${paint.key}" appears with different contents`);
      }
      return paint.key;
    },
    equivalence(from, to, note) {
      equivalences.push({ from, to, note: note ?? null });
    },
    issue(message) {
      issues.push(message);
    },
    result() {
      return issues.length > 0
        ? err(issues)
        : ok({ paints: [...paints.values()], equivalences });
    },
  };
}
