import type { MouseEvent } from "react";
import type { Messages } from "../i18n/messages.ts";

interface SkipLinksProps {
  /** The home page skips to the wheel and the paints; the others, to the content. */
  readonly kind: "home" | "content";
  readonly messages: Messages;
}

/**
 * Where the focus goes inside `target`: the element marked with
 * `data-skip-focus` or, without one, the first focusable one.
 */
function firstFocusable(target: Element): HTMLElement | null {
  const marked = target.querySelector<HTMLElement>("[data-skip-focus]");
  if (marked !== null) return marked;
  return target.querySelector<HTMLElement>(
    ':is(a[href], button:not([disabled]), input:not([disabled]), select, summary, [tabindex="0"]):not([tabindex="-1"])',
  );
}

/**
 * Links that skip the navigation bar (docs/07 §11): the first stop of the
 * keyboard, seen only when focused. On the home page they go to the wheel
 * and to the paints, and put the focus on their first control (the ring, the
 * selected color); elsewhere, to the content. Without JavaScript they are
 * plain anchors.
 */
export function SkipLinks({ kind, messages: m }: SkipLinksProps) {
  const links =
    kind === "home"
      ? [
          ["wheel", m.nav.skipToWheel],
          ["paints", m.nav.skipToPaints],
        ]
      : [["content", m.nav.skipToContent]];
  const onClick = (event: MouseEvent<HTMLAnchorElement>, id: string) => {
    const target = document.getElementById(id);
    if (target === null) return;
    const focusable = firstFocusable(target);
    if (focusable === null) return;
    event.preventDefault();
    target.scrollIntoView({ block: "start" });
    focusable.focus({ preventScroll: true });
  };
  return (
    <div className="skip-links">
      {links.map(([id = "", text]) => (
        <a
          key={id}
          className="skip-link"
          href={`#${id}`}
          onClick={(event) => {
            onClick(event, id);
          }}
        >
          {text}
        </a>
      ))}
    </div>
  );
}
