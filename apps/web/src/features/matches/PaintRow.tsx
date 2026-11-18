import { format } from "../../i18n/i18n.ts";
import type { Messages } from "../../i18n/messages.ts";
import type { PaintView } from "./search.ts";

interface PaintRowProps {
  readonly paint: PaintView;
  /** The color of the wheel, for the top half of the swatch. */
  readonly target: string;
  /** In «Closest overall», each paint says its brand. */
  readonly showBrand: boolean;
  /** Whether approximate paints carry the chip (docs/07 §3). */
  readonly markApproximate: boolean;
  readonly messages: Messages;
  readonly locale: string;
}

/** One paint (docs/07 §2): what decides the choice in sight, the rest in «Details». */
export function PaintRow({
  paint,
  target,
  showBrand,
  markApproximate,
  messages: m,
  locale,
}: PaintRowProps) {
  const deltaE = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(paint.deltaE);
  return (
    <li className="paint">
      <span className="split" aria-hidden="true">
        <span style={{ background: target }} />
        <span style={{ background: paint.hex }} />
      </span>
      <div className="paint-main">
        <span className="paint-name">{paint.name}</span>
        <span className="paint-range">
          {showBrand
            ? `${paint.brandName} · ${paint.rangeName}`
            : paint.rangeName}
        </span>
        <span className="chips">
          <span className="chip">{m.paintTypes[paint.type]}</span>
          {paint.metallic && <span className="chip">{m.results.metallic}</span>}
          {paint.discontinued && (
            <span className="chip">{m.results.discontinued}</span>
          )}
          {markApproximate && paint.reasons.length > 0 && (
            <span className="chip chip-approx">{m.approximate.chip}</span>
          )}
        </span>
      </div>
      <span className="paint-quality">{m.quality[paint.quality]}</span>
      <details className="paint-details">
        <summary>{m.results.details}</summary>
        <dl>
          <dt>{m.results.code}</dt>
          <dd>{paint.code ?? m.results.noCode}</dd>
          <dt>{m.results.deltaE}</dt>
          <dd>{deltaE}</dd>
          <dt>{m.results.hex}</dt>
          <dd>
            {format(m.results.hexFrom, {
              hex: paint.hex,
              source: paint.sourceName,
              origin: m.origins[paint.origin],
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
        </dl>
      </details>
    </li>
  );
}
