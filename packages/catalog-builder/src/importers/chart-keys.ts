/**
 * Keys proposed for the rows of a chart (ADR-0033). A chart never proposes
 * paints: it names paints that are already curated, or rows to ignore. Each
 * new row that is neither a key nor ignored gets its key in the one paint
 * whose code, or whose name, matches exactly; anything else is left for
 * Miguel to decide (a typo, a paint in two ranges, a paint not in the
 * catalog). Only keys are added: no other field of a paint changes. Pure.
 */
import type { SourceId } from "@chromatic-wheel/domain";
import type { BrandFile, CuratedPaint, SourceRow } from "../curated/files.ts";
import { resolveKeys, type ResolveInput } from "../pipeline/resolve.ts";

/** Where the paints of a group are: a brand, or some of its ranges. */
interface Scope {
  readonly brandId: string;
  /** Only these ranges of the brand; all of them if absent. */
  readonly rangeIds?: readonly string[];
}

/** How the rows of a group of the chart find their paint. */
export type KeyRule =
  | (Scope & {
      readonly by: "code";
      /** The `manufacturerCode` of the row's code, or `null` if none. */
      readonly code: (literal: string) => string | null;
    })
  | (Scope & {
      /**
       * The name or an alias, letter for letter; the typographic apostrophe
       * (’) is the same letter as the straight one (').
       */
      readonly by: "name";
    });

const sameLetters = (name: string): string => name.replaceAll("’", "'");

/** The rule of each group; a group without a rule proposes nothing. */
export type KeyRules = Readonly<Record<string, KeyRule>>;

export interface KeyProposals {
  /** The brand files whose paints get keys, with their paints in place. */
  readonly brands: readonly BrandFile[];
  /** Each key added, by paint ID. */
  readonly added: readonly { readonly paintId: string; readonly key: string }[];
  /** Rows of a group with a rule that match no paint, or more than one. */
  readonly unmatched: readonly {
    readonly key: string;
    readonly candidates: readonly string[];
  }[];
}

export function proposeKeys(input: {
  readonly current: ResolveInput;
  readonly sourceId: SourceId;
  readonly rows: readonly SourceRow[];
  readonly rules: KeyRules;
}): KeyProposals {
  const { current, sourceId, rows, rules } = input;
  const sources = current.sources.map((s) =>
    s.source.id === sourceId ? { ...s, paints: rows } : s,
  );
  const { uncovered } = resolveKeys({ ...current, sources });
  const open = uncovered.filter((r) => r.sourceId === sourceId);

  const keyed = (paint: CuratedPaint): boolean =>
    paint.keys.some((k) => k.sourceId === sourceId);
  const matches = (rule: KeyRule, row: SourceRow, paint: CuratedPaint) => {
    if (rule.by === "name") {
      const name = sameLetters(row.name);
      return [paint.name, ...paint.aliases].some(
        (n) => sameLetters(n) === name,
      );
    }
    const code = row.code === null ? null : rule.code(row.code);
    return code !== null && paint.manufacturerCode === code;
  };

  // Each open row with its candidates; a paint claimed twice is unmatched.
  const claims = new Map<string, string[]>(); // paint ID → row keys
  const candidatesOf = new Map<string, readonly string[]>();
  for (const { row } of open) {
    const rule = rules[row.group];
    if (rule === undefined) continue;
    const brand = current.brands.find((b) => b.brand.id === rule.brandId);
    const candidates = (brand?.paints ?? [])
      .filter(
        (paint) =>
          (rule.rangeIds?.includes(paint.rangeId) ?? true) &&
          !keyed(paint) &&
          matches(rule, row, paint),
      )
      .map((paint) => paint.id);
    candidatesOf.set(row.key, candidates);
    const [only] = candidates;
    if (only !== undefined && candidates.length === 1) {
      claims.set(only, [...(claims.get(only) ?? []), row.key]);
    }
  }

  const added: { paintId: string; key: string }[] = [];
  const unmatched: { key: string; candidates: readonly string[] }[] = [];
  for (const [key, candidates] of candidatesOf) {
    const [only] = candidates;
    if (only !== undefined && candidates.length === 1) {
      if (claims.get(only)?.length === 1) {
        added.push({ paintId: only, key });
        continue;
      }
    }
    unmatched.push({ key, candidates });
  }

  const byPaint = new Map(added.map((a) => [a.paintId, a.key]));
  const brands = current.brands.flatMap((brand) => {
    if (!brand.paints.some((p) => byPaint.has(p.id))) return [];
    const paints = brand.paints.map((paint) => {
      const key = byPaint.get(paint.id);
      return key === undefined
        ? paint
        : { ...paint, keys: [...paint.keys, { sourceId, key }] };
    });
    return [{ ...brand, paints }];
  });
  return { brands, added, unmatched };
}
