/**
 * What «Credits and sources» shows (docs/07 §13), as plain data that the
 * prerendering embeds in the page.
 */
import { sourceContributions, type Catalog } from "@chromatic-wheel/domain";

export interface SourceView {
  readonly id: string;
  readonly title: string;
  readonly publisher: string;
  readonly url: string | null;
  readonly archiveUrl: string | null;
  /** SPDX identifier, `terms-of-use` or `unknown`. */
  readonly license: string;
  readonly attribution: string | null;
  readonly retrievedAt: string;
  readonly colors: readonly {
    readonly brandName: string;
    readonly ranges: readonly string[];
    readonly paintCount: number;
  }[];
  readonly replacementCount: number;
  readonly officialEquivalenceCount: number;
}

/** A third-party package in the distributed code, or a notice of copied code. */
export type LicenseEntry =
  | {
      readonly kind: "package";
      readonly name: string;
      readonly version: string;
      readonly license: string;
      readonly repository: string | null;
      /** The text of its LICENSE file. */
      readonly text: string;
    }
  | {
      readonly kind: "notice";
      /** The package of this project whose code includes the notice. */
      readonly name: string;
      /** The `@license` comment, without the comment marks. */
      readonly text: string;
    };

export interface CreditsData {
  readonly sources: readonly SourceView[];
  readonly licenses: readonly LicenseEntry[];
}

/** The sources of the catalog with what each one backs. */
export function sourceViews(catalog: Catalog): readonly SourceView[] {
  return sourceContributions(catalog).map(
    ({ source, colors, replacementCount, officialEquivalenceCount }) => ({
      id: source.id,
      title: source.title,
      publisher: source.publisher,
      url: source.url,
      archiveUrl: source.archiveUrl,
      license: source.license,
      attribution: source.attribution,
      retrievedAt: source.retrievedAt,
      colors: colors.map((color) => ({
        brandName: color.brand.name,
        ranges: color.ranges.map((range) => range.name),
        paintCount: color.paintCount,
      })),
      replacementCount,
      officialEquivalenceCount,
    }),
  );
}
