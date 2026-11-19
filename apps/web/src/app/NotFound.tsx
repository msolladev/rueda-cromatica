import type { CSSProperties } from "react";
import type { Messages } from "../i18n/messages.ts";
import { ArrowLeftIcon } from "./icons.tsx";

interface NotFoundProps {
  readonly homePath: string;
  readonly messages: Messages;
}

/** The twelve hues of a color wheel, one every 30°. */
const SEGMENTS = 12;
/** The segment that is missing: the page that was not found. */
const MISSING = 4;
const OUTER = 46;
const INNER = 32;

/** A point at `degrees` (0 at the top, clockwise) and `radius`, around 50,50. */
function point(degrees: number, radius: number): string {
  const angle = (degrees * Math.PI) / 180;
  const x = 50 + Math.sin(angle) * radius;
  const y = 50 - Math.cos(angle) * radius;
  return `${x.toFixed(3)} ${y.toFixed(3)}`;
}

/** One segment of the ring, with a small gap on each side. */
function segment(index: number): string {
  const from = index * 30 + 1.5;
  const to = (index + 1) * 30 - 1.5;
  return [
    `M ${point(from, OUTER)}`,
    `A ${String(OUTER)} ${String(OUTER)} 0 0 1 ${point(to, OUTER)}`,
    `L ${point(to, INNER)}`,
    `A ${String(INNER)} ${String(INNER)} 0 0 0 ${point(from, INNER)}`,
    "Z",
  ].join(" ");
}

/**
 * «Page not found» (docs/07 §12): served with the HTTP status 404 at any
 * unknown address, in the language of the address if it has one. A color
 * wheel with one hue missing, and a needle that looks for it, as the
 * template of the wheel does.
 */
export function NotFound({ homePath, messages: m }: NotFoundProps) {
  return (
    <article className="not-found">
      <div className="nf-wheel" aria-hidden="true">
        <svg viewBox="0 0 100 100">
          {Array.from({ length: SEGMENTS }, (_, index) =>
            index === MISSING ? (
              <path
                key={index}
                className="nf-missing"
                d={segment(index)}
                style={{ "--i": index } as CSSProperties}
              />
            ) : (
              <path
                key={index}
                className="nf-segment"
                d={segment(index)}
                style={
                  {
                    "--i": index,
                    fill: `hsl(${String(index * 30)} 72% 55%)`,
                  } as CSSProperties
                }
              />
            ),
          )}
          {/* Around the number, pointing at the ring. */}
          <g className="nf-needle">
            <line x1="50" y1="27" x2="50" y2={String(50 - INNER + 1)} />
            <circle cx="50" cy={String(50 - (OUTER + INNER) / 2)} r="4.5" />
          </g>
        </svg>
        <span className="nf-code">404</span>
      </div>
      <div className="nf-text">
        <h1>{m.notFound.title}</h1>
        <p className="lead">{m.notFound.body}</p>
        <a className="button" href={homePath}>
          <ArrowLeftIcon />
          {m.notFound.backHome}
        </a>
      </div>
    </article>
  );
}
