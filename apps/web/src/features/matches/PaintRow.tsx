import type { CSSProperties, ReactNode } from "react";
import { WheelIcon } from "../../app/icons.tsx";
import {
  format,
  formatDeltaE,
  formatParts,
  SEPARATOR,
} from "../../i18n/i18n.ts";
import type { Messages } from "../../i18n/messages.ts";
import {
  paintLabel,
  type EquivalenceLink,
  type PaintView,
  type SourceView,
} from "./search.ts";

/** Makes a paint the base of the wheel, as the paint search does. */
export type UsePaint = (paintId: string) => void;

interface PaintRowProps {
  readonly paint: PaintView;
  /**
   * The color of the wheel, for the top half of the swatch; `null` when the
   * paint is not measured against it, as the equivalences of a chosen paint
   * without colour: then the swatch is whole (docs/07 §16).
   */
  readonly target: string | null;
  /** In «Closest overall» and in the official block, each paint says its brand. */
  readonly showBrand: boolean;
  /** Whether approximate paints carry the chip (docs/07 §3). */
  readonly markApproximate: boolean;
  readonly messages: Messages;
  readonly locale: string;
  /** Where the documents of the official equivalences are listed. */
  readonly creditsPath: string;
  /** Makes an official equivalent the base; without it, no button. */
  readonly onUse?: UsePaint | undefined;
  /**
   * In the official block (docs/07 §16): who states the equivalence, under
   * the range, and the button to make the paint the base.
   */
  readonly sources?: readonly SourceView[] | undefined;
  /** Its place in an entrance animation, if it enters (docs/07 §1). */
  readonly enter?: number | undefined;
  /** Whether it is leaving, before «See less» removes it. */
  readonly leaving?: boolean;
}

/**
 * How close a paint is, from 1 (ΔE 0) down towards 0, for the bar of its
 * label (docs/07 §2): half at ΔE 5, the end of «Similar», and shorter and
 * shorter beyond, without ever disappearing.
 */
function closeness(deltaE: number): number {
  return Math.round((1 / (1 + deltaE / 5)) * 1000) / 1000;
}

/** One paint (docs/07 §2): what decides the choice in sight, the rest in «Details». */
export function PaintRow({
  paint,
  target,
  showBrand,
  markApproximate,
  messages: m,
  locale,
  creditsPath,
  onUse,
  sources,
  enter,
  leaving = false,
}: PaintRowProps) {
  return (
    <li
      className={
        leaving
          ? "paint paint-leave"
          : enter === undefined
            ? "paint"
            : "paint paint-enter"
      }
      data-sources={sources === undefined ? undefined : ""}
      style={
        enter === undefined
          ? undefined
          : ({ "--enter": enter } as CSSProperties)
      }
    >
      <span
        className={target === null ? "split split-whole" : "split"}
        aria-hidden="true"
      >
        {target !== null && <span style={{ background: target }} />}
        {paint.hex === null ? (
          <span className="split-any" />
        ) : (
          <span style={{ background: paint.hex }} />
        )}
      </span>
      <span className="paint-name">
        <span>{paint.name}</span>
        {sources !== undefined && (
          <UseAsBase
            id={paint.id}
            name={paint.name}
            onUse={onUse}
            messages={m}
          />
        )}
      </span>
      <span className="paint-range">
        {showBrand
          ? [paint.brandName, paint.rangeName].join(SEPARATOR)
          : paint.rangeName}
      </span>
      {sources !== undefined && (
        <span className="paint-sources">
          <Sources sources={sources} creditsPath={creditsPath} messages={m} />
        </span>
      )}
      <span className="chips">
        <span className="chip">{m.paintTypes[paint.type]}</span>
        {paint.metallic && <span className="chip">{m.results.metallic}</span>}
        {paint.chosen && (
          <span className="chip chip-chosen">{m.results.chosen}</span>
        )}
        {paint.discontinued && (
          <span className="chip chip-chosen">{m.results.discontinued}</span>
        )}
        {markApproximate && paint.reasons.length > 0 && (
          <span className="chip chip-approx">{m.approximate.chip}</span>
        )}
      </span>
      {/* docs/07 §2: the label and, beside it, how far it is. */}
      {paint.quality !== null && paint.deltaE !== null && (
        <span
          className="paint-quality"
          data-quality={paint.quality}
          style={{ "--closeness": closeness(paint.deltaE) } as CSSProperties}
        >
          {m.quality[paint.quality]}
          <span className="paint-delta">
            ΔE {formatDeltaE(paint.deltaE, locale)}
          </span>
        </span>
      )}
      <details className="paint-details">
        <summary>{m.results.details}</summary>
        <dl>
          <dt>{m.results.code}</dt>
          <dd>{paint.code ?? m.results.noCode}</dd>
          <dt>{m.results.hex}</dt>
          <dd>
            {paint.hex === null
              ? m.results.noColor
              : format(m.results.hexFrom, {
                  hex: paint.hex,
                  source: paint.sourceName ?? "",
                  origin: paint.origin === null ? "" : m.origins[paint.origin],
                })}
          </dd>
          <dt>{m.results.color}</dt>
          <dd>
            {paint.reasons.length === 0
              ? m.results.exactColor
              : paint.reasons
                  .map((reason) => m.approximate.reasons[reason])
                  .join(". ")}
          </dd>
          <dt className="official-details">{m.official.heading}</dt>
          <dd className="official-details">
            <OfficialLinks
              paint={paint}
              creditsPath={creditsPath}
              onUse={onUse}
              messages={m}
            />
          </dd>
        </dl>
      </details>
    </li>
  );
}

/**
 * The button that makes a paint the base (docs/07 §16): the wheel's icon,
 * its name in a tooltip, and the whole action in its accessible name. A
 * paint without colour lends the wheel another's, as in the search (§15).
 */
function UseAsBase({
  id,
  name,
  onUse,
  messages: m,
}: {
  readonly id: string;
  readonly name: string;
  readonly onUse: UsePaint | undefined;
  readonly messages: Messages;
}): ReactNode {
  if (onUse === undefined) return null;
  return (
    <button
      type="button"
      className="use-as-base has-tooltip"
      aria-label={format(m.official.use, { name })}
      data-tooltip={m.official.useShort}
      onClick={() => {
        onUse(id);
      }}
    >
      <WheelIcon />
    </button>
  );
}

/** «According to {publisher}, in {title}», one per document. */
export function Sources({
  sources,
  creditsPath,
  messages: m,
}: {
  readonly sources: readonly SourceView[];
  readonly creditsPath: string;
  readonly messages: Messages;
}): ReactNode {
  return sources.map((source, at) => (
    <span key={`${source.publisher}/${source.title}`}>
      {at > 0 && " "}
      {formatParts(m.official.by, {
        publisher: source.publisher,
        title: (
          <a key="title" href={creditsPath}>
            {source.title}
          </a>
        ),
      })}
    </span>
  ));
}

/** The official equivalences of a paint, in its «Details» (docs/07 §2). */
function OfficialLinks({
  paint,
  creditsPath,
  onUse,
  messages: m,
}: {
  readonly paint: PaintView;
  readonly creditsPath: string;
  readonly onUse: UsePaint | undefined;
  readonly messages: Messages;
}): ReactNode {
  if (paint.official.length === 0) return m.official.noneInDetails;
  const group = (direction: EquivalenceLink["direction"], title: string) => {
    const links = paint.official.filter((l) => l.direction === direction);
    if (links.length === 0) return null;
    return (
      <div className="official-links">
        <p>{title}</p>
        <ul>
          {links.map((link) => (
            <li key={link.id}>
              <span className="official-link-name">
                {link.name}
                <UseAsBase
                  id={link.id}
                  name={link.name}
                  onUse={onUse}
                  messages={m}
                />
              </span>
              <span className="official-link-meta">{paintLabel(link)}</span>
              <span className="official-link-meta">
                <Sources
                  sources={link.sources}
                  creditsPath={creditsPath}
                  messages={m}
                />
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  };
  return (
    <>
      {group(
        "replacement",
        format(m.official.replacement, { name: paint.name }),
      )}
      {group("outgoing", format(m.official.outgoing, { name: paint.name }))}
      {group("incoming", format(m.official.incoming, { name: paint.name }))}
    </>
  );
}
