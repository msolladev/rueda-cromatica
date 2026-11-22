import { format } from "../i18n/i18n.ts";
import type { Messages } from "../i18n/messages.ts";
import { ExternalLinkIcon } from "./icons.tsx";

/** The site of an address, without `www.`; the address itself if it has none. */
function hostOf(href: string): string {
  try {
    return new URL(href).host.replace(/^www\./, "") || href;
  } catch {
    return href;
  }
}

/**
 * A link to another site (docs/07 §13): in a new tab, with `nofollow`, so
 * that the web does not pass its standing to it in search engines, and with
 * Lucide's "external-link" icon in front. Its text says what it opens and
 * where (`{host}`), instead of the whole address.
 */
export function ExternalLink({
  href,
  text,
  messages: m,
}: {
  readonly href: string;
  readonly text: string;
  readonly messages: Messages;
}) {
  return (
    <a
      className="external-link"
      href={href}
      target="_blank"
      rel="noopener noreferrer nofollow"
    >
      <ExternalLinkIcon />
      <span className="link-text">
        {format(text, { host: hostOf(href) })}
        <span className="visually-hidden"> {m.credits.newTab}</span>
      </span>
    </a>
  );
}
