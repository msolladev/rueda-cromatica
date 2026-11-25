/**
 * The replacement of each discontinued paint (ADR-0005, ADR-0019 decision 1,
 * docs/04 §6). It comes from the transcription of the manufacturer documents:
 * each replacement whose two rows are keys of curated paints is a claim of
 * its source. The curated paint only chooses when the documents name
 * different replacements; without a choice, the build fails. Pure.
 */
import {
  err,
  ok,
  type PaintId,
  type Replacement,
  type Result,
} from "@chromatic-wheel/domain";
import type { CuratedPaint, SourceFile } from "../model/curated.ts";
import type { ColorIssue } from "./color.ts";
import { keyOf } from "./resolve.ts";

/** A source that states that a paint is replaced by another. */
export type ReplacementClaim = Replacement;

/**
 * The claims of the given sources for each discontinued paint, sorted by
 * source ID.
 *
 * @param owners - The paint of each key, from `resolveKeys`.
 */
export function replacementClaims(
  sources: readonly SourceFile[],
  owners: ReadonlyMap<string, PaintId>,
): ReadonlyMap<PaintId, readonly ReplacementClaim[]> {
  const claims = new Map<PaintId, ReplacementClaim[]>();
  for (const file of [...sources].sort((a, b) =>
    a.source.id.localeCompare(b.source.id),
  )) {
    const sourceId = file.source.id;
    for (const { from, to } of file.replacements) {
      const fromPaint = owners.get(keyOf(sourceId, from));
      const toPaint = owners.get(keyOf(sourceId, to));
      if (fromPaint === undefined || toPaint === undefined) continue;
      claims.set(fromPaint, [
        ...(claims.get(fromPaint) ?? []),
        { paintId: toPaint, sourceId },
      ]);
    }
  }
  return claims;
}

const describe = (claims: readonly ReplacementClaim[]): string =>
  claims.map((c) => `${c.paintId} (${c.sourceId})`).join(", ");

/**
 * The replacement published for a paint, from the claims of the enabled
 * sources, or the issues that stop the build. Several sources that name the
 * same paint agree: the first by source ID is the one published.
 */
export function selectReplacement(
  paint: CuratedPaint,
  claims: readonly ReplacementClaim[],
): Result<Replacement | null, readonly ColorIssue[]> {
  const fail = (path: string, message: string) => err([{ path, message }]);
  const { status } = paint;
  if (status.kind === "active") {
    return claims.length === 0
      ? ok(null)
      : fail(
          "status",
          `The manufacturer names a replacement for it, so it is discontinued: ${describe(claims)}; mark it discontinued`,
        );
  }

  const targets = new Set(claims.map((c) => c.paintId));
  const choice = status.replacementChoice;
  if (choice === null) {
    const [first] = claims;
    if (targets.size <= 1) return ok(first ?? null);
    return fail(
      "status",
      `The documents name different replacements: ${describe(claims)}; choose one with replacementChoice`,
    );
  }

  const chosen = claims.find((c) => c.sourceId === choice.sourceId);
  if (targets.size <= 1) {
    const without = claims[0] === undefined ? "none" : describe([claims[0]]);
    return fail(
      "status.replacementChoice",
      chosen === undefined
        ? `${choice.sourceId} names no replacement for it; remove the choice (without it: ${without})`
        : `The documents do not contradict each other; remove the choice (without it: ${without})`,
    );
  }
  return chosen === undefined
    ? fail(
        "status.replacementChoice",
        `${choice.sourceId} names no replacement for it; choose among ${describe(claims)}`,
      )
    : ok(chosen);
}
