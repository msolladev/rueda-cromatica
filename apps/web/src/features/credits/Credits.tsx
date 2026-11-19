import { Fragment } from "react";
import { ExternalLinkIcon } from "../../app/icons.tsx";
import { format } from "../../i18n/i18n.ts";
import type { Messages } from "../../i18n/messages.ts";
import type { CreditsData, LicenseEntry, SourceView } from "./data.ts";

interface CreditsProps {
  readonly data: CreditsData;
  readonly messages: Messages;
  readonly locale: string;
  /** The wheel of this language, absolute so it works with or without the final `/`. */
  readonly homePath: string;
}

/**
 * «Credits and sources» (docs/07 §13, ADR-0015): every source of the catalog
 * and every third-party license of the distributed code. Everything comes
 * from `catalog.json` and from the build; nothing is written by hand.
 */
export function Credits({ data, messages: m, locale, homePath }: CreditsProps) {
  return (
    <article className="credits">
      <h1>{m.credits.heading}</h1>
      <p className="lead">{m.credits.intro}</p>
      <section aria-labelledby="sources-heading">
        <h2 id="sources-heading">{m.credits.sourcesHeading}</h2>
        <p>{m.credits.sourcesIntro}</p>
        <ul className="cards">
          {data.sources.map((source) => (
            <Source
              key={source.id}
              source={source}
              messages={m}
              locale={locale}
            />
          ))}
        </ul>
      </section>
      <section aria-labelledby="code-heading">
        <h2 id="code-heading">{m.credits.codeHeading}</h2>
        <p>{m.credits.codeIntro}</p>
        <ul className="licenses">
          {data.licenses.map((entry) => (
            <License
              key={`${entry.kind}:${entry.name}`}
              entry={entry}
              messages={m}
            />
          ))}
        </ul>
      </section>
      <p>
        <a href={homePath}>{m.credits.backToWheel}</a>
      </p>
    </article>
  );
}

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
 * where, instead of the whole address.
 */
function ExternalLink({
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

function licenseName(license: string, m: Messages): string {
  if (license === "unknown") return m.credits.unknownLicense;
  if (license === "terms-of-use") return m.credits.termsOfUse;
  return license;
}

function Source({
  source,
  messages: m,
  locale,
}: {
  readonly source: SourceView;
  readonly messages: Messages;
  readonly locale: string;
}) {
  const retrieved = new Intl.DateTimeFormat(locale, {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(`${source.retrievedAt}T00:00:00Z`));
  return (
    <li className="card">
      <h3>{source.title}</h3>
      <dl className="facts">
        <dt>{m.credits.publisher}</dt>
        <dd>{source.publisher}</dd>
        {source.url !== null && (
          <>
            <dt>{m.credits.link}</dt>
            <dd>
              <ExternalLink
                href={source.url}
                text={m.credits.openSource}
                messages={m}
              />
            </dd>
          </>
        )}
        {source.archiveUrl !== null && (
          <>
            <dt>{m.credits.archive}</dt>
            <dd>
              <ExternalLink
                href={source.archiveUrl}
                text={m.credits.openArchive}
                messages={m}
              />
            </dd>
          </>
        )}
        <dt>{m.credits.license}</dt>
        <dd>{licenseName(source.license, m)}</dd>
        {source.attribution !== null && (
          <>
            <dt>{m.credits.attribution}</dt>
            <dd>{source.attribution}</dd>
          </>
        )}
        <dt>{m.credits.retrieved}</dt>
        <dd>
          <time dateTime={source.retrievedAt}>{retrieved}</time>
        </dd>
        {source.colors.map((color) => (
          <Fragment key={color.brandName}>
            <dt>
              {m.credits.colorsOf} {color.brandName}
            </dt>
            <dd>
              {color.ranges.join(", ")} (
              {format(m.credits.paintCount, { count: color.paintCount })})
            </dd>
          </Fragment>
        ))}
        {source.replacementCount > 0 && (
          <>
            <dt>{m.credits.replacements}</dt>
            <dd>{source.replacementCount}</dd>
          </>
        )}
        {source.officialEquivalenceCount > 0 && (
          <>
            <dt>{m.credits.equivalences}</dt>
            <dd>{source.officialEquivalenceCount}</dd>
          </>
        )}
      </dl>
    </li>
  );
}

function License({
  entry,
  messages: m,
}: {
  readonly entry: LicenseEntry;
  readonly messages: Messages;
}) {
  return (
    <li className="license">
      <h3>
        {entry.name}
        {entry.kind === "package" && (
          <span className="license-meta">
            {" "}
            {entry.version} · {entry.license}
          </span>
        )}
      </h3>
      {entry.kind === "package" && entry.repository !== null && (
        <p>
          <ExternalLink
            href={entry.repository}
            text={m.credits.openRepository}
            messages={m}
          />
        </p>
      )}
      <details>
        <summary>{m.credits.licenseText}</summary>
        <pre lang="en">{entry.text}</pre>
      </details>
    </li>
  );
}
